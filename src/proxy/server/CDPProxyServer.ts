/**
 * Main CDP Proxy Server Implementation
 * 
 * This is the core proxy server that manages persistent CDP connections,
 * accumulates console messages and network requests, and provides HTTP/WebSocket APIs.
 */

import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { ProxyServerConfig } from '../types/ProxyTypes';
import { ConnectionPool } from './ConnectionPool';
import { MessageStore } from './MessageStore';
import { HealthMonitor } from './HealthMonitor';
import { ProxyAPIServer } from './ProxyAPIServer';
import { WSProxy } from './WSProxy';
import { CDPEventMonitor } from './CDPEventMonitor';
import { PerformanceMonitor } from './PerformanceMonitor';
import { createLogger, Logger } from '../../utils/logger';
import * as os from 'os';
import * as path from 'path';

export class CDPProxyServer {
  private config: ProxyServerConfig;
  private app: express.Application;
  private httpServer: http.Server;
  private wsServer?: WebSocketServer;
  private connectionPool: ConnectionPool;
  private messageStore: MessageStore;
  private healthMonitor: HealthMonitor;
  private performanceMonitor: PerformanceMonitor;
  private apiServer: ProxyAPIServer;
  private wsProxy: WSProxy;
  private eventMonitor: CDPEventMonitor;
  private logger: Logger;
  private isRunning = false;
  private autoShutdownTimer?: NodeJS.Timeout;
  private memoryCleanupTimer?: NodeJS.Timeout;
  private startTime: number = 0;

  constructor() {
    // Initialize logger with file output in user's home directory
    const logDir = path.join(os.homedir(), '.chrome-cdp-cli', 'logs');
    const logFile = path.join(logDir, 'proxy-server.log');
    
    this.logger = createLogger({
      component: 'ProxyServer',
      file: logFile,
      enableStructured: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    });
    
    this.app = express();
    this.httpServer = http.createServer(this.app);
    
    // Initialize default configuration
    this.config = this.getDefaultConfig();
    
    // Initialize components (will be properly set up in start())
    this.messageStore = new MessageStore(this.config.maxConsoleMessages, this.config.maxNetworkRequests);
    this.eventMonitor = new CDPEventMonitor(this.messageStore);
    this.connectionPool = new ConnectionPool(this.eventMonitor, this.messageStore);
    this.healthMonitor = new HealthMonitor(this.connectionPool);
    this.performanceMonitor = new PerformanceMonitor(this.connectionPool, this.messageStore);
    this.apiServer = new ProxyAPIServer(this.connectionPool, this.messageStore, this.healthMonitor, this.performanceMonitor);
    this.wsProxy = new WSProxy(this.connectionPool);
  }

  /**
   * Start the proxy server with optional configuration override
   */
  async start(configOverride?: Partial<ProxyServerConfig>): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Proxy server is already running');
      return;
    }

    try {
      this.startTime = Date.now();
      
      // Log startup event with system information
      this.logger.logServerEvent('startup', 'Starting proxy server', {
        config: this.config,
        configOverride,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid
      });

      // Merge configuration
      this.config = { ...this.config, ...configOverride };
      
      // Update components with new config
      this.messageStore = new MessageStore(this.config.maxConsoleMessages, this.config.maxNetworkRequests);
      this.eventMonitor = new CDPEventMonitor(this.messageStore);
      this.connectionPool = new ConnectionPool(this.eventMonitor, this.messageStore, this.config);
      this.healthMonitor = new HealthMonitor(this.connectionPool);
      this.performanceMonitor = new PerformanceMonitor(this.connectionPool, this.messageStore);
      this.apiServer = new ProxyAPIServer(this.connectionPool, this.messageStore, this.healthMonitor, this.performanceMonitor);
      
      // Setup Express middleware
      this.setupMiddleware();
      
      // Setup API routes
      this.apiServer.setupRoutes(this.app);
      
      // Setup WebSocket server
      this.wsServer = new WebSocketServer({ server: this.httpServer });
      this.wsProxy.start(this.wsServer);
      
      // Start health monitoring
      this.healthMonitor.start(this.config.healthCheckInterval);
      
      // Start performance monitoring
      this.performanceMonitor.start(60000); // Monitor every minute
      
      // Start periodic memory cleanup
      this.startMemoryCleanup();
      
      // Start HTTP server
      await this.startHttpServer();
      
      // Setup auto-shutdown timer
      this.resetAutoShutdownTimer();
      
      this.isRunning = true;
      
      const startupTime = Date.now() - this.startTime;
      this.logger.logServerEvent('startup', `Proxy server started successfully on ${this.config.host}:${this.config.port}`, {
        startupTimeMs: startupTime,
        bindAddress: `${this.config.host}:${this.config.port}`,
        autoShutdownTimeout: this.config.autoShutdownTimeout,
        maxConnections: this.config.maxConsoleMessages
      });
      
    } catch (error) {
      this.logger.logServerEvent('error', 'Failed to start proxy server', {
        startupTimeMs: Date.now() - this.startTime,
        configAttempted: this.config
      }, error as Error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Stop the proxy server and cleanup resources
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    const shutdownStartTime = Date.now();
    this.logger.logServerEvent('shutdown', 'Stopping proxy server', {
      uptime: Date.now() - this.startTime,
      activeConnections: this.connectionPool.getAllConnections().length
    });

    try {
      // Clear auto-shutdown timer
      if (this.autoShutdownTimer) {
        clearTimeout(this.autoShutdownTimer);
        this.autoShutdownTimer = undefined;
      }

      // Clear memory cleanup timer
      if (this.memoryCleanupTimer) {
        clearInterval(this.memoryCleanupTimer);
        this.memoryCleanupTimer = undefined;
      }

      // Stop health monitoring
      this.healthMonitor.stop();

      // Stop performance monitoring
      this.performanceMonitor.stop();

      // Stop all event monitoring
      await this.eventMonitor.stopAllMonitoring();

      // Stop WebSocket proxy
      this.wsProxy.stop();

      // Close WebSocket server
      if (this.wsServer) {
        this.wsServer.close();
      }

      // Close HTTP server
      await this.stopHttpServer();

      // Cleanup connections and data
      await this.cleanup();

      this.isRunning = false;
      
      const shutdownTime = Date.now() - shutdownStartTime;
      this.logger.logServerEvent('shutdown', 'Proxy server stopped successfully', {
        shutdownTimeMs: shutdownTime,
        totalUptime: Date.now() - this.startTime
      });
      
      // Close logger file handle
      this.logger.close();

    } catch (error) {
      this.logger.logServerEvent('error', 'Error during proxy server shutdown', {
        shutdownTimeMs: Date.now() - shutdownStartTime
      }, error as Error);
      throw error;
    }
  }

  /**
   * Check if the proxy server is running
   */
  isServerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get current server configuration
   */
  getConfig(): ProxyServerConfig {
    return { ...this.config };
  }

  /**
   * Get server status information
   */
  getStatus() {
    const memoryStats = this.messageStore.getStorageStats();
    
    return {
      isRunning: this.isRunning,
      config: this.config,
      connections: this.connectionPool.getAllConnections().length,
      uptime: this.isRunning ? Date.now() - (this.connectionPool.getAllConnections()[0]?.createdAt || Date.now()) : 0,
      memory: {
        totalConsoleMessages: memoryStats.totalConsoleMessages,
        totalNetworkRequests: memoryStats.totalNetworkRequests,
        connectionsWithData: memoryStats.connections,
        maxConsoleMessages: this.config.maxConsoleMessages,
        maxNetworkRequests: this.config.maxNetworkRequests
      }
    };
  }

  /**
   * Reset the auto-shutdown timer
   */
  resetAutoShutdownTimer(): void {
    if (this.autoShutdownTimer) {
      clearTimeout(this.autoShutdownTimer);
    }

    if (this.config.autoShutdownTimeout > 0) {
      this.autoShutdownTimer = setTimeout(async () => {
        this.logger.logServerEvent('shutdown', 'Auto-shutdown timeout reached, stopping proxy server', {
          timeoutMs: this.config.autoShutdownTimeout,
          uptime: Date.now() - this.startTime,
          activeConnections: this.connectionPool.getAllConnections().length
        });
        await this.stop();
      }, this.config.autoShutdownTimeout);
    }
  }

  /**
   * Start periodic memory cleanup
   */
  private startMemoryCleanup(): void {
    // Run memory cleanup every 60 seconds
    this.memoryCleanupTimer = setInterval(() => {
      try {
        const beforeStats = this.messageStore.getStorageStats();
        const beforeMemory = process.memoryUsage();
        
        this.messageStore.enforceMemoryLimits();
        
        // Also cleanup unused connections
        this.connectionPool.cleanupUnusedConnections(this.config.autoShutdownTimeout);
        
        const afterStats = this.messageStore.getStorageStats();
        const afterMemory = process.memoryUsage();
        
        // Log memory cleanup activity
        this.logger.logMemoryEvent('cleanup', 'Periodic memory cleanup completed', {
          memoryUsage: afterMemory,
          connectionCount: this.connectionPool.getAllConnections().length,
          messageCount: afterStats.totalConsoleMessages,
          requestCount: afterStats.totalNetworkRequests
        });
        
        // Log if significant cleanup occurred
        const messagesCleanedUp = beforeStats.totalConsoleMessages - afterStats.totalConsoleMessages;
        const requestsCleanedUp = beforeStats.totalNetworkRequests - afterStats.totalNetworkRequests;
        
        if (messagesCleanedUp > 0 || requestsCleanedUp > 0) {
          this.logger.logMemoryEvent('cleanup', 'Memory cleanup removed old data', {
            messagesRemoved: messagesCleanedUp,
            requestsRemoved: requestsCleanedUp,
            memoryFreed: beforeMemory.heapUsed - afterMemory.heapUsed
          });
        }
        
      } catch (error) {
        this.logger.logServerEvent('error', 'Error during periodic memory cleanup', {
          cleanupInterval: 60000
        }, error as Error);
      }
    }, 60000); // 60 seconds

    this.logger.info('Started periodic memory cleanup', { intervalMs: 60000 });
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // JSON body parser
    this.app.use(express.json({ limit: '10mb' }));
    
    // CORS for local development
    this.app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      res.header('Access-Control-Allow-Origin', 'http://localhost:*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // Request logging with timing
    this.app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      const startTime = Date.now();
      
      // Log request start
      this.logger.debug(`API Request: ${req.method} ${req.path}`, {
        method: req.method,
        path: req.path,
        clientIP: req.ip,
        userAgent: req.get('user-agent')
      });
      
      // Capture response finish event
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.logger.logAPIEvent(
          req.method,
          req.path,
          res.statusCode,
          duration,
          req.ip
        );
      });
      
      this.resetAutoShutdownTimer(); // Reset timer on any activity
      next();
    });

    // Error handling middleware
    this.app.use((error: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
      this.logger.logAPIEvent(
        req.method,
        req.path,
        500,
        0,
        req.ip,
        error
      );
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: Date.now()
      });
    });
  }

  /**
   * Start the HTTP server
   */
  private async startHttpServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.httpServer.listen(this.config.port, this.config.host, () => {
        resolve();
      });

      this.httpServer.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          reject(new Error(`Port ${this.config.port} is already in use`));
        } else {
          reject(error);
        }
      });
    });
  }

  /**
   * Stop the HTTP server
   */
  private async stopHttpServer(): Promise<void> {
    return new Promise((resolve) => {
      if (this.httpServer) {
        this.httpServer.close(() => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Cleanup all resources
   */
  private async cleanup(): Promise<void> {
    try {
      // Close all CDP connections
      const connections = this.connectionPool.getAllConnections();
      for (const connection of connections) {
        await this.connectionPool.closeConnection(connection.id);
      }

      // Cleanup connection pool resources
      this.connectionPool.cleanup();

      // Clear message store
      this.messageStore.clearAll();

    } catch (error) {
      this.logger.error('Error during cleanup:', error);
    }
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): ProxyServerConfig {
    return {
      port: 9223,
      host: 'localhost',
      maxConsoleMessages: 1000,
      maxNetworkRequests: 500,
      autoShutdownTimeout: 300000, // 5 minutes
      reconnectMaxAttempts: 5,
      reconnectBackoffMs: 1000,
      healthCheckInterval: 30000 // 30 seconds
    };
  }
}
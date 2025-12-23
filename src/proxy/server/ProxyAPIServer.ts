/**
 * HTTP API Server for the proxy
 * 
 * Provides REST API endpoints for connection management and data retrieval.
 */

import express from 'express';
import { APIResponse, ConnectRequest, ConnectResponse, ConsoleMessageFilter, NetworkRequestFilter } from '../types/ProxyTypes';
import { ConnectionPool } from './ConnectionPool';
import { MessageStore } from './MessageStore';
import { HealthMonitor } from './HealthMonitor';
import { PerformanceMonitor } from './PerformanceMonitor';
import { SecurityManager } from './SecurityManager';
import { Logger } from '../../utils/logger';

export class ProxyAPIServer {
  private connectionPool: ConnectionPool;
  private messageStore: MessageStore;
  private healthMonitor?: HealthMonitor;
  private performanceMonitor?: PerformanceMonitor;
  private securityManager: SecurityManager;
  private logger: Logger;

  constructor(
    connectionPool: ConnectionPool, 
    messageStore: MessageStore, 
    healthMonitor?: HealthMonitor,
    performanceMonitor?: PerformanceMonitor,
    securityManager?: SecurityManager
  ) {
    this.connectionPool = connectionPool;
    this.messageStore = messageStore;
    this.healthMonitor = healthMonitor;
    this.performanceMonitor = performanceMonitor;
    this.securityManager = securityManager || new SecurityManager();
    this.logger = new Logger();
  }

  /**
   * Setup API routes on the Express app
   */
  setupRoutes(app: express.Application): void {
    // Apply rate limiting to all API routes
    app.use('/api', this.securityManager.getRateLimiter());

    // Connection management (with strict rate limiting for sensitive operations)
    app.post('/api/connect', this.securityManager.getStrictRateLimiter(), this.validateConnectRequest.bind(this), this.handleConnect.bind(this));
    app.delete('/api/connection/:connectionId', this.securityManager.getStrictRateLimiter(), this.validateConnectionId.bind(this), this.handleCloseConnection.bind(this));
    app.get('/api/connections', this.handleListConnections.bind(this));

    // Data retrieval
    app.get('/api/console/:connectionId', this.validateConnectionId.bind(this), this.handleGetConsoleMessages.bind(this));
    app.get('/api/network/:connectionId', this.validateConnectionId.bind(this), this.handleGetNetworkRequests.bind(this));
    app.get('/api/health/:connectionId', this.validateConnectionId.bind(this), this.handleHealthCheck.bind(this));

    // Health monitoring endpoints
    app.get('/api/health', this.handleServerHealth.bind(this));
    app.get('/api/health/detailed', this.handleDetailedHealthCheck.bind(this));
    app.get('/api/health/statistics', this.handleHealthStatistics.bind(this));
    app.get('/api/health/connections', this.handleAllConnectionsHealth.bind(this));
    app.post('/api/health/check/:connectionId', this.securityManager.getStrictRateLimiter(), this.validateConnectionId.bind(this), this.handleForceHealthCheck.bind(this));
    app.get('/api/metrics/connections', this.handleConnectionMetrics.bind(this));
    app.get('/api/metrics/reconnections', this.handleReconnectionMetrics.bind(this));

    // Performance monitoring endpoints
    app.get('/api/performance/current', this.handleCurrentPerformance.bind(this));
    app.get('/api/performance/history', this.handlePerformanceHistory.bind(this));
    app.get('/api/performance/summary', this.handlePerformanceSummary.bind(this));

    // Server status
    app.get('/api/status', this.handleServerStatus.bind(this));

    this.logger.info('API routes configured with enhanced security measures');
  }

  /**
   * Handle connection establishment
   */
  private async handleConnect(
    req: express.Request<{}, APIResponse<ConnectResponse>, ConnectRequest>,
    res: express.Response<APIResponse<ConnectResponse>>
  ): Promise<void> {
    try {
      const { host, port, targetId } = req.body;

      const connection = await this.connectionPool.getOrCreateConnection(host, port, targetId);

      const response: ConnectResponse = {
        connectionId: connection.id,
        targetInfo: {
          id: connection.targetId,
          title: 'Chrome Tab', // TODO: Get actual title from target info
          url: 'about:blank', // TODO: Get actual URL from target info
          type: 'page'
        },
        isNewConnection: connection.createdAt === connection.lastUsed
      };

      this.logger.info(`Connection established: ${connection.id} (${host}:${port}${targetId ? ':' + targetId : ''})`);

      res.json({
        success: true,
        data: response,
        timestamp: Date.now()
      });

    } catch (error) {
      this.logger.error('Connect API error:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Connection failed';
      let statusCode = 500;

      if (error instanceof Error) {
        if (error.message.includes('ECONNREFUSED')) {
          errorMessage = 'Unable to connect to Chrome DevTools. Ensure Chrome is running with --remote-debugging-port';
          statusCode = 503;
        } else if (error.message.includes('ENOTFOUND')) {
          errorMessage = 'Host not found. Check the host address';
          statusCode = 400;
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Connection timeout. Chrome may be unresponsive';
          statusCode = 504;
        } else {
          errorMessage = error.message;
        }
      }

      res.status(statusCode).json({
        success: false,
        error: errorMessage,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle console messages retrieval
   */
  private async handleGetConsoleMessages(
    req: express.Request<{connectionId: string}>,
    res: express.Response
  ): Promise<void> {
    try {
      const { connectionId } = req.params;

      // Check if connection exists
      const connection = this.connectionPool.getConnectionInfo(connectionId);
      if (!connection) {
        res.status(404).json({
          success: false,
          error: 'Connection not found',
          timestamp: Date.now()
        });
        return;
      }

      // Parse and validate query parameters for filtering
      const filter = this.parseConsoleMessageFilter(req.query);
      if (filter.error) {
        res.status(400).json({
          success: false,
          error: filter.error,
          timestamp: Date.now()
        });
        return;
      }

      const messages = this.messageStore.getConsoleMessages(connectionId, filter.data);

      res.json({
        success: true,
        data: {
          messages,
          totalCount: messages.length,
          connectionId,
          source: 'proxy',
          note: 'Includes all messages since connection established',
          filter: filter.data
        },
        timestamp: Date.now()
      });

    } catch (error) {
      this.logger.error('Get console messages API error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve console messages',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle network requests retrieval
   */
  private async handleGetNetworkRequests(
    req: express.Request<{connectionId: string}>,
    res: express.Response
  ): Promise<void> {
    try {
      const { connectionId } = req.params;

      // Check if connection exists
      const connection = this.connectionPool.getConnectionInfo(connectionId);
      if (!connection) {
        res.status(404).json({
          success: false,
          error: 'Connection not found',
          timestamp: Date.now()
        });
        return;
      }

      // Parse and validate query parameters for filtering
      const filter = this.parseNetworkRequestFilter(req.query);
      if (filter.error) {
        res.status(400).json({
          success: false,
          error: filter.error,
          timestamp: Date.now()
        });
        return;
      }

      const requests = this.messageStore.getNetworkRequests(connectionId, filter.data);

      res.json({
        success: true,
        data: {
          requests,
          totalCount: requests.length,
          connectionId,
          source: 'proxy',
          note: 'Includes all requests since connection established',
          filter: filter.data
        },
        timestamp: Date.now()
      });

    } catch (error) {
      this.logger.error('Get network requests API error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve network requests',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle connection health check
   */
  private async handleHealthCheck(
    req: express.Request<{connectionId: string}>,
    res: express.Response
  ): Promise<void> {
    try {
      const { connectionId } = req.params;

      const connection = this.connectionPool.getConnectionInfo(connectionId);

      if (!connection) {
        res.status(404).json({
          success: false,
          error: 'Connection not found',
          timestamp: Date.now()
        });
        return;
      }

      const isHealthy = await this.connectionPool.healthCheck(connectionId);
      const messageCount = this.messageStore.getConsoleMessageCount(connectionId);
      const requestCount = this.messageStore.getNetworkRequestCount(connectionId);

      res.json({
        success: true,
        data: {
          connectionId,
          isHealthy,
          lastUsed: connection.lastUsed,
          clientCount: connection.clientCount,
          uptime: Date.now() - connection.createdAt,
          target: {
            host: connection.host,
            port: connection.port,
            targetId: connection.targetId
          },
          storage: {
            consoleMessages: messageCount,
            networkRequests: requestCount
          }
        },
        timestamp: Date.now()
      });

    } catch (error) {
      this.logger.error('Health check API error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Health check failed',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle connection closure
   */
  private async handleCloseConnection(
    req: express.Request<{connectionId: string}>,
    res: express.Response
  ): Promise<void> {
    try {
      const { connectionId } = req.params;

      // Check if connection exists
      const connection = this.connectionPool.getConnectionInfo(connectionId);
      if (!connection) {
        res.status(404).json({
          success: false,
          error: 'Connection not found',
          timestamp: Date.now()
        });
        return;
      }
      
      await this.connectionPool.closeConnection(connectionId);
      this.messageStore.cleanupConnection(connectionId);

      this.logger.info(`Connection closed: ${connectionId}`);

      res.json({
        success: true,
        data: { connectionId, closed: true },
        timestamp: Date.now()
      });

    } catch (error) {
      this.logger.error('Close connection API error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to close connection',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle connections listing
   */
  private async handleListConnections(
    _req: express.Request,
    res: express.Response
  ): Promise<void> {
    try {
      const connections = this.connectionPool.getAllConnections();
      const storageStats = this.messageStore.getStorageStats();

      res.json({
        success: true,
        data: {
          connections: connections.map(conn => ({
            id: conn.id,
            host: conn.host,
            port: conn.port,
            targetId: conn.targetId,
            isHealthy: conn.isHealthy,
            clientCount: conn.clientCount,
            createdAt: conn.createdAt,
            lastUsed: conn.lastUsed,
            consoleMessages: storageStats.consoleMessagesByConnection[conn.id] || 0,
            networkRequests: storageStats.networkRequestsByConnection[conn.id] || 0
          })),
          totalConnections: connections.length,
          storageStats
        },
        timestamp: Date.now()
      });

    } catch (error) {
      this.logger.error('List connections API error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list connections',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle server status
   */
  private async handleServerStatus(
    _req: express.Request,
    res: express.Response
  ): Promise<void> {
    try {
      const connections = this.connectionPool.getAllConnections();
      const storageStats = this.messageStore.getStorageStats();

      res.json({
        success: true,
        data: {
          status: 'running',
          uptime: process.uptime() * 1000,
          connections: connections.length,
          totalConsoleMessages: storageStats.totalConsoleMessages,
          totalNetworkRequests: storageStats.totalNetworkRequests,
          memoryUsage: process.memoryUsage()
        },
        timestamp: Date.now()
      });

    } catch (error) {
      this.logger.error('Server status API error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get server status',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle server health check
   */
  private async handleServerHealth(
    _req: express.Request,
    res: express.Response
  ): Promise<void> {
    res.json({
      success: true,
      data: { status: 'healthy' },
      timestamp: Date.now()
    });
  }

  /**
   * Handle detailed health check with connection information
   */
  private async handleDetailedHealthCheck(
    _req: express.Request,
    res: express.Response
  ): Promise<void> {
    try {
      const connections = this.connectionPool.getAllConnections();
      const healthStatuses = this.healthMonitor?.getAllHealthStatuses() || [];
      const connectionMetrics = this.healthMonitor?.getAllConnectionMetrics() || [];
      const reconnectionStatuses = this.connectionPool.getAllReconnectionStatuses();
      
      const detailedHealth = {
        server: {
          status: 'healthy',
          uptime: process.uptime() * 1000,
          memoryUsage: process.memoryUsage(),
          isHealthMonitoringActive: this.healthMonitor?.isMonitoring() || false
        },
        connections: connections.map(conn => {
          const health = healthStatuses.find(h => h.connectionId === conn.id);
          const metrics = connectionMetrics.find(m => m.connectionId === conn.id);
          const reconnection = reconnectionStatuses.get(conn.id);
          
          return {
            id: conn.id,
            host: conn.host,
            port: conn.port,
            targetId: conn.targetId,
            isHealthy: conn.isHealthy,
            clientCount: conn.clientCount,
            uptime: Date.now() - conn.createdAt,
            lastUsed: conn.lastUsed,
            health: health ? {
              lastCheck: health.lastCheck,
              errorCount: health.errorCount,
              lastError: health.lastError
            } : null,
            metrics: metrics ? {
              messageCount: metrics.messageCount,
              requestCount: metrics.requestCount,
              lastActivity: metrics.lastActivity,
              reconnectionCount: metrics.reconnectionCount
            } : null,
            reconnection: reconnection || null
          };
        }),
        summary: this.healthMonitor?.getHealthStatistics() || {
          totalConnections: connections.length,
          healthyConnections: connections.filter(c => c.isHealthy).length,
          unhealthyConnections: connections.filter(c => !c.isHealthy).length,
          averageResponseTime: 0,
          totalHealthChecks: 0
        }
      };

      res.json({
        success: true,
        data: detailedHealth,
        timestamp: Date.now()
      });

    } catch (error) {
      this.logger.error('Detailed health check API error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get detailed health information',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle health statistics
   */
  private async handleHealthStatistics(
    _req: express.Request,
    res: express.Response
  ): Promise<void> {
    try {
      const statistics = this.healthMonitor?.getHealthStatistics() || {
        totalConnections: 0,
        healthyConnections: 0,
        unhealthyConnections: 0,
        averageResponseTime: 0,
        totalHealthChecks: 0
      };

      const storageStats = this.messageStore.getStorageStats();
      
      res.json({
        success: true,
        data: {
          health: statistics,
          storage: storageStats,
          server: {
            uptime: process.uptime() * 1000,
            memoryUsage: process.memoryUsage(),
            isHealthMonitoringActive: this.healthMonitor?.isMonitoring() || false
          }
        },
        timestamp: Date.now()
      });

    } catch (error) {
      this.logger.error('Health statistics API error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get health statistics',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle all connections health status
   */
  private async handleAllConnectionsHealth(
    _req: express.Request,
    res: express.Response
  ): Promise<void> {
    try {
      const healthStatuses = this.healthMonitor?.getAllHealthStatuses() || [];
      
      res.json({
        success: true,
        data: {
          healthStatuses,
          summary: {
            total: healthStatuses.length,
            healthy: healthStatuses.filter(h => h.isHealthy).length,
            unhealthy: healthStatuses.filter(h => !h.isHealthy).length
          }
        },
        timestamp: Date.now()
      });

    } catch (error) {
      this.logger.error('All connections health API error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get connections health status',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle force health check for a specific connection
   */
  private async handleForceHealthCheck(
    req: express.Request<{connectionId: string}>,
    res: express.Response
  ): Promise<void> {
    try {
      const { connectionId } = req.params;

      if (!this.healthMonitor) {
        res.status(503).json({
          success: false,
          error: 'Health monitoring is not available',
          timestamp: Date.now()
        });
        return;
      }

      // Check if connection exists
      const connection = this.connectionPool.getConnectionInfo(connectionId);
      if (!connection) {
        res.status(404).json({
          success: false,
          error: 'Connection not found',
          timestamp: Date.now()
        });
        return;
      }

      // Force health check
      const healthResult = await this.healthMonitor.checkConnection(connectionId);
      const metrics = this.healthMonitor.getConnectionMetrics(connectionId);
      const reconnectionStatus = this.connectionPool.getReconnectionStatus(connectionId);

      res.json({
        success: true,
        data: {
          connectionId,
          health: healthResult,
          metrics,
          reconnection: reconnectionStatus,
          connection: {
            host: connection.host,
            port: connection.port,
            targetId: connection.targetId,
            clientCount: connection.clientCount,
            uptime: Date.now() - connection.createdAt
          }
        },
        timestamp: Date.now()
      });

    } catch (error) {
      this.logger.error('Force health check API error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Force health check failed',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle connection metrics
   */
  private async handleConnectionMetrics(
    _req: express.Request,
    res: express.Response
  ): Promise<void> {
    try {
      const connections = this.connectionPool.getAllConnections();
      const metrics = this.healthMonitor?.getAllConnectionMetrics() || [];
      const storageStats = this.messageStore.getStorageStats();

      const connectionMetrics = connections.map(conn => {
        const metric = metrics.find(m => m.connectionId === conn.id);
        const consoleMessages = storageStats.consoleMessagesByConnection[conn.id] || 0;
        const networkRequests = storageStats.networkRequestsByConnection[conn.id] || 0;
        
        return {
          connectionId: conn.id,
          host: conn.host,
          port: conn.port,
          targetId: conn.targetId,
          uptime: Date.now() - conn.createdAt,
          clientCount: conn.clientCount,
          lastUsed: conn.lastUsed,
          isHealthy: conn.isHealthy,
          consoleMessages,
          networkRequests,
          metrics: metric || {
            messageCount: 0,
            requestCount: 0,
            lastActivity: conn.lastUsed,
            reconnectionCount: 0
          }
        };
      });

      res.json({
        success: true,
        data: {
          connections: connectionMetrics,
          summary: {
            totalConnections: connections.length,
            totalConsoleMessages: storageStats.totalConsoleMessages,
            totalNetworkRequests: storageStats.totalNetworkRequests,
            averageUptime: connections.length > 0 
              ? connections.reduce((sum, c) => sum + (Date.now() - c.createdAt), 0) / connections.length 
              : 0
          }
        },
        timestamp: Date.now()
      });

    } catch (error) {
      this.logger.error('Connection metrics API error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get connection metrics',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle reconnection metrics
   */
  private async handleReconnectionMetrics(
    _req: express.Request,
    res: express.Response
  ): Promise<void> {
    try {
      const reconnectionStatuses = this.connectionPool.getAllReconnectionStatuses();
      const connectionMetrics = this.healthMonitor?.getAllConnectionMetrics() || [];
      
      const reconnectionMetrics = Array.from(reconnectionStatuses.entries()).map(([connectionId, status]) => {
        const metrics = connectionMetrics.find(m => m.connectionId === connectionId);
        const connection = this.connectionPool.getConnectionInfo(connectionId);
        
        return {
          connectionId,
          isReconnecting: status.isReconnecting,
          attempts: status.attempts,
          maxAttempts: status.maxAttempts,
          reconnectionCount: metrics?.reconnectionCount || 0,
          connection: connection ? {
            host: connection.host,
            port: connection.port,
            targetId: connection.targetId,
            isHealthy: connection.isHealthy
          } : null
        };
      });

      const summary = {
        totalConnections: reconnectionStatuses.size,
        activeReconnections: reconnectionMetrics.filter(r => r.isReconnecting).length,
        totalReconnectionAttempts: reconnectionMetrics.reduce((sum, r) => sum + r.attempts, 0),
        totalSuccessfulReconnections: reconnectionMetrics.reduce((sum, r) => sum + r.reconnectionCount, 0)
      };

      res.json({
        success: true,
        data: {
          reconnections: reconnectionMetrics,
          summary
        },
        timestamp: Date.now()
      });

    } catch (error) {
      this.logger.error('Reconnection metrics API error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get reconnection metrics',
        timestamp: Date.now()
      });
    }
  }

  // ============================================================================
  // Validation Middleware
  // ============================================================================

  /**
   * Validate connection ID parameter
   */
  private validateConnectionId(req: express.Request, res: express.Response, next: express.NextFunction): void {
    const { connectionId } = req.params;
    
    if (!connectionId || typeof connectionId !== 'string' || connectionId.trim() === '') {
      this.logger.logSecurityEvent('invalid_connection_id', 'Invalid connection ID provided', {
        connectionId,
        ip: req.ip,
        path: req.path
      });
      
      res.status(400).json({
        success: false,
        error: 'Connection ID is required and must be a non-empty string',
        timestamp: Date.now()
      });
      return;
    }

    // Validate connection ID format (alphanumeric, hyphens, underscores only)
    const connectionIdRegex = /^[a-zA-Z0-9-_]+$/;
    if (!connectionIdRegex.test(connectionId)) {
      this.logger.logSecurityEvent('malformed_connection_id', 'Connection ID contains invalid characters', {
        connectionId,
        ip: req.ip,
        path: req.path
      });
      
      res.status(400).json({
        success: false,
        error: 'Connection ID contains invalid characters',
        timestamp: Date.now()
      });
      return;
    }

    next();
  }

  /**
   * Validate connect request body
   */
  private validateConnectRequest(req: express.Request, res: express.Response, next: express.NextFunction): void {
    const { host, port, targetId } = req.body;

    // Validate required fields
    if (!host || typeof host !== 'string') {
      this.logger.logSecurityEvent('invalid_connect_request', 'Missing or invalid host', {
        host,
        ip: req.ip
      });
      
      res.status(400).json({
        success: false,
        error: 'Host is required and must be a string',
        timestamp: Date.now()
      });
      return;
    }

    if (!port || typeof port !== 'number' || port <= 0 || port > 65535) {
      this.logger.logSecurityEvent('invalid_connect_request', 'Invalid port number', {
        port,
        ip: req.ip
      });
      
      res.status(400).json({
        success: false,
        error: 'Port is required and must be a valid number between 1 and 65535',
        timestamp: Date.now()
      });
      return;
    }

    // Validate optional targetId
    if (targetId !== undefined && (typeof targetId !== 'string' || targetId.trim() === '')) {
      this.logger.logSecurityEvent('invalid_connect_request', 'Invalid target ID', {
        targetId,
        ip: req.ip
      });
      
      res.status(400).json({
        success: false,
        error: 'TargetId must be a non-empty string if provided',
        timestamp: Date.now()
      });
      return;
    }

    // Validate host format (basic validation)
    const hostRegex = /^[a-zA-Z0-9.-]+$/;
    if (!hostRegex.test(host)) {
      this.logger.logSecurityEvent('invalid_host_format', 'Host contains invalid characters', {
        host,
        ip: req.ip
      });
      
      res.status(400).json({
        success: false,
        error: 'Host contains invalid characters',
        timestamp: Date.now()
      });
      return;
    }

    next();
  }

  // ============================================================================
  // API Handlers
  // ============================================================================

  /**
   * Parse and validate console message filter from query parameters
   */
  private parseConsoleMessageFilter(query: any): { data?: ConsoleMessageFilter; error?: string } {
    try {
      const filter: ConsoleMessageFilter = {};

      // Parse types filter
      if (query.types) {
        const types = Array.isArray(query.types) ? query.types : [query.types];
        const validTypes = ['log', 'info', 'warn', 'error', 'debug'];
        
        for (const type of types) {
          if (!validTypes.includes(type)) {
            return { error: `Invalid message type: ${type}. Valid types are: ${validTypes.join(', ')}` };
          }
        }
        filter.types = types;
      }

      // Parse text pattern
      if (query.textPattern) {
        if (typeof query.textPattern !== 'string') {
          return { error: 'textPattern must be a string' };
        }
        // Validate regex pattern
        try {
          new RegExp(query.textPattern, 'i');
          filter.textPattern = query.textPattern;
        } catch (e) {
          return { error: 'Invalid regex pattern in textPattern' };
        }
      }

      // Parse maxMessages
      if (query.maxMessages) {
        const maxMessages = parseInt(query.maxMessages, 10);
        if (isNaN(maxMessages) || maxMessages <= 0) {
          return { error: 'maxMessages must be a positive integer' };
        }
        filter.maxMessages = maxMessages;
      }

      // Parse time range
      if (query.startTime) {
        const startTime = parseInt(query.startTime, 10);
        if (isNaN(startTime) || startTime < 0) {
          return { error: 'startTime must be a valid timestamp' };
        }
        filter.startTime = startTime;
      }

      if (query.endTime) {
        const endTime = parseInt(query.endTime, 10);
        if (isNaN(endTime) || endTime < 0) {
          return { error: 'endTime must be a valid timestamp' };
        }
        filter.endTime = endTime;
      }

      // Validate time range
      if (filter.startTime && filter.endTime && filter.startTime > filter.endTime) {
        return { error: 'startTime must be less than or equal to endTime' };
      }

      // Parse source filter
      if (query.source) {
        const validSources = ['Runtime.consoleAPICalled', 'Log.entryAdded'];
        if (!validSources.includes(query.source)) {
          return { error: `Invalid source: ${query.source}. Valid sources are: ${validSources.join(', ')}` };
        }
        filter.source = query.source;
      }

      return { data: filter };
    } catch (error) {
      return { error: 'Failed to parse console message filter' };
    }
  }

  /**
   * Parse and validate network request filter from query parameters
   */
  private parseNetworkRequestFilter(query: any): { data?: NetworkRequestFilter; error?: string } {
    try {
      const filter: NetworkRequestFilter = {};

      // Parse methods filter
      if (query.methods) {
        const methods = Array.isArray(query.methods) ? query.methods : [query.methods];
        const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
        
        for (const method of methods) {
          const upperMethod = method.toUpperCase();
          if (!validMethods.includes(upperMethod)) {
            return { error: `Invalid HTTP method: ${method}. Valid methods are: ${validMethods.join(', ')}` };
          }
        }
        filter.methods = methods.map((m: string) => m.toUpperCase());
      }

      // Parse status codes filter
      if (query.statusCodes) {
        const statusCodes = Array.isArray(query.statusCodes) ? query.statusCodes : [query.statusCodes];
        
        for (const code of statusCodes) {
          const statusCode = parseInt(code, 10);
          if (isNaN(statusCode) || statusCode < 100 || statusCode > 599) {
            return { error: `Invalid status code: ${code}. Must be between 100 and 599` };
          }
        }
        filter.statusCodes = statusCodes.map((c: string) => parseInt(c, 10));
      }

      // Parse URL pattern
      if (query.urlPattern) {
        if (typeof query.urlPattern !== 'string') {
          return { error: 'urlPattern must be a string' };
        }
        // Validate regex pattern
        try {
          new RegExp(query.urlPattern, 'i');
          filter.urlPattern = query.urlPattern;
        } catch (e) {
          return { error: 'Invalid regex pattern in urlPattern' };
        }
      }

      // Parse maxRequests
      if (query.maxRequests) {
        const maxRequests = parseInt(query.maxRequests, 10);
        if (isNaN(maxRequests) || maxRequests <= 0) {
          return { error: 'maxRequests must be a positive integer' };
        }
        filter.maxRequests = maxRequests;
      }

      // Parse time range
      if (query.startTime) {
        const startTime = parseInt(query.startTime, 10);
        if (isNaN(startTime) || startTime < 0) {
          return { error: 'startTime must be a valid timestamp' };
        }
        filter.startTime = startTime;
      }

      if (query.endTime) {
        const endTime = parseInt(query.endTime, 10);
        if (isNaN(endTime) || endTime < 0) {
          return { error: 'endTime must be a valid timestamp' };
        }
        filter.endTime = endTime;
      }

      // Validate time range
      if (filter.startTime && filter.endTime && filter.startTime > filter.endTime) {
        return { error: 'startTime must be less than or equal to endTime' };
      }

      // Parse includeResponseBody
      if (query.includeResponseBody !== undefined) {
        if (query.includeResponseBody === 'true' || query.includeResponseBody === true) {
          filter.includeResponseBody = true;
        } else if (query.includeResponseBody === 'false' || query.includeResponseBody === false) {
          filter.includeResponseBody = false;
        } else {
          return { error: 'includeResponseBody must be true or false' };
        }
      }

      return { data: filter };
    } catch (error) {
      return { error: 'Failed to parse network request filter' };
    }
  }

  // ============================================================================
  // Performance Monitoring Endpoints
  // ============================================================================

  /**
   * Handle current performance metrics request
   */
  async handleCurrentPerformance(_req: express.Request, res: express.Response): Promise<void> {
    try {
      if (!this.performanceMonitor) {
        res.status(503).json({
          success: false,
          error: 'Performance monitoring not available',
          timestamp: Date.now()
        });
        return;
      }

      const metrics = this.performanceMonitor.getCurrentMetrics();
      
      res.json({
        success: true,
        data: metrics,
        timestamp: Date.now()
      });

    } catch (error) {
      this.logger.error('Current performance API error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get current performance metrics',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle performance history request
   */
  async handlePerformanceHistory(req: express.Request, res: express.Response): Promise<void> {
    try {
      if (!this.performanceMonitor) {
        res.status(503).json({
          success: false,
          error: 'Performance monitoring not available',
          timestamp: Date.now()
        });
        return;
      }

      const count = req.query.count ? parseInt(req.query.count as string) : undefined;
      const history = this.performanceMonitor.getMetricsHistory(count);
      
      res.json({
        success: true,
        data: {
          history,
          count: history.length
        },
        timestamp: Date.now()
      });

    } catch (error) {
      this.logger.error('Performance history API error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get performance history',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle performance summary request
   */
  async handlePerformanceSummary(req: express.Request, res: express.Response): Promise<void> {
    try {
      if (!this.performanceMonitor) {
        res.status(503).json({
          success: false,
          error: 'Performance monitoring not available',
          timestamp: Date.now()
        });
        return;
      }

      const periodMs = req.query.period ? parseInt(req.query.period as string) : 3600000; // Default 1 hour
      const summary = this.performanceMonitor.getPerformanceSummary(periodMs);
      
      res.json({
        success: true,
        data: {
          summary,
          periodMs,
          periodDescription: this.formatPeriod(periodMs)
        },
        timestamp: Date.now()
      });

    } catch (error) {
      this.logger.error('Performance summary API error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get performance summary',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Format period in milliseconds to human readable string
   */
  private formatPeriod(periodMs: number): string {
    const minutes = Math.floor(periodMs / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
  }
}
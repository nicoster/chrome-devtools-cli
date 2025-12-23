/**
 * Global Proxy Manager for seamless proxy lifecycle management
 * 
 * This manager ensures that the proxy server is always available
 * and healthy when needed, with automatic startup and recovery.
 */

import { ProxyClient } from '../client/ProxyClient';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import fetch from 'node-fetch';

export interface ProxyManagerConfig {
  proxyUrl: string;
  maxRetries: number;
  retryDelayMs: number;
  healthCheckTimeoutMs: number;
  startupTimeoutMs: number;
  enableLogging: boolean;
}

export class ProxyManager {
  private static instance: ProxyManager;
  private config: ProxyManagerConfig;
  private proxyProcess?: ChildProcess;
  private isStarting: boolean = false;
  private lastHealthCheck: number = 0;
  private healthCheckCacheMs: number = 5000; // Cache health check for 5 seconds

  private constructor(config?: Partial<ProxyManagerConfig>) {
    this.config = {
      proxyUrl: 'http://localhost:9223',
      maxRetries: 3,
      retryDelayMs: 1000,
      healthCheckTimeoutMs: 2000,
      startupTimeoutMs: 10000,
      enableLogging: false,
      ...config
    };
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<ProxyManagerConfig>): ProxyManager {
    if (!ProxyManager.instance) {
      ProxyManager.instance = new ProxyManager(config);
    }
    return ProxyManager.instance;
  }

  /**
   * Ensure proxy is running and healthy
   * This is the main method that should be called before any proxy operations
   */
  async ensureProxyReady(): Promise<boolean> {
    try {
      // Check if proxy is already healthy (with caching)
      if (await this.isProxyHealthy()) {
        return true;
      }

      // If not healthy, try to start/restart proxy
      return await this.startOrRestartProxy();
    } catch (error) {
      this.log(`Failed to ensure proxy ready: ${error instanceof Error ? error.message : error}`);
      return false;
    }
  }

  /**
   * Check if proxy is healthy (with caching)
   */
  private async isProxyHealthy(): Promise<boolean> {
    const now = Date.now();
    
    // Use cached result if recent
    if (now - this.lastHealthCheck < this.healthCheckCacheMs) {
      return true; // Assume healthy if recently checked
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.healthCheckTimeoutMs);
      
      const response = await fetch(`${this.config.proxyUrl}/api/health`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      if (response.ok) {
        this.lastHealthCheck = now;
        return true;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Start or restart the proxy server
   */
  private async startOrRestartProxy(): Promise<boolean> {
    // Prevent concurrent startup attempts
    if (this.isStarting) {
      return await this.waitForStartup();
    }

    this.isStarting = true;

    try {
      // Kill existing proxy process if any
      await this.killExistingProxy();

      // Start new proxy process
      const success = await this.startProxyProcess();
      
      if (success) {
        this.log('Proxy server started successfully');
      } else {
        this.log('Failed to start proxy server');
      }

      return success;
    } finally {
      this.isStarting = false;
    }
  }

  /**
   * Kill existing proxy process
   */
  private async killExistingProxy(): Promise<void> {
    if (this.proxyProcess) {
      try {
        this.proxyProcess.kill('SIGTERM');
        
        // Wait a bit for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (!this.proxyProcess.killed) {
          this.proxyProcess.kill('SIGKILL');
        }
      } catch (error) {
        // Ignore errors when killing process
      }
      this.proxyProcess = undefined;
    }

    // Also try to kill any existing proxy processes by port
    try {
      const { spawn } = require('child_process');
      const port = new URL(this.config.proxyUrl).port || '9223';
      
      // Find and kill processes using the proxy port
      const lsof = spawn('lsof', ['-ti', `:${port}`]);
      let pids = '';
      
      lsof.stdout.on('data', (data: Buffer) => {
        pids += data.toString();
      });
      
      lsof.on('close', (code: number) => {
        if (code === 0 && pids.trim()) {
          const pidList = pids.trim().split('\n');
          pidList.forEach(pid => {
            try {
              process.kill(parseInt(pid), 'SIGTERM');
            } catch (error) {
              // Ignore errors
            }
          });
        }
      });
    } catch (error) {
      // Ignore errors - this is best effort cleanup
    }
  }

  /**
   * Start the proxy process
   */
  private async startProxyProcess(): Promise<boolean> {
    try {
      const proxyServerPath = this.findProxyServerExecutable();
      if (!proxyServerPath) {
        this.log('Proxy server executable not found');
        return false;
      }

      this.log(`Starting proxy server: ${proxyServerPath}`);

      // Start the proxy server process
      this.proxyProcess = spawn('node', [proxyServerPath], {
        detached: true,
        stdio: this.config.enableLogging ? 'inherit' : 'ignore'
      });

      // Unref the process so it doesn't keep the parent alive
      this.proxyProcess.unref();

      // Handle process events
      this.proxyProcess.on('error', (error) => {
        this.log(`Proxy process error: ${error.message}`);
        this.proxyProcess = undefined;
      });

      this.proxyProcess.on('exit', (code, signal) => {
        this.log(`Proxy process exited with code ${code}, signal ${signal}`);
        this.proxyProcess = undefined;
      });

      // Wait for the server to start and become healthy
      return await this.waitForProxyStartup();
    } catch (error) {
      this.log(`Failed to start proxy process: ${error instanceof Error ? error.message : error}`);
      return false;
    }
  }

  /**
   * Wait for proxy to start and become healthy
   */
  private async waitForProxyStartup(): Promise<boolean> {
    const startTime = Date.now();
    const maxWaitTime = this.config.startupTimeoutMs;

    while (Date.now() - startTime < maxWaitTime) {
      // Reset health check cache to force real check
      this.lastHealthCheck = 0;
      
      if (await this.isProxyHealthy()) {
        return true;
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.log(`Proxy startup timeout after ${maxWaitTime}ms`);
    return false;
  }

  /**
   * Wait for ongoing startup to complete
   */
  private async waitForStartup(): Promise<boolean> {
    const maxWait = this.config.startupTimeoutMs;
    const startTime = Date.now();

    while (this.isStarting && Date.now() - startTime < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return !this.isStarting && await this.isProxyHealthy();
  }

  /**
   * Find the proxy server executable
   */
  private findProxyServerExecutable(): string | null {
    // Look for compiled proxy server in dist directory
    const distPath = path.join(__dirname, '../../dist/proxy/index.js');
    if (fs.existsSync(distPath)) {
      return distPath;
    }

    // Look for source proxy server (for development)
    const srcPath = path.join(__dirname, '../proxy/index.js');
    if (fs.existsSync(srcPath)) {
      return srcPath;
    }

    // Look in current directory dist
    const currentDistPath = path.join(process.cwd(), 'dist/proxy/index.js');
    if (fs.existsSync(currentDistPath)) {
      return currentDistPath;
    }

    // Look in node_modules if this is installed as a package
    const nodeModulesPath = path.join(__dirname, '../../../node_modules/chrome-cdp-cli/dist/proxy/index.js');
    if (fs.existsSync(nodeModulesPath)) {
      return nodeModulesPath;
    }

    return null;
  }

  /**
   * Get a ProxyClient instance that's guaranteed to work with a healthy proxy
   */
  async getProxyClient(): Promise<ProxyClient | null> {
    if (await this.ensureProxyReady()) {
      return new ProxyClient({
        proxyUrl: this.config.proxyUrl,
        fallbackToDirect: true,
        startProxyIfNeeded: false // We handle this at the manager level
      });
    }
    return null;
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.proxyProcess) {
      try {
        this.proxyProcess.kill('SIGTERM');
        
        // Wait for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (!this.proxyProcess.killed) {
          this.proxyProcess.kill('SIGKILL');
        }
      } catch (error) {
        // Ignore errors during shutdown
      }
      this.proxyProcess = undefined;
    }
  }

  /**
   * Enable or disable logging
   */
  setLogging(enabled: boolean): void {
    this.config.enableLogging = enabled;
  }

  /**
   * Log message if logging is enabled
   */
  private log(message: string): void {
    if (this.config.enableLogging) {
      console.log(`[ProxyManager] ${message}`);
    }
  }

  /**
   * Get proxy status for debugging
   */
  async getStatus(): Promise<{
    isHealthy: boolean;
    isStarting: boolean;
    hasProcess: boolean;
    lastHealthCheck: number;
  }> {
    return {
      isHealthy: await this.isProxyHealthy(),
      isStarting: this.isStarting,
      hasProcess: !!this.proxyProcess,
      lastHealthCheck: this.lastHealthCheck
    };
  }
}
import { WebSocket } from 'ws';
import fetch from 'node-fetch';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import {
  ProxyClientConfig,
  APIResponse,
  ConnectRequest,
  ConnectResponse,
  StoredConsoleMessage,
  StoredNetworkRequest,
  ConsoleMessageFilter,
  NetworkRequestFilter,
  HealthCheckResult
} from '../proxy/types/ProxyTypes';

/**
 * Client-side integration for chrome-cdp-cli to use the proxy server
 */
export class ProxyClient {
  private config: ProxyClientConfig;
  private connectionId?: string;
  private wsConnection?: WebSocket;
  private proxyProcess?: ChildProcess;

  constructor(config?: Partial<ProxyClientConfig>) {
    this.config = {
      proxyUrl: 'http://localhost:9223',
      fallbackToDirect: true,
      startProxyIfNeeded: true,
      ...config
    };
  }

  /**
   * Ensure proxy server is running, starting it if needed
   */
  async ensureProxyRunning(): Promise<boolean> {
    try {
      // First check if proxy is already running
      const isRunning = await this.isProxyRunning();
      if (isRunning) {
        return true;
      }

      // If not running and auto-start is enabled, start it
      if (this.config.startProxyIfNeeded) {
        return await this.startProxyServer();
      }

      return false;
    } catch (error) {
      console.warn('Failed to ensure proxy is running:', error instanceof Error ? error.message : error);
      return false;
    }
  }

  /**
   * Check if proxy server is running by hitting health endpoint
   */
  private async isProxyRunning(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch(`${this.config.proxyUrl}/api/health`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Start the proxy server as a background process
   */
  private async startProxyServer(): Promise<boolean> {
    try {
      // Find the proxy server executable
      const proxyServerPath = this.findProxyServerExecutable();
      if (!proxyServerPath) {
        console.warn('Proxy server executable not found');
        return false;
      }

      // Start the proxy server process
      this.proxyProcess = spawn('node', [proxyServerPath], {
        detached: true,
        stdio: 'ignore'
      });

      // Unref the process so it doesn't keep the parent alive
      this.proxyProcess.unref();

      // Wait for the server to start (up to 5 seconds)
      const startTime = Date.now();
      while (Date.now() - startTime < 5000) {
        if (await this.isProxyRunning()) {
          return true;
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      console.warn('Proxy server failed to start within timeout');
      return false;
    } catch (error) {
      console.warn('Failed to start proxy server:', error instanceof Error ? error.message : error);
      return false;
    }
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

    // Look for source proxy server
    const srcPath = path.join(__dirname, '../proxy/index.js');
    if (fs.existsSync(srcPath)) {
      return srcPath;
    }

    // Look in node_modules if this is installed as a package
    const nodeModulesPath = path.join(__dirname, '../../../node_modules/chrome-cdp-cli/dist/proxy/index.js');
    if (fs.existsSync(nodeModulesPath)) {
      return nodeModulesPath;
    }

    return null;
  }

  /**
   * Connect to a Chrome target through the proxy
   */
  async connect(host: string, port: number, targetId?: string): Promise<string> {
    const request: ConnectRequest = {
      host,
      port,
      targetId
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(`${this.config.proxyUrl}/api/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Proxy connect failed: ${response.status} ${response.statusText}`);
      }

      const result: APIResponse<ConnectResponse> = await response.json();
      
      if (!result.success) {
        throw new Error(`Proxy connect failed: ${result.error}`);
      }

      this.connectionId = result.data!.connectionId;
      return this.connectionId;
    } catch (error) {
      throw new Error(`Failed to connect through proxy: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Get console messages from the proxy
   */
  async getConsoleMessages(filter?: ConsoleMessageFilter): Promise<StoredConsoleMessage[]> {
    if (!this.connectionId) {
      throw new Error('No active connection. Call connect() first.');
    }

    try {
      const url = new URL(`${this.config.proxyUrl}/api/console/${this.connectionId}`);
      
      // Add filter parameters to query string
      if (filter) {
        if (filter.types) {
          url.searchParams.set('types', filter.types.join(','));
        }
        if (filter.textPattern) {
          url.searchParams.set('textPattern', filter.textPattern);
        }
        if (filter.maxMessages) {
          url.searchParams.set('maxMessages', filter.maxMessages.toString());
        }
        if (filter.startTime) {
          url.searchParams.set('startTime', filter.startTime.toString());
        }
        if (filter.endTime) {
          url.searchParams.set('endTime', filter.endTime.toString());
        }
        if (filter.source) {
          url.searchParams.set('source', filter.source);
        }
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Failed to get console messages: ${response.status} ${response.statusText}`);
      }

      const result: APIResponse<{
        messages: StoredConsoleMessage[];
        totalCount: number;
        connectionId: string;
        source: string;
        note: string;
        filter: any;
      }> = await response.json();
      
      if (!result.success) {
        throw new Error(`Failed to get console messages: ${result.error}`);
      }

      return result.data?.messages || [];
    } catch (error) {
      throw new Error(`Failed to get console messages: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Get network requests from the proxy
   */
  async getNetworkRequests(filter?: NetworkRequestFilter): Promise<StoredNetworkRequest[]> {
    if (!this.connectionId) {
      throw new Error('No active connection. Call connect() first.');
    }

    try {
      const url = new URL(`${this.config.proxyUrl}/api/network/${this.connectionId}`);
      
      // Add filter parameters to query string
      if (filter) {
        if (filter.methods) {
          url.searchParams.set('methods', filter.methods.join(','));
        }
        if (filter.statusCodes) {
          url.searchParams.set('statusCodes', filter.statusCodes.join(','));
        }
        if (filter.urlPattern) {
          url.searchParams.set('urlPattern', filter.urlPattern);
        }
        if (filter.maxRequests) {
          url.searchParams.set('maxRequests', filter.maxRequests.toString());
        }
        if (filter.startTime) {
          url.searchParams.set('startTime', filter.startTime.toString());
        }
        if (filter.endTime) {
          url.searchParams.set('endTime', filter.endTime.toString());
        }
        if (filter.includeResponseBody !== undefined) {
          url.searchParams.set('includeResponseBody', filter.includeResponseBody.toString());
        }
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Failed to get network requests: ${response.status} ${response.statusText}`);
      }

      const result: APIResponse<{
        requests: StoredNetworkRequest[];
        totalCount: number;
        connectionId: string;
        source: string;
        note: string;
        filter: any;
      }> = await response.json();
      
      if (!result.success) {
        throw new Error(`Failed to get network requests: ${result.error}`);
      }

      return result.data?.requests || [];
    } catch (error) {
      throw new Error(`Failed to get network requests: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Create a WebSocket proxy connection for CDP commands
   */
  async createWebSocketProxy(): Promise<WebSocket> {
    if (!this.connectionId) {
      throw new Error('No active connection. Call connect() first.');
    }

    try {
      const wsUrl = this.config.proxyUrl.replace('http://', 'ws://').replace('https://', 'wss://');
      const ws = new WebSocket(`${wsUrl}/ws/${this.connectionId}`);

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, 10000);

        ws.on('open', () => {
          clearTimeout(timeout);
          this.wsConnection = ws;
          resolve(ws);
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    } catch (error) {
      throw new Error(`Failed to create WebSocket proxy: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Check health of the proxy connection
   */
  async healthCheck(): Promise<HealthCheckResult | null> {
    if (!this.connectionId) {
      return null;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.config.proxyUrl}/api/health/${this.connectionId}`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
      }

      const result: APIResponse<HealthCheckResult> = await response.json();
      
      if (!result.success) {
        throw new Error(`Health check failed: ${result.error}`);
      }

      return result.data || null;
    } catch (error) {
      console.warn('Health check failed:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  /**
   * Disconnect from the proxy
   */
  async disconnect(): Promise<void> {
    try {
      // Close WebSocket connection if active
      if (this.wsConnection) {
        this.wsConnection.close();
        this.wsConnection = undefined;
      }

      // Close proxy connection if we have one
      if (this.connectionId) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          
          await fetch(`${this.config.proxyUrl}/api/connection/${this.connectionId}`, {
            method: 'DELETE',
            signal: controller.signal
          });
          
          clearTimeout(timeout);
        } catch (error) {
          // Ignore errors when disconnecting
        }
        this.connectionId = undefined;
      }
    } catch (error) {
      // Ignore errors during disconnect
    }
  }

  /**
   * Get the current connection ID
   */
  getConnectionId(): string | undefined {
    return this.connectionId;
  }

  /**
   * Check if proxy is available
   */
  async isProxyAvailable(): Promise<boolean> {
    return await this.isProxyRunning();
  }

  /**
   * Get proxy configuration
   */
  getConfig(): ProxyClientConfig {
    return { ...this.config };
  }
}
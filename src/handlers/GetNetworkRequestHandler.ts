import { CDPClient, CommandResult } from '../types';
import { NetworkMonitor, NetworkRequestFilter } from '../monitors/NetworkMonitor';
import { ProxyClient } from '../client/ProxyClient';
import { NetworkRequestFilter as ProxyNetworkRequestFilter } from '../proxy/types/ProxyTypes';

/**
 * Handler for getting the most recent network request
 */
export class GetNetworkRequestHandler {
  name = 'get_network_request';
  private networkMonitor: NetworkMonitor | null = null;
  private proxyClient: ProxyClient | null = null;

  async execute(client: CDPClient, args: unknown): Promise<CommandResult> {
    try {
      const params = args as {
        filter?: {
          methods?: string[];
          urlPattern?: string;
          statusCodes?: number[];
        };
        host?: string;
        port?: number;
        targetId?: string;
      };

      // Try to use proxy first
      const proxyResult = await this.tryProxyExecution(params);
      if (proxyResult) {
        return proxyResult;
      }

      // Fallback to direct CDP connection
      return await this.executeDirectCDP(client, params);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Try to execute using proxy server
   */
  private async tryProxyExecution(params: any): Promise<CommandResult | null> {
    try {
      // Initialize proxy client if not already done
      if (!this.proxyClient) {
        this.proxyClient = new ProxyClient();
      }

      // Check if proxy is available
      const isProxyAvailable = await this.proxyClient.isProxyAvailable();
      if (!isProxyAvailable) {
        // Try to start proxy if needed
        const proxyStarted = await this.proxyClient.ensureProxyRunning();
        if (!proxyStarted) {
          console.warn('⚠️  Proxy server unavailable. Falling back to direct CDP connection.');
          console.warn('⚠️  Note: Direct connection only captures NEW network requests, not historical data.');
          return null; // Fallback to direct CDP
        }
      }

      // Connect through proxy if not already connected
      if (!this.proxyClient.getConnectionId()) {
        const host = params.host || 'localhost';
        const port = params.port || 9222;
        await this.proxyClient.connect(host, port, params.targetId);
      }

      // Prepare filter options for proxy
      const filter: ProxyNetworkRequestFilter | undefined = params.filter ? {
        methods: params.filter.methods,
        urlPattern: params.filter.urlPattern,
        statusCodes: params.filter.statusCodes,
        maxRequests: 1, // Get only the latest request
      } : { maxRequests: 1 };

      // Get network requests from proxy
      const requests = await this.proxyClient.getNetworkRequests(filter);
      const latestRequest = requests.length > 0 ? requests[requests.length - 1] : null;

      if (!latestRequest) {
        return {
          success: true,
          data: null,
          dataSource: 'proxy',
          hasHistoricalData: true
        };
      }

      return {
        success: true,
        data: latestRequest,
        dataSource: 'proxy',
        hasHistoricalData: true
      };
    } catch (error) {
      console.warn('⚠️  Proxy execution failed, falling back to direct CDP:', error instanceof Error ? error.message : error);
      console.warn('⚠️  Note: Direct connection only captures NEW network requests, not historical data.');
      return null;
    }
  }

  /**
   * Execute using direct CDP connection (fallback)
   */
  private async executeDirectCDP(client: CDPClient, params: any): Promise<CommandResult> {
    // Initialize network monitor if not already done
    if (!this.networkMonitor) {
      this.networkMonitor = new NetworkMonitor(client);
    }
    
    // Start monitoring if not already active
    if (!this.networkMonitor.isActive()) {
      await this.networkMonitor.startMonitoring();
    }

    // Prepare filter options
    const filter: NetworkRequestFilter | undefined = params.filter ? {
      methods: params.filter.methods,
      urlPattern: params.filter.urlPattern,
      statusCodes: params.filter.statusCodes,
    } : undefined;

    // Get the latest network request
    const latestRequest = this.networkMonitor.getLatestRequest(filter);

    if (!latestRequest) {
      return {
        success: true,
        data: null,
        dataSource: 'direct',
        hasHistoricalData: false
      };
    }

    return {
      success: true,
      data: latestRequest,
      dataSource: 'direct',
      hasHistoricalData: false
    };
  }

  /**
   * Get the network monitor instance (for testing purposes)
   */
  getNetworkMonitor(): NetworkMonitor | null {
    return this.networkMonitor;
  }

  /**
   * Set the network monitor instance (for testing purposes)
   */
  setNetworkMonitor(monitor: NetworkMonitor): void {
    this.networkMonitor = monitor;
  }
}
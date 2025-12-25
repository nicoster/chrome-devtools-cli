import { CDPClient, CommandResult } from '../types';
import { NetworkMonitor, NetworkRequestFilter } from '../monitors/NetworkMonitor';
import { ProxyClient } from '../client/ProxyClient';
import { NetworkRequestFilter as ProxyNetworkRequestFilter } from '../proxy/types/ProxyTypes';

/**
 * Handler for listing network requests
 */
export class ListNetworkRequestsHandler {
  name = 'network';
  private networkMonitor: NetworkMonitor | null = null;
  private proxyClient: ProxyClient | null = null;

  async execute(client: CDPClient, args: unknown): Promise<CommandResult> {
    try {
      const params = args as {
        filter?: {
          methods?: string[];
          urlPattern?: string;
          statusCodes?: number[];
          maxRequests?: number;
          startTime?: number;
          endTime?: number;
        };
        latest?: boolean;
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
        maxRequests: params.latest ? 1 : params.filter.maxRequests,
        startTime: params.filter.startTime,
        endTime: params.filter.endTime,
      } : params.latest ? { maxRequests: 1 } : undefined;

      // Get network requests from proxy
      const requests = await this.proxyClient.getNetworkRequests(filter);

      // If latest is requested, return single request object instead of array
      if (params.latest) {
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
      }

      return {
        success: true,
        data: {
          requests,
          count: requests.length,
          isMonitoring: true
        },
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
      maxRequests: params.filter.maxRequests,
      startTime: params.filter.startTime,
      endTime: params.filter.endTime,
    } : undefined;

    // If latest is requested, get single request
    if (params.latest) {
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

    // Get all network requests
    const requests = this.networkMonitor.getRequests(filter);

    return {
      success: true,
      data: {
        requests,
        count: requests.length,
        isMonitoring: this.networkMonitor.isActive()
      },
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
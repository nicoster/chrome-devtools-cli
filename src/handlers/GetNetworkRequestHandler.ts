import { CDPClient, CommandResult } from '../types';
import { NetworkMonitor, NetworkRequestFilter } from '../monitors/NetworkMonitor';

/**
 * Handler for getting the most recent network request
 */
export class GetNetworkRequestHandler {
  name = 'get_network_request';
  private networkMonitor: NetworkMonitor | null = null;

  async execute(client: CDPClient, args: unknown): Promise<CommandResult> {
    try {
      const params = args as {
        filter?: {
          methods?: string[];
          urlPattern?: string;
          statusCodes?: number[];
        };
      };

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
          data: null
        };
      }

      return {
        success: true,
        data: latestRequest
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
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
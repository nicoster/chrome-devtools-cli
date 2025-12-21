import { CDPClient, CommandResult } from '../types';
import { NetworkMonitor, NetworkRequestFilter } from '../monitors/NetworkMonitor';

/**
 * Handler for listing all network requests
 */
export class ListNetworkRequestsHandler {
  name = 'list_network_requests';
  private networkMonitor: NetworkMonitor | null = null;

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
        maxRequests: params.filter.maxRequests,
        startTime: params.filter.startTime,
        endTime: params.filter.endTime,
      } : undefined;

      // Get all network requests
      const requests = this.networkMonitor.getRequests(filter);

      return {
        success: true,
        data: {
          requests,
          count: requests.length,
          isMonitoring: this.networkMonitor.isActive()
        }
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
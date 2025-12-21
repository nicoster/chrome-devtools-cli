import { CDPClient, NetworkRequest } from '../types';

/**
 * Network request filter options
 */
export interface NetworkRequestFilter {
  methods?: string[];
  urlPattern?: string;
  statusCodes?: number[];
  maxRequests?: number;
  startTime?: number;
  endTime?: number;
}

/**
 * Network monitoring functionality
 */
export class NetworkMonitor {
  private client: CDPClient;
  private requests: Map<string, NetworkRequest> = new Map();
  private completedRequests: NetworkRequest[] = [];
  private isMonitoring = false;
  private requestWillBeSentHandler: ((params: unknown) => void) | null = null;
  private responseReceivedHandler: ((params: unknown) => void) | null = null;
  private loadingFinishedHandler: ((params: unknown) => void) | null = null;
  private loadingFailedHandler: ((params: unknown) => void) | null = null;

  constructor(client: CDPClient) {
    this.client = client;
  }

  /**
   * Start monitoring network requests
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    // Enable Network domain to receive network events
    await this.client.send('Network.enable');

    // Set up event listeners for network events
    this.requestWillBeSentHandler = (params: unknown) => {
      this.handleRequestWillBeSent(params);
    };

    this.responseReceivedHandler = (params: unknown) => {
      this.handleResponseReceived(params);
    };

    this.loadingFinishedHandler = (params: unknown) => {
      this.handleLoadingFinished(params);
    };

    this.loadingFailedHandler = (params: unknown) => {
      this.handleLoadingFailed(params);
    };

    this.client.on('Network.requestWillBeSent', this.requestWillBeSentHandler);
    this.client.on('Network.responseReceived', this.responseReceivedHandler);
    this.client.on('Network.loadingFinished', this.loadingFinishedHandler);
    this.client.on('Network.loadingFailed', this.loadingFailedHandler);
    
    this.isMonitoring = true;
  }

  /**
   * Stop monitoring network requests
   */
  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      return;
    }

    if (this.requestWillBeSentHandler) {
      this.client.off('Network.requestWillBeSent', this.requestWillBeSentHandler);
      this.requestWillBeSentHandler = null;
    }

    if (this.responseReceivedHandler) {
      this.client.off('Network.responseReceived', this.responseReceivedHandler);
      this.responseReceivedHandler = null;
    }

    if (this.loadingFinishedHandler) {
      this.client.off('Network.loadingFinished', this.loadingFinishedHandler);
      this.loadingFinishedHandler = null;
    }

    if (this.loadingFailedHandler) {
      this.client.off('Network.loadingFailed', this.loadingFailedHandler);
      this.loadingFailedHandler = null;
    }

    this.isMonitoring = false;
  }

  /**
   * Get all captured network requests
   */
  getRequests(filter?: NetworkRequestFilter): NetworkRequest[] {
    let filteredRequests = [...this.completedRequests];

    if (filter) {
      // Filter by HTTP methods
      if (filter.methods && filter.methods.length > 0) {
        filteredRequests = filteredRequests.filter(req => 
          filter.methods!.includes(req.method.toUpperCase())
        );
      }

      // Filter by URL pattern
      if (filter.urlPattern) {
        const pattern = new RegExp(filter.urlPattern, 'i');
        filteredRequests = filteredRequests.filter(req => 
          pattern.test(req.url)
        );
      }

      // Filter by status codes
      if (filter.statusCodes && filter.statusCodes.length > 0) {
        filteredRequests = filteredRequests.filter(req => 
          req.status && filter.statusCodes!.includes(req.status)
        );
      }

      // Filter by time range
      if (filter.startTime) {
        filteredRequests = filteredRequests.filter(req => 
          req.timestamp >= filter.startTime!
        );
      }

      if (filter.endTime) {
        filteredRequests = filteredRequests.filter(req => 
          req.timestamp <= filter.endTime!
        );
      }

      // Limit number of requests
      if (filter.maxRequests && filter.maxRequests > 0) {
        filteredRequests = filteredRequests.slice(-filter.maxRequests);
      }
    }

    return filteredRequests;
  }

  /**
   * Get the most recent network request
   */
  getLatestRequest(filter?: NetworkRequestFilter): NetworkRequest | null {
    const requests = this.getRequests(filter);
    return requests.length > 0 ? requests[requests.length - 1] : null;
  }

  /**
   * Clear all stored network requests
   */
  clearRequests(): void {
    this.requests.clear();
    this.completedRequests = [];
  }

  /**
   * Get the number of stored requests
   */
  getRequestCount(filter?: NetworkRequestFilter): number {
    return this.getRequests(filter).length;
  }

  /**
   * Check if monitoring is active
   */
  isActive(): boolean {
    return this.isMonitoring;
  }

  /**
   * Handle Network.requestWillBeSent events from CDP
   */
  private handleRequestWillBeSent(params: unknown): void {
    try {
      const requestParams = params as {
        requestId: string;
        loaderId: string;
        documentURL: string;
        request: {
          url: string;
          method: string;
          headers: Record<string, string>;
          postData?: string;
        };
        timestamp: number;
        wallTime: number;
        initiator: unknown;
        type?: string;
      };

      // Create network request object
      const networkRequest: NetworkRequest = {
        requestId: requestParams.requestId,
        url: requestParams.request.url,
        method: requestParams.request.method,
        headers: requestParams.request.headers,
        timestamp: requestParams.wallTime * 1000, // Convert to milliseconds
      };

      // Store the request for later matching with response
      this.requests.set(requestParams.requestId, networkRequest);
    } catch (error) {
      console.error('Error handling requestWillBeSent:', error);
    }
  }

  /**
   * Handle Network.responseReceived events from CDP
   */
  private handleResponseReceived(params: unknown): void {
    try {
      const responseParams = params as {
        requestId: string;
        loaderId: string;
        timestamp: number;
        type: string;
        response: {
          url: string;
          status: number;
          statusText: string;
          headers: Record<string, string>;
          mimeType: string;
          connectionReused: boolean;
          connectionId: number;
          remoteIPAddress?: string;
          remotePort?: number;
          fromDiskCache?: boolean;
          fromServiceWorker?: boolean;
          encodedDataLength: number;
        };
      };

      // Find the matching request
      const request = this.requests.get(responseParams.requestId);
      if (request) {
        // Update request with response information
        request.status = responseParams.response.status;
        request.responseHeaders = responseParams.response.headers;
      }
    } catch (error) {
      console.error('Error handling responseReceived:', error);
    }
  }

  /**
   * Handle Network.loadingFinished events from CDP
   */
  private handleLoadingFinished(params: unknown): void {
    try {
      const loadingParams = params as {
        requestId: string;
        timestamp: number;
        encodedDataLength: number;
      };

      // Move completed request to completed list
      const request = this.requests.get(loadingParams.requestId);
      if (request) {
        this.completedRequests.push(request);
        this.requests.delete(loadingParams.requestId);

        // Limit stored requests to prevent memory issues (keep last 1000)
        if (this.completedRequests.length > 1000) {
          this.completedRequests = this.completedRequests.slice(-1000);
        }
      }
    } catch (error) {
      console.error('Error handling loadingFinished:', error);
    }
  }

  /**
   * Handle Network.loadingFailed events from CDP
   */
  private handleLoadingFailed(params: unknown): void {
    try {
      const failedParams = params as {
        requestId: string;
        timestamp: number;
        type: string;
        errorText: string;
        canceled?: boolean;
      };

      // Move failed request to completed list with error information
      const request = this.requests.get(failedParams.requestId);
      if (request) {
        // Mark as failed request (status 0 typically indicates network error)
        request.status = 0;
        this.completedRequests.push(request);
        this.requests.delete(failedParams.requestId);

        // Limit stored requests to prevent memory issues (keep last 1000)
        if (this.completedRequests.length > 1000) {
          this.completedRequests = this.completedRequests.slice(-1000);
        }
      }
    } catch (error) {
      console.error('Error handling loadingFailed:', error);
    }
  }
}
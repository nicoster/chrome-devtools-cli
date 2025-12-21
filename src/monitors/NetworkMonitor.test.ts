import { NetworkMonitor } from './NetworkMonitor';
import { CDPClient } from '../types';

// Mock CDPClient for testing
class MockCDPClient implements CDPClient {
  private eventListeners = new Map<string, Array<(params: unknown) => void>>();
  private isNetworkEnabled = false;

  async connect(): Promise<void> {
    // Mock implementation
  }

  async disconnect(): Promise<void> {
    // Mock implementation
  }

  async send(method: string, _params?: unknown): Promise<unknown> {
    if (method === 'Network.enable') {
      this.isNetworkEnabled = true;
      return {};
    }
    return {};
  }

  on(event: string, callback: (params: unknown) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: (params: unknown) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // Helper methods to simulate network events
  simulateRequestWillBeSent(params: unknown): void {
    const listeners = this.eventListeners.get('Network.requestWillBeSent');
    if (listeners) {
      listeners.forEach(callback => callback(params));
    }
  }

  simulateResponseReceived(params: unknown): void {
    const listeners = this.eventListeners.get('Network.responseReceived');
    if (listeners) {
      listeners.forEach(callback => callback(params));
    }
  }

  simulateLoadingFinished(params: unknown): void {
    const listeners = this.eventListeners.get('Network.loadingFinished');
    if (listeners) {
      listeners.forEach(callback => callback(params));
    }
  }

  simulateLoadingFailed(params: unknown): void {
    const listeners = this.eventListeners.get('Network.loadingFailed');
    if (listeners) {
      listeners.forEach(callback => callback(params));
    }
  }

  isNetworkEnabledForTest(): boolean {
    return this.isNetworkEnabled;
  }
}

describe('NetworkMonitor', () => {
  let mockClient: MockCDPClient;
  let networkMonitor: NetworkMonitor;

  beforeEach(() => {
    mockClient = new MockCDPClient();
    networkMonitor = new NetworkMonitor(mockClient);
  });

  afterEach(async () => {
    await networkMonitor.stopMonitoring();
  });

  describe('startMonitoring', () => {
    it('should enable Network domain and start monitoring', async () => {
      expect(networkMonitor.isActive()).toBe(false);
      
      await networkMonitor.startMonitoring();
      
      expect(networkMonitor.isActive()).toBe(true);
      expect(mockClient.isNetworkEnabledForTest()).toBe(true);
    });

    it('should not start monitoring twice', async () => {
      await networkMonitor.startMonitoring();
      expect(networkMonitor.isActive()).toBe(true);
      
      // Should not throw or cause issues
      await networkMonitor.startMonitoring();
      expect(networkMonitor.isActive()).toBe(true);
    });
  });

  describe('stopMonitoring', () => {
    it('should stop monitoring when active', async () => {
      await networkMonitor.startMonitoring();
      expect(networkMonitor.isActive()).toBe(true);
      
      await networkMonitor.stopMonitoring();
      expect(networkMonitor.isActive()).toBe(false);
    });

    it('should handle stopping when not monitoring', async () => {
      expect(networkMonitor.isActive()).toBe(false);
      
      // Should not throw
      await networkMonitor.stopMonitoring();
      expect(networkMonitor.isActive()).toBe(false);
    });
  });

  describe('request handling', () => {
    beforeEach(async () => {
      await networkMonitor.startMonitoring();
    });

    it('should capture network requests and responses', () => {
      const requestId = 'request-123';
      const timestamp = Date.now() / 1000; // CDP uses seconds

      // Simulate request
      mockClient.simulateRequestWillBeSent({
        requestId,
        loaderId: 'loader-1',
        documentURL: 'http://example.com',
        request: {
          url: 'http://api.example.com/data',
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Chrome'
          }
        },
        timestamp,
        wallTime: timestamp
      });

      // Simulate response
      mockClient.simulateResponseReceived({
        requestId,
        loaderId: 'loader-1',
        timestamp: timestamp + 0.1,
        type: 'XHR',
        response: {
          url: 'http://api.example.com/data',
          status: 200,
          statusText: 'OK',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': '1234'
          },
          mimeType: 'application/json',
          connectionReused: false,
          connectionId: 1,
          encodedDataLength: 1234
        }
      });

      // Simulate loading finished
      mockClient.simulateLoadingFinished({
        requestId,
        timestamp: timestamp + 0.2,
        encodedDataLength: 1234
      });

      const requests = networkMonitor.getRequests();
      expect(requests).toHaveLength(1);
      expect(requests[0].requestId).toBe(requestId);
      expect(requests[0].url).toBe('http://api.example.com/data');
      expect(requests[0].method).toBe('GET');
      expect(requests[0].status).toBe(200);
      expect(requests[0].headers['Accept']).toBe('application/json');
      expect(requests[0].responseHeaders!['Content-Type']).toBe('application/json');
    });

    it('should handle failed requests', () => {
      const requestId = 'request-failed';
      const timestamp = Date.now() / 1000;

      // Simulate request
      mockClient.simulateRequestWillBeSent({
        requestId,
        loaderId: 'loader-1',
        documentURL: 'http://example.com',
        request: {
          url: 'http://api.example.com/error',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        },
        timestamp,
        wallTime: timestamp
      });

      // Simulate loading failed
      mockClient.simulateLoadingFailed({
        requestId,
        timestamp: timestamp + 0.1,
        type: 'XHR',
        errorText: 'net::ERR_CONNECTION_REFUSED',
        canceled: false
      });

      const requests = networkMonitor.getRequests();
      expect(requests).toHaveLength(1);
      expect(requests[0].requestId).toBe(requestId);
      expect(requests[0].status).toBe(0); // Failed requests have status 0
    });

    it('should handle multiple concurrent requests', () => {
      const timestamp = Date.now() / 1000;
      const requests = [
        { id: 'req-1', url: 'http://api.example.com/users', method: 'GET', status: 200 },
        { id: 'req-2', url: 'http://api.example.com/posts', method: 'GET', status: 404 },
        { id: 'req-3', url: 'http://api.example.com/comments', method: 'POST', status: 201 }
      ];

      // Simulate all requests
      requests.forEach((req, index) => {
        const reqTimestamp = timestamp + index * 0.1;
        
        mockClient.simulateRequestWillBeSent({
          requestId: req.id,
          loaderId: 'loader-1',
          documentURL: 'http://example.com',
          request: {
            url: req.url,
            method: req.method,
            headers: {}
          },
          timestamp: reqTimestamp,
          wallTime: reqTimestamp
        });

        mockClient.simulateResponseReceived({
          requestId: req.id,
          loaderId: 'loader-1',
          timestamp: reqTimestamp + 0.05,
          type: 'XHR',
          response: {
            url: req.url,
            status: req.status,
            statusText: 'OK',
            headers: {},
            mimeType: 'application/json',
            connectionReused: false,
            connectionId: index + 1,
            encodedDataLength: 100
          }
        });

        mockClient.simulateLoadingFinished({
          requestId: req.id,
          timestamp: reqTimestamp + 0.1,
          encodedDataLength: 100
        });
      });

      const capturedRequests = networkMonitor.getRequests();
      expect(capturedRequests).toHaveLength(3);
      
      requests.forEach((expectedReq) => {
        const captured = capturedRequests.find(r => r.requestId === expectedReq.id);
        expect(captured).toBeDefined();
        expect(captured!.url).toBe(expectedReq.url);
        expect(captured!.method).toBe(expectedReq.method);
        expect(captured!.status).toBe(expectedReq.status);
      });
    });
  });

  describe('request filtering', () => {
    beforeEach(async () => {
      await networkMonitor.startMonitoring();
      
      // Add test requests
      const testRequests = [
        { id: 'req-1', url: 'http://api.example.com/users', method: 'GET', status: 200, time: 1000 },
        { id: 'req-2', url: 'http://api.example.com/posts', method: 'POST', status: 201, time: 2000 },
        { id: 'req-3', url: 'http://cdn.example.com/image.jpg', method: 'GET', status: 404, time: 3000 },
        { id: 'req-4', url: 'http://api.example.com/comments', method: 'DELETE', status: 500, time: 4000 }
      ];

      testRequests.forEach(req => {
        const timestamp = req.time / 1000;
        
        mockClient.simulateRequestWillBeSent({
          requestId: req.id,
          loaderId: 'loader-1',
          documentURL: 'http://example.com',
          request: {
            url: req.url,
            method: req.method,
            headers: {}
          },
          timestamp,
          wallTime: timestamp
        });

        mockClient.simulateResponseReceived({
          requestId: req.id,
          loaderId: 'loader-1',
          timestamp: timestamp + 0.1,
          type: 'XHR',
          response: {
            url: req.url,
            status: req.status,
            statusText: 'OK',
            headers: {},
            mimeType: 'application/json',
            connectionReused: false,
            connectionId: 1,
            encodedDataLength: 100
          }
        });

        mockClient.simulateLoadingFinished({
          requestId: req.id,
          timestamp: timestamp + 0.2,
          encodedDataLength: 100
        });
      });
    });

    it('should filter requests by HTTP method', () => {
      const getRequests = networkMonitor.getRequests({ methods: ['GET'] });
      expect(getRequests).toHaveLength(2);
      expect(getRequests.every(req => req.method === 'GET')).toBe(true);

      const postRequests = networkMonitor.getRequests({ methods: ['POST', 'DELETE'] });
      expect(postRequests).toHaveLength(2);
    });

    it('should filter requests by URL pattern', () => {
      const apiRequests = networkMonitor.getRequests({ urlPattern: 'api\\.example\\.com' });
      expect(apiRequests).toHaveLength(3);

      const imageRequests = networkMonitor.getRequests({ urlPattern: '\\.jpg$' });
      expect(imageRequests).toHaveLength(1);
      expect(imageRequests[0].url).toContain('image.jpg');
    });

    it('should filter requests by status code', () => {
      const successRequests = networkMonitor.getRequests({ statusCodes: [200, 201] });
      expect(successRequests).toHaveLength(2);

      const errorRequests = networkMonitor.getRequests({ statusCodes: [404, 500] });
      expect(errorRequests).toHaveLength(2);
    });

    it('should filter requests by time range', () => {
      const recentRequests = networkMonitor.getRequests({ startTime: 2500 });
      expect(recentRequests).toHaveLength(2);

      const earlyRequests = networkMonitor.getRequests({ endTime: 2500 });
      expect(earlyRequests).toHaveLength(2);
    });

    it('should limit number of requests', () => {
      const limitedRequests = networkMonitor.getRequests({ maxRequests: 2 });
      expect(limitedRequests).toHaveLength(2);
      // Should return the last 2 requests
      expect(limitedRequests[0].requestId).toBe('req-3');
      expect(limitedRequests[1].requestId).toBe('req-4');
    });
  });

  describe('getLatestRequest', () => {
    beforeEach(async () => {
      await networkMonitor.startMonitoring();
    });

    it('should return null when no requests', () => {
      const latest = networkMonitor.getLatestRequest();
      expect(latest).toBeNull();
    });

    it('should return the latest request', () => {
      const timestamp = Date.now() / 1000;

      // First request
      mockClient.simulateRequestWillBeSent({
        requestId: 'req-1',
        loaderId: 'loader-1',
        documentURL: 'http://example.com',
        request: {
          url: 'http://api.example.com/first',
          method: 'GET',
          headers: {}
        },
        timestamp,
        wallTime: timestamp
      });

      mockClient.simulateLoadingFinished({
        requestId: 'req-1',
        timestamp: timestamp + 0.1,
        encodedDataLength: 100
      });

      // Second request (latest)
      mockClient.simulateRequestWillBeSent({
        requestId: 'req-2',
        loaderId: 'loader-1',
        documentURL: 'http://example.com',
        request: {
          url: 'http://api.example.com/latest',
          method: 'POST',
          headers: {}
        },
        timestamp: timestamp + 1,
        wallTime: timestamp + 1
      });

      mockClient.simulateLoadingFinished({
        requestId: 'req-2',
        timestamp: timestamp + 1.1,
        encodedDataLength: 200
      });

      const latest = networkMonitor.getLatestRequest();
      expect(latest).not.toBeNull();
      expect(latest!.requestId).toBe('req-2');
      expect(latest!.url).toBe('http://api.example.com/latest');
      expect(latest!.method).toBe('POST');
    });

    it('should return the latest request matching filter', () => {
      const timestamp = Date.now() / 1000;

      // GET request
      mockClient.simulateRequestWillBeSent({
        requestId: 'req-get',
        loaderId: 'loader-1',
        documentURL: 'http://example.com',
        request: {
          url: 'http://api.example.com/get',
          method: 'GET',
          headers: {}
        },
        timestamp,
        wallTime: timestamp
      });

      mockClient.simulateLoadingFinished({
        requestId: 'req-get',
        timestamp: timestamp + 0.1,
        encodedDataLength: 100
      });

      // POST request (later)
      mockClient.simulateRequestWillBeSent({
        requestId: 'req-post',
        loaderId: 'loader-1',
        documentURL: 'http://example.com',
        request: {
          url: 'http://api.example.com/post',
          method: 'POST',
          headers: {}
        },
        timestamp: timestamp + 1,
        wallTime: timestamp + 1
      });

      mockClient.simulateLoadingFinished({
        requestId: 'req-post',
        timestamp: timestamp + 1.1,
        encodedDataLength: 200
      });

      const latestGet = networkMonitor.getLatestRequest({ methods: ['GET'] });
      expect(latestGet).not.toBeNull();
      expect(latestGet!.requestId).toBe('req-get');
      expect(latestGet!.method).toBe('GET');
    });
  });

  describe('clearRequests', () => {
    it('should clear all stored requests', async () => {
      await networkMonitor.startMonitoring();
      
      const timestamp = Date.now() / 1000;
      mockClient.simulateRequestWillBeSent({
        requestId: 'req-1',
        loaderId: 'loader-1',
        documentURL: 'http://example.com',
        request: {
          url: 'http://api.example.com/test',
          method: 'GET',
          headers: {}
        },
        timestamp,
        wallTime: timestamp
      });

      mockClient.simulateLoadingFinished({
        requestId: 'req-1',
        timestamp: timestamp + 0.1,
        encodedDataLength: 100
      });

      expect(networkMonitor.getRequestCount()).toBe(1);
      
      networkMonitor.clearRequests();
      expect(networkMonitor.getRequestCount()).toBe(0);
    });
  });

  describe('getRequestCount', () => {
    beforeEach(async () => {
      await networkMonitor.startMonitoring();
    });

    it('should return correct request count', () => {
      expect(networkMonitor.getRequestCount()).toBe(0);

      const timestamp = Date.now() / 1000;
      
      // Add two requests
      ['req-1', 'req-2'].forEach((requestId, index) => {
        const reqTimestamp = timestamp + index;
        
        mockClient.simulateRequestWillBeSent({
          requestId,
          loaderId: 'loader-1',
          documentURL: 'http://example.com',
          request: {
            url: `http://api.example.com/${requestId}`,
            method: 'GET',
            headers: {}
          },
          timestamp: reqTimestamp,
          wallTime: reqTimestamp
        });

        mockClient.simulateLoadingFinished({
          requestId,
          timestamp: reqTimestamp + 0.1,
          encodedDataLength: 100
        });
      });

      expect(networkMonitor.getRequestCount()).toBe(2);
    });

    it('should return filtered request count', () => {
      const timestamp = Date.now() / 1000;
      
      // Add GET request
      mockClient.simulateRequestWillBeSent({
        requestId: 'req-get',
        loaderId: 'loader-1',
        documentURL: 'http://example.com',
        request: {
          url: 'http://api.example.com/get',
          method: 'GET',
          headers: {}
        },
        timestamp,
        wallTime: timestamp
      });

      mockClient.simulateLoadingFinished({
        requestId: 'req-get',
        timestamp: timestamp + 0.1,
        encodedDataLength: 100
      });

      // Add POST request
      mockClient.simulateRequestWillBeSent({
        requestId: 'req-post',
        loaderId: 'loader-1',
        documentURL: 'http://example.com',
        request: {
          url: 'http://api.example.com/post',
          method: 'POST',
          headers: {}
        },
        timestamp: timestamp + 1,
        wallTime: timestamp + 1
      });

      mockClient.simulateLoadingFinished({
        requestId: 'req-post',
        timestamp: timestamp + 1.1,
        encodedDataLength: 200
      });

      expect(networkMonitor.getRequestCount({ methods: ['GET'] })).toBe(1);
      expect(networkMonitor.getRequestCount({ urlPattern: 'post' })).toBe(1);
    });
  });
});
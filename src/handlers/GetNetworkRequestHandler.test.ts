import { GetNetworkRequestHandler } from './GetNetworkRequestHandler';
import { NetworkMonitor } from '../monitors/NetworkMonitor';
import { CDPClient, NetworkRequest } from '../types';

// Mock CDPClient for testing
class MockCDPClient implements CDPClient {
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async send(): Promise<unknown> { return {}; }
  on(): void {}
  off(): void {}
}

// Mock NetworkMonitor for testing
class MockNetworkMonitor extends NetworkMonitor {
  private mockRequests: NetworkRequest[] = [];
  private mockIsActive = false;

  constructor() {
    super(new MockCDPClient());
  }

  async startMonitoring(): Promise<void> {
    this.mockIsActive = true;
  }

  async stopMonitoring(): Promise<void> {
    this.mockIsActive = false;
  }

  getLatestRequest(): NetworkRequest | null {
    return this.mockRequests.length > 0 ? this.mockRequests[this.mockRequests.length - 1] : null;
  }

  isActive(): boolean {
    return this.mockIsActive;
  }

  // Test helper methods
  addMockRequest(request: NetworkRequest): void {
    this.mockRequests.push(request);
  }

  clearMockRequests(): void {
    this.mockRequests = [];
  }
}

describe('GetNetworkRequestHandler', () => {
  let handler: GetNetworkRequestHandler;
  let mockClient: MockCDPClient;
  let mockMonitor: MockNetworkMonitor;

  beforeEach(() => {
    handler = new GetNetworkRequestHandler();
    mockClient = new MockCDPClient();
    mockMonitor = new MockNetworkMonitor();
    handler.setNetworkMonitor(mockMonitor);
  });

  describe('execute', () => {
    it('should return null when no requests are available', async () => {
      const result = await handler.execute(mockClient, {});

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('should return the latest network request', async () => {
      const mockRequest: NetworkRequest = {
        requestId: 'req-123',
        url: 'http://api.example.com/data',
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        timestamp: Date.now(),
        status: 200,
        responseHeaders: {
          'Content-Type': 'application/json'
        }
      };

      mockMonitor.addMockRequest(mockRequest);

      const result = await handler.execute(mockClient, {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockRequest);
    });

    it('should handle filter parameters', async () => {
      const mockRequest: NetworkRequest = {
        requestId: 'req-456',
        url: 'http://api.example.com/users',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        timestamp: Date.now(),
        status: 201
      };

      mockMonitor.addMockRequest(mockRequest);

      const args = {
        filter: {
          methods: ['POST'],
          urlPattern: 'users',
          statusCodes: [201]
        }
      };

      const result = await handler.execute(mockClient, args);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockRequest);
    });

    it('should initialize network monitor if not already done', async () => {
      const newHandler = new GetNetworkRequestHandler();
      expect(newHandler.getNetworkMonitor()).toBeNull();

      await newHandler.execute(mockClient, {});

      expect(newHandler.getNetworkMonitor()).not.toBeNull();
    });

    it('should handle errors gracefully', async () => {
      // Create a mock monitor that throws an error on getLatestRequest
      const errorMonitor = {
        isActive: jest.fn().mockReturnValue(true),
        startMonitoring: jest.fn().mockResolvedValue(undefined),
        getLatestRequest: jest.fn().mockImplementation(() => {
          throw new Error('Network error');
        })
      } as unknown as NetworkMonitor;

      const newHandler = new GetNetworkRequestHandler();
      newHandler.setNetworkMonitor(errorMonitor);

      const result = await newHandler.execute(mockClient, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle unknown errors', async () => {
      // Create a mock monitor that throws a non-Error object
      const errorMonitor = {
        isActive: jest.fn().mockReturnValue(true),
        startMonitoring: jest.fn().mockResolvedValue(undefined),
        getLatestRequest: jest.fn().mockImplementation(() => {
          throw 'String error';
        })
      } as unknown as NetworkMonitor;

      const newHandler = new GetNetworkRequestHandler();
      newHandler.setNetworkMonitor(errorMonitor);

      const result = await newHandler.execute(mockClient, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error occurred');
    });
  });

  describe('getNetworkMonitor and setNetworkMonitor', () => {
    it('should get and set network monitor', () => {
      const newHandler = new GetNetworkRequestHandler();
      expect(newHandler.getNetworkMonitor()).toBeNull();

      newHandler.setNetworkMonitor(mockMonitor);
      expect(newHandler.getNetworkMonitor()).toBe(mockMonitor);
    });
  });
});
import { ListNetworkRequestsHandler } from './ListNetworkRequestsHandler';
import { NetworkMonitor } from '../monitors/NetworkMonitor';
import { CDPClient, NetworkRequest } from '../types';

// Mock ProxyClient
jest.mock('../client/ProxyClient', () => {
  return {
    ProxyClient: jest.fn().mockImplementation(() => ({
      isProxyAvailable: jest.fn().mockResolvedValue(false),
      ensureProxyRunning: jest.fn().mockResolvedValue(false),
      getConnectionId: jest.fn().mockReturnValue(null),
      connect: jest.fn().mockResolvedValue(undefined),
      getNetworkRequests: jest.fn().mockResolvedValue([])
    }))
  };
});

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

  getRequests(): NetworkRequest[] {
    return [...this.mockRequests];
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

describe('ListNetworkRequestsHandler', () => {
  let handler: ListNetworkRequestsHandler;
  let mockClient: MockCDPClient;
  let mockMonitor: MockNetworkMonitor;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    handler = new ListNetworkRequestsHandler();
    mockClient = new MockCDPClient();
    mockMonitor = new MockNetworkMonitor();
    handler.setNetworkMonitor(mockMonitor);
    
    // Suppress console.warn during tests
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('execute', () => {
    it('should return empty list when no requests are available', async () => {
      const result = await handler.execute(mockClient, {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        requests: [],
        count: 0,
        isMonitoring: true // After startMonitoring is called
      });
    });

    it('should return all network requests', async () => {
      const mockRequests: NetworkRequest[] = [
        {
          requestId: 'req-1',
          url: 'http://api.example.com/users',
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          timestamp: Date.now() - 2000,
          status: 200,
          responseHeaders: { 'Content-Type': 'application/json' }
        },
        {
          requestId: 'req-2',
          url: 'http://api.example.com/posts',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          timestamp: Date.now() - 1000,
          status: 201
        },
        {
          requestId: 'req-3',
          url: 'http://cdn.example.com/image.jpg',
          method: 'GET',
          headers: { 'Accept': 'image/*' },
          timestamp: Date.now(),
          status: 404
        }
      ];

      mockRequests.forEach(req => mockMonitor.addMockRequest(req));

      const result = await handler.execute(mockClient, {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        requests: mockRequests,
        count: 3,
        isMonitoring: true // After startMonitoring is called
      });
    });

    it('should handle filter parameters', async () => {
      const mockRequests: NetworkRequest[] = [
        {
          requestId: 'req-get',
          url: 'http://api.example.com/users',
          method: 'GET',
          headers: {},
          timestamp: Date.now() - 1000,
          status: 200
        },
        {
          requestId: 'req-post',
          url: 'http://api.example.com/posts',
          method: 'POST',
          headers: {},
          timestamp: Date.now(),
          status: 201
        }
      ];

      mockRequests.forEach(req => mockMonitor.addMockRequest(req));

      const args = {
        filter: {
          methods: ['GET'],
          urlPattern: 'users',
          statusCodes: [200],
          maxRequests: 10,
          startTime: Date.now() - 2000,
          endTime: Date.now()
        }
      };

      const result = await handler.execute(mockClient, args);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        requests: mockRequests, // Mock doesn't actually filter, but structure is correct
        count: 2,
        isMonitoring: true // After startMonitoring is called
      });
    });

    it('should initialize network monitor if not already done', async () => {
      const newHandler = new ListNetworkRequestsHandler();
      expect(newHandler.getNetworkMonitor()).toBeNull();

      await newHandler.execute(mockClient, {});

      expect(newHandler.getNetworkMonitor()).not.toBeNull();
    });

    it('should handle errors gracefully', async () => {
      // Create a mock monitor that throws an error on getRequests
      const errorMonitor = {
        isActive: jest.fn().mockReturnValue(true),
        startMonitoring: jest.fn().mockResolvedValue(undefined),
        getRequests: jest.fn().mockImplementation(() => {
          throw new Error('Network error');
        })
      } as unknown as NetworkMonitor;

      const newHandler = new ListNetworkRequestsHandler();
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
        getRequests: jest.fn().mockImplementation(() => {
          throw 'String error';
        })
      } as unknown as NetworkMonitor;

      const newHandler = new ListNetworkRequestsHandler();
      newHandler.setNetworkMonitor(errorMonitor);

      const result = await newHandler.execute(mockClient, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error occurred');
    });

    it('should return correct monitoring status', async () => {
      // Test when monitoring is active
      await mockMonitor.startMonitoring();
      let result = await handler.execute(mockClient, {});
      expect((result.data as any).isMonitoring).toBe(true);

      // Test when monitoring is stopped - but handler will restart it
      await mockMonitor.stopMonitoring();
      result = await handler.execute(mockClient, {});
      expect((result.data as any).isMonitoring).toBe(true); // Handler restarts monitoring
    });
  });

  describe('getNetworkMonitor and setNetworkMonitor', () => {
    it('should get and set network monitor', () => {
      const newHandler = new ListNetworkRequestsHandler();
      expect(newHandler.getNetworkMonitor()).toBeNull();

      newHandler.setNetworkMonitor(mockMonitor);
      expect(newHandler.getNetworkMonitor()).toBe(mockMonitor);
    });
  });
});
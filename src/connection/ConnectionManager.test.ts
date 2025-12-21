import { ConnectionManager } from './ConnectionManager';
import { BrowserTarget } from '../types';
import { Logger } from '../utils/logger';

// Mock the http module
jest.mock('http', () => ({
  get: jest.fn()
}));

describe('ConnectionManager', () => {
  let connectionManager: ConnectionManager;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;
    connectionManager = new ConnectionManager(mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('discoverTargets', () => {
    it('should discover targets from Chrome DevTools endpoint', async () => {
      const mockTargets: BrowserTarget[] = [
        {
          id: 'target-1',
          type: 'page',
          title: 'Test Page',
          url: 'https://example.com',
          webSocketDebuggerUrl: 'ws://localhost:9222/devtools/page/target-1'
        },
        {
          id: 'target-2',
          type: 'page',
          title: 'Another Page',
          url: 'https://google.com',
          webSocketDebuggerUrl: 'ws://localhost:9222/devtools/page/target-2'
        }
      ];

      // Mock the http.get function
      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify(mockTargets));
          } else if (event === 'end') {
            callback();
          }
        })
      };

      const mockRequest = {
        on: jest.fn(),
        setTimeout: jest.fn()
      };

      const http = await import('http');
      (http.get as jest.Mock).mockImplementation((url, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const targets = await connectionManager.discoverTargets('localhost', 9222);

      expect(targets).toEqual(mockTargets);
      expect(http.get).toHaveBeenCalledWith('http://localhost:9222/json/list', expect.any(Function));
    });

    it('should filter out invalid targets', async () => {
      const mockTargets = [
        {
          id: 'target-1',
          type: 'page',
          title: 'Valid Page',
          url: 'https://example.com',
          webSocketDebuggerUrl: 'ws://localhost:9222/devtools/page/target-1'
        },
        {
          id: 'target-2',
          type: 'page',
          title: 'Invalid Page',
          url: 'https://google.com'
          // Missing webSocketDebuggerUrl
        },
        {
          // Missing id
          type: 'page',
          title: 'Another Invalid Page',
          url: 'https://test.com',
          webSocketDebuggerUrl: 'ws://localhost:9222/devtools/page/target-3'
        }
      ];

      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify(mockTargets));
          } else if (event === 'end') {
            callback();
          }
        })
      };

      const mockRequest = {
        on: jest.fn(),
        setTimeout: jest.fn()
      };

      const http = await import('http');
      (http.get as jest.Mock).mockImplementation((url, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const targets = await connectionManager.discoverTargets('localhost', 9222);

      expect(targets).toHaveLength(1);
      expect(targets[0].id).toBe('target-1');
    });

    it('should handle HTTP errors', async () => {
      const mockResponse = {
        statusCode: 404,
        on: jest.fn((event, callback) => {
          if (event === 'end') {
            callback();
          }
        })
      };

      const mockRequest = {
        on: jest.fn(),
        setTimeout: jest.fn()
      };

      const http = await import('http');
      (http.get as jest.Mock).mockImplementation((url, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      await expect(connectionManager.discoverTargets('localhost', 9222))
        .rejects.toThrow('HTTP 404: Failed to discover targets');
    });

    it('should handle connection errors', async () => {
      const mockRequest = {
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            callback(new Error('Connection refused'));
          }
        }),
        setTimeout: jest.fn()
      };

      const http = await import('http');
      (http.get as jest.Mock).mockImplementation(() => {
        return mockRequest;
      });

      await expect(connectionManager.discoverTargets('localhost', 9222))
        .rejects.toThrow('Failed to connect to Chrome DevTools at http://localhost:9222/json/list: Connection refused');
    });
  });

  describe('getActiveConnections', () => {
    it('should return empty array initially', () => {
      const connections = connectionManager.getActiveConnections();
      expect(connections).toEqual([]);
    });
  });

  describe('closeAllConnections', () => {
    it('should close all connections successfully', async () => {
      await connectionManager.closeAllConnections();
      expect(mockLogger.info).toHaveBeenCalledWith('All connections closed');
    });
  });

  describe('reconnect', () => {
    it('should throw error for unimplemented reconnection', async () => {
      const mockClient = {
        connect: jest.fn(),
        disconnect: jest.fn(),
        send: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        isConnected: jest.fn().mockReturnValue(false),
        getConnectionStatus: jest.fn().mockReturnValue('disconnected')
      };

      await expect(connectionManager.reconnect(mockClient, 3))
        .rejects.toThrow('Failed to reconnect after 3 attempts');
    });

    it('should return immediately if client is already connected', async () => {
      const mockClient = {
        connect: jest.fn(),
        disconnect: jest.fn(),
        send: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        isConnected: jest.fn().mockReturnValue(true),
        getConnectionStatus: jest.fn().mockReturnValue('connected')
      };

      await expect(connectionManager.reconnect(mockClient, 3)).resolves.toBeUndefined();
      expect(mockClient.isConnected).toHaveBeenCalled();
    });
  });
});
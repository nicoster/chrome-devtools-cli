/**
 * Tests for WebSocket Proxy Implementation
 */

import * as WebSocket from 'ws';
import { WebSocketServer } from 'ws';
import { WSProxy } from './WSProxy';
import { ConnectionPool } from './ConnectionPool';
import { CDPConnectionInfo } from '../types/ProxyTypes';

// Mock the Logger
jest.mock('../../utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('WSProxy', () => {
  let wsProxy: WSProxy;
  let mockConnectionPool: jest.Mocked<ConnectionPool>;
  let mockWsServer: jest.Mocked<WebSocketServer>;

  beforeEach(() => {
    // Create mock connection pool
    mockConnectionPool = {
      getConnectionInfo: jest.fn(),
      decrementClientCount: jest.fn()
    } as any;

    wsProxy = new WSProxy(mockConnectionPool);

    // Create mock WebSocket server
    mockWsServer = {
      on: jest.fn(),
      close: jest.fn()
    } as any;
  });

  describe('start', () => {
    it('should start WebSocket server and set up connection handler', () => {
      wsProxy.start(mockWsServer);

      expect(mockWsServer.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });

  describe('stop', () => {
    it('should close all connections and stop server', () => {
      wsProxy.start(mockWsServer);
      wsProxy.stop();

      expect(mockWsServer.close).toHaveBeenCalled();
    });
  });

  describe('handleConnection', () => {
    let mockClientWs: any;
    let mockRequest: any;

    beforeEach(() => {
      mockClientWs = {
        close: jest.fn(),
        send: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        readyState: 1 // WebSocket.OPEN = 1
      };

      mockRequest = {
        url: '/?connectionId=test-connection',
        headers: { host: 'localhost:9223' }
      } as any;
    });

    it('should reject connection without connection ID', () => {
      const requestWithoutId = {
        url: '/',
        headers: { host: 'localhost:9223' }
      } as any;
      
      wsProxy.handleConnection(mockClientWs as any as WebSocket, requestWithoutId);

      expect(mockClientWs.close).toHaveBeenCalledWith(1008, 'Connection ID required');
    });

    it('should reject connection with invalid connection ID', () => {
      mockConnectionPool.getConnectionInfo.mockReturnValue(null);
      
      wsProxy.handleConnection(mockClientWs as any as WebSocket, mockRequest);

      expect(mockClientWs.close).toHaveBeenCalledWith(1008, 'Invalid connection ID');
    });

    it('should reject connection with unhealthy CDP connection', () => {
      const mockCdpConnection = {
        id: 'test-connection',
        host: 'localhost',
        port: 9222,
        targetId: 'target-1',
        wsUrl: 'ws://localhost:9222/devtools/page/target-1',
        connection: {
          on: jest.fn(),
          off: jest.fn(),
          readyState: 1, // WebSocket.OPEN = 1
          isPaused: false,
          ping: jest.fn(),
          pong: jest.fn(),
          terminate: jest.fn(),
          close: jest.fn(),
          send: jest.fn()
        },
        createdAt: Date.now(),
        lastUsed: Date.now(),
        isHealthy: false, // Unhealthy connection
        clientCount: 0
      } as unknown as CDPConnectionInfo;

      mockConnectionPool.getConnectionInfo.mockReturnValue(mockCdpConnection);
      
      wsProxy.handleConnection(mockClientWs as any as WebSocket, mockRequest);

      expect(mockClientWs.close).toHaveBeenCalledWith(1011, 'CDP connection unavailable');
    });

    it('should establish proxy connection for valid connection ID', () => {
      const mockCdpConnection = {
        id: 'test-connection',
        host: 'localhost',
        port: 9222,
        targetId: 'target-1',
        wsUrl: 'ws://localhost:9222/devtools/page/target-1',
        connection: {
          on: jest.fn(),
          off: jest.fn(),
          readyState: 1 // WebSocket.OPEN = 1
        },
        createdAt: Date.now(),
        lastUsed: Date.now(),
        isHealthy: true, // Make sure it's healthy
        clientCount: 0
      } as unknown as CDPConnectionInfo;

      mockConnectionPool.getConnectionInfo.mockReturnValue(mockCdpConnection);
      
      wsProxy.handleConnection(mockClientWs as any as WebSocket, mockRequest);

      expect(mockClientWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"proxy-connected"')
      );
      expect(mockClientWs.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockClientWs.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockClientWs.on).toHaveBeenCalledWith('message', expect.any(Function));
    });
  });

  describe('event filtering', () => {
    it('should set client event filters', () => {
      // Create a mock proxy connection first
      const mockClientWs = {
        close: jest.fn(),
        send: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        readyState: 1 // WebSocket.OPEN = 1
      };

      const mockRequest = {
        url: '/?connectionId=test-connection',
        headers: { host: 'localhost:9223' }
      } as any;

      const mockCdpConnection = {
        id: 'test-connection',
        host: 'localhost',
        port: 9222,
        targetId: 'target-1',
        wsUrl: 'ws://localhost:9222/devtools/page/target-1',
        connection: {
          on: jest.fn(),
          off: jest.fn(),
          readyState: 1 // WebSocket.OPEN = 1
        },
        createdAt: Date.now(),
        lastUsed: Date.now(),
        isHealthy: true,
        clientCount: 0
      } as unknown as CDPConnectionInfo;

      mockConnectionPool.getConnectionInfo.mockReturnValue(mockCdpConnection);
      wsProxy.handleConnection(mockClientWs as any as WebSocket, mockRequest);

      // Get the proxy ID from the connections
      const connections = wsProxy.getActiveProxyConnections();
      expect(connections).toHaveLength(1);
      
      const proxyId = connections[0].id;
      const eventMethods = ['Runtime.consoleAPICalled', 'Network.requestWillBeSent'];
      
      const result = wsProxy.setClientEventFilters(proxyId, eventMethods);
      expect(result).toBe(true);

      const filters = wsProxy.getClientEventFilters(proxyId);
      expect(filters).toEqual(eventMethods);
    });

    it('should clear client event filters', () => {
      // Similar setup as above
      const mockClientWs = {
        close: jest.fn(),
        send: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        readyState: 1 // WebSocket.OPEN = 1
      } as any;

      const mockRequest = {
        url: '/?connectionId=test-connection',
        headers: { host: 'localhost:9223' }
      } as any;

      const mockCdpConnection = {
        id: 'test-connection',
        host: 'localhost',
        port: 9222,
        targetId: 'target-1',
        wsUrl: 'ws://localhost:9222/devtools/page/target-1',
        connection: {
          on: jest.fn(),
          off: jest.fn(),
          readyState: 1 // WebSocket.OPEN = 1
        },
        createdAt: Date.now(),
        lastUsed: Date.now(),
        isHealthy: true,
        clientCount: 0
      } as unknown as CDPConnectionInfo;

      mockConnectionPool.getConnectionInfo.mockReturnValue(mockCdpConnection);
      wsProxy.handleConnection(mockClientWs as any as WebSocket, mockRequest);

      const connections = wsProxy.getActiveProxyConnections();
      const proxyId = connections[0].id;
      
      // Set some filters first
      wsProxy.setClientEventFilters(proxyId, ['Runtime.consoleAPICalled']);
      
      // Clear filters
      const result = wsProxy.clearClientEventFilters(proxyId);
      expect(result).toBe(true);

      const filters = wsProxy.getClientEventFilters(proxyId);
      expect(filters).toEqual([]);
    });
  });

  describe('getActiveProxyConnections', () => {
    it('should return empty array when no connections', () => {
      const connections = wsProxy.getActiveProxyConnections();
      expect(connections).toEqual([]);
    });
  });
});
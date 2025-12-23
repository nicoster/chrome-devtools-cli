/**
 * Tests for CommandExecutionService
 */

import { CommandExecutionService } from './CommandExecutionService';
import { ConnectionPool } from './ConnectionPool';
import { CDPConnectionInfo, CommandExecutionRequest } from '../types/ProxyTypes';
import WebSocket from 'ws';

// Mock WebSocket
jest.mock('ws');

// Mock ConnectionPool
jest.mock('./ConnectionPool');

// Mock logger
jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  })
}));

describe('CommandExecutionService', () => {
  let commandExecutionService: CommandExecutionService;
  let mockConnectionPool: jest.Mocked<ConnectionPool>;
  let mockWebSocket: jest.Mocked<WebSocket>;

  beforeEach(() => {
    // Create mock WebSocket
    mockWebSocket = {
      send: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      readyState: WebSocket.OPEN
    } as any;

    // Create mock connection pool
    mockConnectionPool = {
      getConnectionInfo: jest.fn()
    } as any;

    commandExecutionService = new CommandExecutionService(mockConnectionPool);
  });

  afterEach(() => {
    commandExecutionService.cleanup();
    jest.clearAllMocks();
  });

  describe('executeCommand', () => {
    it('should execute CDP command successfully', async () => {
      // Setup mock connection
      const mockConnection: CDPConnectionInfo = {
        id: 'test-connection',
        host: 'localhost',
        port: 9222,
        targetId: 'test-target',
        wsUrl: 'ws://localhost:9222/devtools/page/test-target',
        connection: mockWebSocket,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        isHealthy: true,
        clientCount: 1
      };

      mockConnectionPool.getConnectionInfo.mockReturnValue(mockConnection);

      // Setup WebSocket to simulate CDP response
      let messageHandler: (data: WebSocket.Data) => void;
      mockWebSocket.on.mockImplementation((event: string | symbol, handler: any) => {
        if (event === 'message') {
          messageHandler = handler;
        }
        return mockWebSocket;
      });

      // Create command execution request
      const request: CommandExecutionRequest = {
        connectionId: 'test-connection',
        command: {
          id: 1,
          method: 'Runtime.evaluate',
          params: { expression: '1 + 1' }
        },
        timeout: 5000
      };

      // Execute command (this will be async)
      const executePromise = commandExecutionService.executeCommand(request);

      // Simulate CDP response after a short delay
      setTimeout(() => {
        const cdpResponse = {
          id: 1,
          result: { type: 'number', value: 2 }
        };
        messageHandler(JSON.stringify(cdpResponse));
      }, 10);

      // Wait for execution to complete
      const result = await executePromise;

      // Verify result
      expect(result.success).toBe(true);
      expect(result.result).toEqual({ type: 'number', value: 2 });
      expect(result.executionTime).toBeGreaterThan(0);

      // Verify WebSocket send was called
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          id: 1,
          method: 'Runtime.evaluate',
          params: { expression: '1 + 1' }
        })
      );
    });

    it('should handle connection not found error', async () => {
      mockConnectionPool.getConnectionInfo.mockReturnValue(null);

      const request: CommandExecutionRequest = {
        connectionId: 'non-existent-connection',
        command: {
          id: 1,
          method: 'Runtime.evaluate',
          params: { expression: '1 + 1' }
        }
      };

      const result = await commandExecutionService.executeCommand(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(404);
      expect(result.error?.message).toContain('not found');
    });

    it('should handle unhealthy connection error', async () => {
      const mockConnection: CDPConnectionInfo = {
        id: 'test-connection',
        host: 'localhost',
        port: 9222,
        targetId: 'test-target',
        wsUrl: 'ws://localhost:9222/devtools/page/test-target',
        connection: mockWebSocket,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        isHealthy: false, // Unhealthy connection
        clientCount: 1
      };

      mockConnectionPool.getConnectionInfo.mockReturnValue(mockConnection);

      const request: CommandExecutionRequest = {
        connectionId: 'test-connection',
        command: {
          id: 1,
          method: 'Runtime.evaluate',
          params: { expression: '1 + 1' }
        }
      };

      const result = await commandExecutionService.executeCommand(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(503);
      expect(result.error?.message).toContain('not healthy');
    });

    it('should handle command timeout', async () => {
      const mockConnection: CDPConnectionInfo = {
        id: 'test-connection',
        host: 'localhost',
        port: 9222,
        targetId: 'test-target',
        wsUrl: 'ws://localhost:9222/devtools/page/test-target',
        connection: mockWebSocket,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        isHealthy: true,
        clientCount: 1
      };

      mockConnectionPool.getConnectionInfo.mockReturnValue(mockConnection);

      const request: CommandExecutionRequest = {
        connectionId: 'test-connection',
        command: {
          id: 1,
          method: 'Runtime.evaluate',
          params: { expression: '1 + 1' }
        },
        timeout: 100 // Very short timeout
      };

      const result = await commandExecutionService.executeCommand(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(408);
      expect(result.error?.message).toContain('timeout');
    }, 10000);

    it('should reject second CLI client when one is already active', async () => {
      const mockConnection: CDPConnectionInfo = {
        id: 'test-connection',
        host: 'localhost',
        port: 9222,
        targetId: 'test-target',
        wsUrl: 'ws://localhost:9222/devtools/page/test-target',
        connection: mockWebSocket,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        isHealthy: true,
        clientCount: 1
      };

      mockConnectionPool.getConnectionInfo.mockReturnValue(mockConnection);

      const request: CommandExecutionRequest = {
        connectionId: 'test-connection',
        command: {
          id: 1,
          method: 'Runtime.evaluate',
          params: { expression: '1 + 1' }
        }
      };

      // First client should succeed
      let messageHandler: (data: WebSocket.Data) => void;
      mockWebSocket.on.mockImplementation((event: string | symbol, handler: any) => {
        if (event === 'message') {
          messageHandler = handler;
        }
        return mockWebSocket;
      });

      const firstClientPromise = commandExecutionService.executeCommand(request, 'client1');
      
      // Simulate response for first client
      setTimeout(() => {
        const cdpResponse = { id: 1, result: { type: 'number', value: 2 } };
        messageHandler(JSON.stringify(cdpResponse));
      }, 10);

      const firstResult = await firstClientPromise;
      expect(firstResult.success).toBe(true);

      // Second client should be rejected
      const secondResult = await commandExecutionService.executeCommand(request, 'client2');
      expect(secondResult.success).toBe(false);
      expect(secondResult.error?.code).toBe(409);
      expect(secondResult.error?.message).toContain('Another CLI client');
    });

    it('should allow same client to execute multiple commands', async () => {
      const mockConnection: CDPConnectionInfo = {
        id: 'test-connection',
        host: 'localhost',
        port: 9222,
        targetId: 'test-target',
        wsUrl: 'ws://localhost:9222/devtools/page/test-target',
        connection: mockWebSocket,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        isHealthy: true,
        clientCount: 1
      };

      mockConnectionPool.getConnectionInfo.mockReturnValue(mockConnection);

      let messageHandler: (data: WebSocket.Data) => void;
      mockWebSocket.on.mockImplementation((event: string | symbol, handler: any) => {
        if (event === 'message') {
          messageHandler = handler;
        }
        return mockWebSocket;
      });

      const request1: CommandExecutionRequest = {
        connectionId: 'test-connection',
        command: { id: 1, method: 'Runtime.evaluate', params: { expression: '1 + 1' } }
      };

      const request2: CommandExecutionRequest = {
        connectionId: 'test-connection',
        command: { id: 2, method: 'Runtime.evaluate', params: { expression: '2 + 2' } }
      };

      // First command
      const firstPromise = commandExecutionService.executeCommand(request1, 'client1');
      setTimeout(() => {
        const cdpResponse = { id: 1, result: { type: 'number', value: 2 } };
        messageHandler(JSON.stringify(cdpResponse));
      }, 10);
      const firstResult = await firstPromise;
      expect(firstResult.success).toBe(true);

      // Second command from same client
      const secondPromise = commandExecutionService.executeCommand(request2, 'client1');
      setTimeout(() => {
        const cdpResponse = { id: 2, result: { type: 'number', value: 4 } };
        messageHandler(JSON.stringify(cdpResponse));
      }, 10);
      const secondResult = await secondPromise;
      expect(secondResult.success).toBe(true);
    });
  });

  describe('CLI Client Management', () => {
    it('should set and get active CLI client', () => {
      expect(commandExecutionService.hasActiveCLIClient()).toBe(false);
      expect(commandExecutionService.getActiveCLIClient()).toBe(null);

      commandExecutionService.setActiveCLIClient('client1');
      
      expect(commandExecutionService.hasActiveCLIClient()).toBe(true);
      expect(commandExecutionService.getActiveCLIClient()).toBe('client1');
    });

    it('should release active CLI client', () => {
      commandExecutionService.setActiveCLIClient('client1');
      expect(commandExecutionService.hasActiveCLIClient()).toBe(true);

      commandExecutionService.releaseActiveCLIClient('client1');
      
      expect(commandExecutionService.hasActiveCLIClient()).toBe(false);
      expect(commandExecutionService.getActiveCLIClient()).toBe(null);
    });

    it('should not release CLI client with wrong ID', () => {
      commandExecutionService.setActiveCLIClient('client1');
      expect(commandExecutionService.hasActiveCLIClient()).toBe(true);

      commandExecutionService.releaseActiveCLIClient('client2');
      
      // Should still be active
      expect(commandExecutionService.hasActiveCLIClient()).toBe(true);
      expect(commandExecutionService.getActiveCLIClient()).toBe('client1');
    });

    it('should reset active client on cleanup', () => {
      commandExecutionService.setActiveCLIClient('client1');
      expect(commandExecutionService.hasActiveCLIClient()).toBe(true);

      commandExecutionService.cleanup();
      
      expect(commandExecutionService.hasActiveCLIClient()).toBe(false);
      expect(commandExecutionService.getActiveCLIClient()).toBe(null);
    });
  });

  describe('getMetrics', () => {
    it('should return initial metrics', () => {
      const metrics = commandExecutionService.getMetrics();

      expect(metrics.totalCommands).toBe(0);
      expect(metrics.successfulCommands).toBe(0);
      expect(metrics.failedCommands).toBe(0);
      expect(metrics.averageExecutionTime).toBe(0);
      expect(metrics.timeoutCount).toBe(0);
    });
  });

  describe('getPendingCommandsCount', () => {
    it('should return zero initially', () => {
      expect(commandExecutionService.getPendingCommandsCount()).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should cleanup all resources', () => {
      expect(() => commandExecutionService.cleanup()).not.toThrow();
    });
  });
});
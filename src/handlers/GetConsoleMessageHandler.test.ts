import { GetConsoleMessageHandler } from './GetConsoleMessageHandler';
import { CDPClient } from '../types';

// Mock ProxyClient
jest.mock('../client/ProxyClient', () => {
  return {
    ProxyClient: jest.fn().mockImplementation(() => ({
      isProxyAvailable: jest.fn().mockResolvedValue(false),
      ensureProxyRunning: jest.fn().mockResolvedValue(false),
      getConnectionId: jest.fn().mockReturnValue(null),
      connect: jest.fn().mockResolvedValue(undefined),
      getConsoleMessages: jest.fn().mockResolvedValue([])
    }))
  };
});

// Mock CDPClient for testing
class MockCDPClient implements CDPClient {
  private eventListeners = new Map<string, Array<(params: unknown) => void>>();

  async connect(): Promise<void> {
    // Mock implementation
  }

  async disconnect(): Promise<void> {
    // Mock implementation
  }

  async send(method: string, params?: unknown): Promise<unknown> {
    if (method === 'Runtime.enable') {
      return {};
    }
    // Use params if needed in the future
    console.log('Method called:', method, params ? 'with params' : 'without params');
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

  // Helper method to simulate console events
  simulateConsoleEvent(params: unknown): void {
    const listeners = this.eventListeners.get('Runtime.consoleAPICalled');
    if (listeners) {
      listeners.forEach(callback => callback(params));
    }
  }
}

describe('GetConsoleMessageHandler', () => {
  let handler: GetConsoleMessageHandler;
  let mockClient: MockCDPClient;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    handler = new GetConsoleMessageHandler();
    mockClient = new MockCDPClient();
    
    // Suppress console.warn during tests
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('execute', () => {
    it('should return null when no messages are available', async () => {
      const result = await handler.execute(mockClient, {});
      
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('should return the latest console message', async () => {
      // Start monitoring first
      await handler.execute(mockClient, { startMonitoring: true });
      
      // Simulate a console message
      mockClient.simulateConsoleEvent({
        type: 'log',
        args: [{ type: 'string', value: 'Test message' }],
        executionContextId: 1,
        timestamp: Date.now()
      });

      // Get the message
      const result = await handler.execute(mockClient, {});
      
      expect(result.success).toBe(true);
      expect(result.data).not.toBeNull();
      expect(result.data).toMatchObject({
        type: 'log',
        text: 'Test message',
        args: ['Test message']
      });
    });

    it('should filter messages by type', async () => {
      // Start monitoring
      await handler.execute(mockClient, { startMonitoring: true });
      
      // Add different types of messages
      mockClient.simulateConsoleEvent({
        type: 'log',
        args: [{ type: 'string', value: 'Log message' }],
        executionContextId: 1,
        timestamp: 1000
      });

      mockClient.simulateConsoleEvent({
        type: 'error',
        args: [{ type: 'string', value: 'Error message' }],
        executionContextId: 1,
        timestamp: 2000
      });

      // Get only error messages
      const result = await handler.execute(mockClient, { type: 'error' });
      
      expect(result.success).toBe(true);
      expect(result.data).not.toBeNull();
      expect(result.data).toMatchObject({
        type: 'error',
        text: 'Error message'
      });
    });

    it('should filter messages by text pattern', async () => {
      // Start monitoring
      await handler.execute(mockClient, { startMonitoring: true });
      
      // Add messages
      mockClient.simulateConsoleEvent({
        type: 'log',
        args: [{ type: 'string', value: 'API call successful' }],
        executionContextId: 1,
        timestamp: 1000
      });

      mockClient.simulateConsoleEvent({
        type: 'log',
        args: [{ type: 'string', value: 'Regular message' }],
        executionContextId: 1,
        timestamp: 2000
      });

      // Get messages matching pattern
      const result = await handler.execute(mockClient, { textPattern: 'API' });
      
      expect(result.success).toBe(true);
      expect(result.data).not.toBeNull();
      expect(result.data).toMatchObject({
        type: 'log',
        text: 'API call successful'
      });
    });

    it('should handle errors gracefully', async () => {
      // Create a client that throws an error
      const errorClient = {
        connect: async () => {},
        disconnect: async () => {},
        on: () => {},
        off: () => {},
        send: async () => {
          throw new Error('Connection failed');
        }
      } as CDPClient;

      const result = await handler.execute(errorClient, {});
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
    });
  });

  describe('validateArgs', () => {
    it('should accept no arguments', () => {
      expect(handler.validateArgs(undefined)).toBe(true);
      expect(handler.validateArgs(null)).toBe(true);
      expect(handler.validateArgs({})).toBe(true);
    });

    it('should accept valid type argument', () => {
      expect(handler.validateArgs({ type: 'log' })).toBe(true);
      expect(handler.validateArgs({ type: 'error' })).toBe(true);
      expect(handler.validateArgs({ type: 'warn' })).toBe(true);
      expect(handler.validateArgs({ type: 'info' })).toBe(true);
      expect(handler.validateArgs({ type: 'debug' })).toBe(true);
    });

    it('should reject invalid type argument', () => {
      expect(handler.validateArgs({ type: 'invalid' })).toBe(false);
      expect(handler.validateArgs({ type: 123 })).toBe(false);
    });

    it('should accept valid textPattern argument', () => {
      expect(handler.validateArgs({ textPattern: 'test' })).toBe(true);
      expect(handler.validateArgs({ textPattern: 'API.*call' })).toBe(true);
    });

    it('should reject invalid textPattern argument', () => {
      expect(handler.validateArgs({ textPattern: 123 })).toBe(false);
      expect(handler.validateArgs({ textPattern: true })).toBe(false);
    });

    it('should accept valid startMonitoring argument', () => {
      expect(handler.validateArgs({ startMonitoring: true })).toBe(true);
      expect(handler.validateArgs({ startMonitoring: false })).toBe(true);
    });

    it('should reject invalid startMonitoring argument', () => {
      expect(handler.validateArgs({ startMonitoring: 'true' })).toBe(false);
      expect(handler.validateArgs({ startMonitoring: 1 })).toBe(false);
    });
  });

  describe('getHelp', () => {
    it('should return help text', () => {
      const help = handler.getHelp();
      expect(help).toContain('get_console_message');
      expect(help).toContain('--type');
      expect(help).toContain('--textPattern');
      expect(help).toContain('--startMonitoring');
    });
  });
});
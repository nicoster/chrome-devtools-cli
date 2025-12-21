import { ListConsoleMessagesHandler } from './ListConsoleMessagesHandler';
import { CDPClient } from '../types';

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
    if (params) {
      console.log('Method called with params:', method);
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

  // Helper method to simulate console events
  simulateConsoleEvent(params: unknown): void {
    const listeners = this.eventListeners.get('Runtime.consoleAPICalled');
    if (listeners) {
      listeners.forEach(callback => callback(params));
    }
  }
}

describe('ListConsoleMessagesHandler', () => {
  let handler: ListConsoleMessagesHandler;
  let mockClient: MockCDPClient;

  beforeEach(() => {
    handler = new ListConsoleMessagesHandler();
    mockClient = new MockCDPClient();
  });

  describe('execute', () => {
    it('should return empty list when no messages are available', async () => {
      const result = await handler.execute(mockClient, {});
      
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        messages: [],
        totalCount: 0,
        isMonitoring: true
      });
    });

    it('should return all console messages', async () => {
      // Start monitoring first
      await handler.execute(mockClient, { startMonitoring: true });
      
      // Simulate console messages
      mockClient.simulateConsoleEvent({
        type: 'log',
        args: [{ type: 'string', value: 'First message' }],
        executionContextId: 1,
        timestamp: 1000
      });

      mockClient.simulateConsoleEvent({
        type: 'error',
        args: [{ type: 'string', value: 'Second message' }],
        executionContextId: 1,
        timestamp: 2000
      });

      // Get all messages
      const result = await handler.execute(mockClient, {});
      
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        totalCount: 2,
        isMonitoring: true
      });
      
      const data = result.data as any;
      expect(data.messages).toHaveLength(2);
      expect(data.messages[0]).toMatchObject({
        type: 'log',
        text: 'First message'
      });
      expect(data.messages[1]).toMatchObject({
        type: 'error',
        text: 'Second message'
      });
    });

    it('should filter messages by types', async () => {
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

      mockClient.simulateConsoleEvent({
        type: 'warning',
        args: [{ type: 'string', value: 'Warning message' }],
        executionContextId: 1,
        timestamp: 3000
      });

      // Get only error and warning messages
      const result = await handler.execute(mockClient, { types: ['error', 'warn'] });
      
      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.messages).toHaveLength(2);
      expect(data.totalCount).toBe(2);
      expect(data.messages[0].type).toBe('error');
      expect(data.messages[1].type).toBe('warn');
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

      mockClient.simulateConsoleEvent({
        type: 'log',
        args: [{ type: 'string', value: 'Another API response' }],
        executionContextId: 1,
        timestamp: 3000
      });

      // Get messages matching pattern
      const result = await handler.execute(mockClient, { textPattern: 'API' });
      
      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.messages).toHaveLength(2);
      expect(data.totalCount).toBe(2);
      expect(data.messages[0].text).toContain('API');
      expect(data.messages[1].text).toContain('API');
    });

    it('should limit number of messages', async () => {
      // Start monitoring
      await handler.execute(mockClient, { startMonitoring: true });
      
      // Add multiple messages
      for (let i = 1; i <= 5; i++) {
        mockClient.simulateConsoleEvent({
          type: 'log',
          args: [{ type: 'string', value: `Message ${i}` }],
          executionContextId: 1,
          timestamp: i * 1000
        });
      }

      // Get only last 3 messages
      const result = await handler.execute(mockClient, { maxMessages: 3 });
      
      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.messages).toHaveLength(3);
      expect(data.totalCount).toBe(3);
      // Should return the last 3 messages
      expect(data.messages[0].text).toBe('Message 3');
      expect(data.messages[1].text).toBe('Message 4');
      expect(data.messages[2].text).toBe('Message 5');
    });

    it('should filter messages by time range', async () => {
      // Start monitoring
      await handler.execute(mockClient, { startMonitoring: true });
      
      // Add messages with different timestamps
      mockClient.simulateConsoleEvent({
        type: 'log',
        args: [{ type: 'string', value: 'Early message' }],
        executionContextId: 1,
        timestamp: 1000
      });

      mockClient.simulateConsoleEvent({
        type: 'log',
        args: [{ type: 'string', value: 'Middle message' }],
        executionContextId: 1,
        timestamp: 2500
      });

      mockClient.simulateConsoleEvent({
        type: 'log',
        args: [{ type: 'string', value: 'Late message' }],
        executionContextId: 1,
        timestamp: 4000
      });

      // Get messages in time range
      const result = await handler.execute(mockClient, { 
        startTime: 2000, 
        endTime: 3000 
      });
      
      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.messages).toHaveLength(1);
      expect(data.totalCount).toBe(1);
      expect(data.messages[0].text).toBe('Middle message');
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

    it('should accept valid types argument', () => {
      expect(handler.validateArgs({ types: ['log'] })).toBe(true);
      expect(handler.validateArgs({ types: ['error', 'warn'] })).toBe(true);
      expect(handler.validateArgs({ types: ['log', 'info', 'debug'] })).toBe(true);
    });

    it('should reject invalid types argument', () => {
      expect(handler.validateArgs({ types: 'log' })).toBe(false);
      expect(handler.validateArgs({ types: ['invalid'] })).toBe(false);
      expect(handler.validateArgs({ types: [123] })).toBe(false);
    });

    it('should accept valid maxMessages argument', () => {
      expect(handler.validateArgs({ maxMessages: 10 })).toBe(true);
      expect(handler.validateArgs({ maxMessages: 1 })).toBe(true);
    });

    it('should reject invalid maxMessages argument', () => {
      expect(handler.validateArgs({ maxMessages: 0 })).toBe(false);
      expect(handler.validateArgs({ maxMessages: -1 })).toBe(false);
      expect(handler.validateArgs({ maxMessages: '10' })).toBe(false);
    });

    it('should accept valid timestamp arguments', () => {
      expect(handler.validateArgs({ startTime: 1640995200000 })).toBe(true);
      expect(handler.validateArgs({ endTime: 1640995200000 })).toBe(true);
      expect(handler.validateArgs({ 
        startTime: 1640995200000, 
        endTime: 1640995300000 
      })).toBe(true);
    });

    it('should reject invalid timestamp arguments', () => {
      expect(handler.validateArgs({ startTime: '1640995200000' })).toBe(false);
      expect(handler.validateArgs({ endTime: true })).toBe(false);
    });
  });

  describe('getHelp', () => {
    it('should return help text', () => {
      const help = handler.getHelp();
      expect(help).toContain('list_console_messages');
      expect(help).toContain('--types');
      expect(help).toContain('--textPattern');
      expect(help).toContain('--maxMessages');
      expect(help).toContain('--startTime');
      expect(help).toContain('--endTime');
    });
  });
});
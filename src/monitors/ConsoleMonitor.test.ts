import { ConsoleMonitor } from './ConsoleMonitor';
import { CDPClient } from '../types';

// Mock CDPClient for testing
class MockCDPClient implements CDPClient {
  private eventListeners = new Map<string, Array<(params: unknown) => void>>();
  private isRuntimeEnabled = false;

  async connect(): Promise<void> {
    // Mock implementation
  }

  async disconnect(): Promise<void> {
    // Mock implementation
  }

  async send(method: string, _params?: unknown): Promise<unknown> {
    if (method === 'Runtime.enable') {
      this.isRuntimeEnabled = true;
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

  // Helper method to simulate console events
  simulateConsoleEvent(params: unknown): void {
    const listeners = this.eventListeners.get('Runtime.consoleAPICalled');
    if (listeners) {
      listeners.forEach(callback => callback(params));
    }
  }

  isRuntimeEnabledForTest(): boolean {
    return this.isRuntimeEnabled;
  }
}

describe('ConsoleMonitor', () => {
  let mockClient: MockCDPClient;
  let consoleMonitor: ConsoleMonitor;

  beforeEach(() => {
    mockClient = new MockCDPClient();
    consoleMonitor = new ConsoleMonitor(mockClient);
  });

  afterEach(async () => {
    await consoleMonitor.stopMonitoring();
  });

  describe('startMonitoring', () => {
    it('should enable Runtime domain and start monitoring', async () => {
      expect(consoleMonitor.isActive()).toBe(false);
      
      await consoleMonitor.startMonitoring();
      
      expect(consoleMonitor.isActive()).toBe(true);
      expect(mockClient.isRuntimeEnabledForTest()).toBe(true);
    });

    it('should not start monitoring twice', async () => {
      await consoleMonitor.startMonitoring();
      expect(consoleMonitor.isActive()).toBe(true);
      
      // Should not throw or cause issues
      await consoleMonitor.startMonitoring();
      expect(consoleMonitor.isActive()).toBe(true);
    });
  });

  describe('stopMonitoring', () => {
    it('should stop monitoring when active', async () => {
      await consoleMonitor.startMonitoring();
      expect(consoleMonitor.isActive()).toBe(true);
      
      await consoleMonitor.stopMonitoring();
      expect(consoleMonitor.isActive()).toBe(false);
    });

    it('should handle stopping when not monitoring', async () => {
      expect(consoleMonitor.isActive()).toBe(false);
      
      // Should not throw
      await consoleMonitor.stopMonitoring();
      expect(consoleMonitor.isActive()).toBe(false);
    });
  });

  describe('message handling', () => {
    beforeEach(async () => {
      await consoleMonitor.startMonitoring();
    });

    it('should capture console log messages', () => {
      const consoleEvent = {
        type: 'log',
        args: [
          { type: 'string', value: 'Hello' },
          { type: 'string', value: 'World' }
        ],
        executionContextId: 1,
        timestamp: Date.now()
      };

      mockClient.simulateConsoleEvent(consoleEvent);

      const messages = consoleMonitor.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('log');
      expect(messages[0].text).toBe('Hello World');
      expect(messages[0].args).toEqual(['Hello', 'World']);
    });

    it('should capture console error messages with stack trace', () => {
      const consoleEvent = {
        type: 'error',
        args: [
          { type: 'string', value: 'Error occurred' }
        ],
        executionContextId: 1,
        timestamp: Date.now(),
        stackTrace: {
          callFrames: [
            {
              functionName: 'testFunction',
              url: 'http://example.com/test.js',
              lineNumber: 10,
              columnNumber: 5
            }
          ]
        }
      };

      mockClient.simulateConsoleEvent(consoleEvent);

      const messages = consoleMonitor.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('error');
      expect(messages[0].text).toBe('Error occurred');
      expect(messages[0].stackTrace).toBeDefined();
      expect(messages[0].stackTrace![0].functionName).toBe('testFunction');
    });

    it('should map CDP console types correctly', () => {
      const testCases = [
        { cdpType: 'log', expectedType: 'log' },
        { cdpType: 'info', expectedType: 'info' },
        { cdpType: 'warning', expectedType: 'warn' },
        { cdpType: 'error', expectedType: 'error' },
        { cdpType: 'debug', expectedType: 'debug' },
        { cdpType: 'unknown', expectedType: 'log' } // fallback
      ];

      testCases.forEach(({ cdpType }, index) => {
        const consoleEvent = {
          type: cdpType,
          args: [{ type: 'string', value: `Message ${index}` }],
          executionContextId: 1,
          timestamp: Date.now() + index
        };

        mockClient.simulateConsoleEvent(consoleEvent);
      });

      const messages = consoleMonitor.getMessages();
      expect(messages).toHaveLength(testCases.length);
      
      testCases.forEach(({ expectedType }, index) => {
        expect(messages[index].type).toBe(expectedType);
      });
    });
  });

  describe('message filtering', () => {
    beforeEach(async () => {
      await consoleMonitor.startMonitoring();
      
      // Add test messages
      const testMessages = [
        { type: 'log', text: 'Log message', timestamp: 1000 },
        { type: 'error', text: 'Error message', timestamp: 2000 },
        { type: 'warn', text: 'Warning message', timestamp: 3000 },
        { type: 'info', text: 'API call successful', timestamp: 4000 }
      ];

      testMessages.forEach(msg => {
        mockClient.simulateConsoleEvent({
          type: msg.type === 'warn' ? 'warning' : msg.type,
          args: [{ type: 'string', value: msg.text }],
          executionContextId: 1,
          timestamp: msg.timestamp
        });
      });
    });

    it('should filter messages by type', () => {
      const errorMessages = consoleMonitor.getMessages({ types: ['error'] });
      expect(errorMessages).toHaveLength(1);
      expect(errorMessages[0].type).toBe('error');

      const logAndWarnMessages = consoleMonitor.getMessages({ types: ['log', 'warn'] });
      expect(logAndWarnMessages).toHaveLength(2);
    });

    it('should filter messages by text pattern', () => {
      const apiMessages = consoleMonitor.getMessages({ textPattern: 'API' });
      expect(apiMessages).toHaveLength(1);
      expect(apiMessages[0].text).toContain('API');

      const messageMessages = consoleMonitor.getMessages({ textPattern: 'message' });
      expect(messageMessages).toHaveLength(3); // Log, Error, Warning messages
    });

    it('should filter messages by time range', () => {
      const recentMessages = consoleMonitor.getMessages({ startTime: 2500 });
      expect(recentMessages).toHaveLength(2); // Warning and Info messages

      const earlyMessages = consoleMonitor.getMessages({ endTime: 2500 });
      expect(earlyMessages).toHaveLength(2); // Log and Error messages
    });

    it('should limit number of messages', () => {
      const limitedMessages = consoleMonitor.getMessages({ maxMessages: 2 });
      expect(limitedMessages).toHaveLength(2);
      // Should return the last 2 messages
      expect(limitedMessages[0].type).toBe('warn');
      expect(limitedMessages[1].type).toBe('info');
    });
  });

  describe('getLatestMessage', () => {
    beforeEach(async () => {
      await consoleMonitor.startMonitoring();
    });

    it('should return null when no messages', () => {
      const latest = consoleMonitor.getLatestMessage();
      expect(latest).toBeNull();
    });

    it('should return the latest message', () => {
      mockClient.simulateConsoleEvent({
        type: 'log',
        args: [{ type: 'string', value: 'First message' }],
        executionContextId: 1,
        timestamp: 1000
      });

      mockClient.simulateConsoleEvent({
        type: 'error',
        args: [{ type: 'string', value: 'Latest message' }],
        executionContextId: 1,
        timestamp: 2000
      });

      const latest = consoleMonitor.getLatestMessage();
      expect(latest).not.toBeNull();
      expect(latest!.type).toBe('error');
      expect(latest!.text).toBe('Latest message');
    });

    it('should return the latest message matching filter', () => {
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

      const latestLog = consoleMonitor.getLatestMessage({ types: ['log'] });
      expect(latestLog).not.toBeNull();
      expect(latestLog!.type).toBe('log');
      expect(latestLog!.text).toBe('Log message');
    });
  });

  describe('clearMessages', () => {
    it('should clear all stored messages', async () => {
      await consoleMonitor.startMonitoring();
      
      mockClient.simulateConsoleEvent({
        type: 'log',
        args: [{ type: 'string', value: 'Test message' }],
        executionContextId: 1,
        timestamp: Date.now()
      });

      expect(consoleMonitor.getMessageCount()).toBe(1);
      
      consoleMonitor.clearMessages();
      expect(consoleMonitor.getMessageCount()).toBe(0);
    });
  });

  describe('getMessageCount', () => {
    beforeEach(async () => {
      await consoleMonitor.startMonitoring();
    });

    it('should return correct message count', () => {
      expect(consoleMonitor.getMessageCount()).toBe(0);

      mockClient.simulateConsoleEvent({
        type: 'log',
        args: [{ type: 'string', value: 'Message 1' }],
        executionContextId: 1,
        timestamp: 1000
      });

      mockClient.simulateConsoleEvent({
        type: 'error',
        args: [{ type: 'string', value: 'Message 2' }],
        executionContextId: 1,
        timestamp: 2000
      });

      expect(consoleMonitor.getMessageCount()).toBe(2);
    });

    it('should return filtered message count', () => {
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

      expect(consoleMonitor.getMessageCount({ types: ['error'] })).toBe(1);
      expect(consoleMonitor.getMessageCount({ textPattern: 'Log' })).toBe(1);
    });
  });
});
/**
 * Tests for MessageStore memory management and cleanup functionality
 */

import { MessageStore } from './MessageStore';
import { StoredConsoleMessage, StoredNetworkRequest } from '../types/ProxyTypes';

describe('MessageStore', () => {
  let messageStore: MessageStore;

  beforeEach(() => {
    messageStore = new MessageStore(5, 3); // Small limits for testing
  });

  describe('Console Message Memory Management', () => {
    it('should enforce FIFO cleanup when console message limit is exceeded', () => {
      const connectionId = 'test-connection';

      // Add messages beyond the limit
      for (let i = 0; i < 8; i++) {
        const message: StoredConsoleMessage = {
          connectionId,
          type: 'log',
          text: `Message ${i}`,
          args: [`Message ${i}`],
          timestamp: Date.now() + i,
          source: 'Runtime.consoleAPICalled'
        };
        messageStore.addConsoleMessage(connectionId, message);
      }

      // Should only keep the last 5 messages (limit)
      const messages = messageStore.getConsoleMessages(connectionId);
      expect(messages).toHaveLength(5);
      expect(messages[0].text).toBe('Message 3'); // First kept message
      expect(messages[4].text).toBe('Message 7'); // Last message
    });

    it('should clean up console messages when connection is cleaned up', () => {
      const connectionId = 'test-connection';

      // Add some messages
      for (let i = 0; i < 3; i++) {
        const message: StoredConsoleMessage = {
          connectionId,
          type: 'log',
          text: `Message ${i}`,
          args: [`Message ${i}`],
          timestamp: Date.now() + i,
          source: 'Runtime.consoleAPICalled'
        };
        messageStore.addConsoleMessage(connectionId, message);
      }

      expect(messageStore.getConsoleMessages(connectionId)).toHaveLength(3);

      // Clean up connection
      messageStore.cleanupConnection(connectionId);

      expect(messageStore.getConsoleMessages(connectionId)).toHaveLength(0);
    });
  });

  describe('Network Request Memory Management', () => {
    it('should enforce FIFO cleanup when network request limit is exceeded', () => {
      const connectionId = 'test-connection';

      // Add requests beyond the limit
      for (let i = 0; i < 6; i++) {
        const request: StoredNetworkRequest = {
          connectionId,
          requestId: `req-${i}`,
          url: `https://example.com/${i}`,
          method: 'GET',
          headers: {},
          timestamp: Date.now() + i,
          loadingFinished: false
        };
        messageStore.addNetworkRequest(connectionId, request);
      }

      // Should only keep the last 3 requests (limit)
      const requests = messageStore.getNetworkRequests(connectionId);
      expect(requests).toHaveLength(3);
      expect(requests[0].url).toBe('https://example.com/3'); // First kept request
      expect(requests[2].url).toBe('https://example.com/5'); // Last request
    });

    it('should clean up network requests when connection is cleaned up', () => {
      const connectionId = 'test-connection';

      // Add some requests
      for (let i = 0; i < 2; i++) {
        const request: StoredNetworkRequest = {
          connectionId,
          requestId: `req-${i}`,
          url: `https://example.com/${i}`,
          method: 'GET',
          headers: {},
          timestamp: Date.now() + i,
          loadingFinished: false
        };
        messageStore.addNetworkRequest(connectionId, request);
      }

      expect(messageStore.getNetworkRequests(connectionId)).toHaveLength(2);

      // Clean up connection
      messageStore.cleanupConnection(connectionId);

      expect(messageStore.getNetworkRequests(connectionId)).toHaveLength(0);
    });
  });

  describe('Global Memory Management', () => {
    it('should enforce global memory limits across connections', () => {
      // Create multiple connections with messages
      for (let conn = 0; conn < 3; conn++) {
        const connectionId = `connection-${conn}`;
        
        // Add messages to each connection (5 per connection = 15 total)
        for (let i = 0; i < 5; i++) {
          const message: StoredConsoleMessage = {
            connectionId,
            type: 'log',
            text: `Message ${i}`,
            args: [`Message ${i}`],
            timestamp: Date.now() + i,
            source: 'Runtime.consoleAPICalled'
          };
          messageStore.addConsoleMessage(connectionId, message);
        }
      }

      // Total should be 15 messages (3 connections × 5 messages)
      const stats = messageStore.getStorageStats();
      expect(stats.totalConsoleMessages).toBe(15);

      // Enforce global limits (should trigger cleanup when > 10 messages)
      messageStore.enforceMemoryLimits();

      // Should have cleaned up some messages
      const newStats = messageStore.getStorageStats();
      expect(newStats.totalConsoleMessages).toBeLessThan(15);
    });

    it('should provide accurate storage statistics', () => {
      const connectionId1 = 'connection-1';
      const connectionId2 = 'connection-2';

      // Add messages to first connection
      for (let i = 0; i < 3; i++) {
        const message: StoredConsoleMessage = {
          connectionId: connectionId1,
          type: 'log',
          text: `Message ${i}`,
          args: [`Message ${i}`],
          timestamp: Date.now() + i,
          source: 'Runtime.consoleAPICalled'
        };
        messageStore.addConsoleMessage(connectionId1, message);
      }

      // Add requests to second connection
      for (let i = 0; i < 2; i++) {
        const request: StoredNetworkRequest = {
          connectionId: connectionId2,
          requestId: `req-${i}`,
          url: `https://example.com/${i}`,
          method: 'GET',
          headers: {},
          timestamp: Date.now() + i,
          loadingFinished: false
        };
        messageStore.addNetworkRequest(connectionId2, request);
      }

      const stats = messageStore.getStorageStats();
      expect(stats.connections).toBe(2);
      expect(stats.totalConsoleMessages).toBe(3);
      expect(stats.totalNetworkRequests).toBe(2);
      expect(stats.consoleMessagesByConnection[connectionId1]).toBe(3);
      expect(stats.networkRequestsByConnection[connectionId2]).toBe(2);
    });
  });

  describe('CDP Event Processing', () => {
    it('should process Runtime.consoleAPICalled events correctly', () => {
      const connectionId = 'test-connection';
      const params = {
        type: 'log',
        args: [
          { value: 'Hello' },
          { value: 'World' }
        ],
        timestamp: 1234567890,
        stackTrace: {
          callFrames: [
            {
              functionName: 'testFunction',
              url: 'file://test.js',
              lineNumber: 10,
              columnNumber: 5
            }
          ]
        }
      };

      messageStore.processConsoleAPIEvent(connectionId, params);

      const messages = messageStore.getConsoleMessages(connectionId);
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('log');
      expect(messages[0].text).toBe('Hello World');
      expect(messages[0].timestamp).toBe(1234567890);
      expect(messages[0].stackTrace).toHaveLength(1);
      expect(messages[0].stackTrace![0].functionName).toBe('testFunction');
    });

    it('should process Log.entryAdded events correctly', () => {
      const connectionId = 'test-connection';
      const params = {
        entry: {
          level: 'warning',
          text: 'This is a warning',
          timestamp: 1234567890,
          url: 'file://test.js',
          lineNumber: 15
        }
      };

      messageStore.processLogEntryEvent(connectionId, params);

      const messages = messageStore.getConsoleMessages(connectionId);
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('warn');
      expect(messages[0].text).toBe('This is a warning');
      expect(messages[0].source).toBe('Log.entryAdded');
    });
  });
});
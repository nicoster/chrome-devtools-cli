import { DragHandler } from './DragHandler';
import { CDPClient } from '../types';
import { jest } from '@jest/globals';

// Mock CDPClient
const mockClient: jest.Mocked<CDPClient> = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  send: jest.fn(),
  on: jest.fn(),
  off: jest.fn()
};

describe('DragHandler', () => {
  let handler: DragHandler;

  beforeEach(() => {
    handler = new DragHandler();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should set correct handler name', () => {
      expect(handler.name).toBe('drag');
    });
  });

  describe('validateArgs', () => {
    it('should return true for valid arguments', () => {
      const args = {
        sourceSelector: '#source',
        targetSelector: '#target'
      };
      expect(handler.validateArgs(args)).toBe(true);
    });

    it('should return false for missing source selector', () => {
      const args = {
        targetSelector: '#target'
      };
      expect(handler.validateArgs(args)).toBe(false);
    });

    it('should return false for missing target selector', () => {
      const args = {
        sourceSelector: '#source'
      };
      expect(handler.validateArgs(args)).toBe(false);
    });

    it('should return false for non-string source selector', () => {
      const args = {
        sourceSelector: 123,
        targetSelector: '#target'
      };
      expect(handler.validateArgs(args)).toBe(false);
    });

    it('should return false for non-string target selector', () => {
      const args = {
        sourceSelector: '#source',
        targetSelector: 123
      };
      expect(handler.validateArgs(args)).toBe(false);
    });

    it('should return false for null arguments', () => {
      expect(handler.validateArgs(null)).toBe(false);
    });

    it('should return false for non-object arguments', () => {
      expect(handler.validateArgs('string')).toBe(false);
    });

    it('should return true for valid arguments with optional parameters', () => {
      const args = {
        sourceSelector: '#source',
        targetSelector: '#target',
        waitForElement: false,
        timeout: 10000
      };
      expect(handler.validateArgs(args)).toBe(true);
    });

    it('should return false for invalid waitForElement type', () => {
      const args = {
        sourceSelector: '#source',
        targetSelector: '#target',
        waitForElement: 'false'
      };
      expect(handler.validateArgs(args)).toBe(false);
    });

    it('should return false for invalid timeout type', () => {
      const args = {
        sourceSelector: '#source',
        targetSelector: '#target',
        timeout: 'fast'
      };
      expect(handler.validateArgs(args)).toBe(false);
    });
  });

  describe('execute', () => {
    it('should return error for missing source selector', async () => {
      const args = {
        targetSelector: '#target'
      };

      const result = await handler.execute(mockClient, args);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Source CSS selector is required for drag command');
    });

    it('should return error for missing target selector', async () => {
      const args = {
        sourceSelector: '#source'
      };

      const result = await handler.execute(mockClient, args);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Target CSS selector is required for drag command');
    });

    it('should return error for non-string source selector', async () => {
      const args = {
        sourceSelector: 123,
        targetSelector: '#target'
      };

      const result = await handler.execute(mockClient, args);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Source CSS selector must be a string');
    });

    it('should return error for non-string target selector', async () => {
      const args = {
        sourceSelector: '#source',
        targetSelector: 123
      };

      const result = await handler.execute(mockClient, args);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Target CSS selector must be a string');
    });

    it('should enable Runtime domain', async () => {
      const args = {
        sourceSelector: '#source',
        targetSelector: '#target',
        waitForElement: false
      };

      // Mock successful element check and drag operation
      mockClient.send
        .mockResolvedValueOnce({ result: { value: true } }) // source element exists
        .mockResolvedValueOnce({ result: { value: true } }) // target element exists
        .mockResolvedValueOnce({ result: { value: { success: true } } }); // drag operation

      await handler.execute(mockClient, args);

      expect(mockClient.send).toHaveBeenCalledWith('Runtime.enable');
    });
  });

  describe('getHelp', () => {
    it('should return help text', () => {
      const help = handler.getHelp();
      expect(help).toContain('drag - Perform drag and drop operation');
      expect(help).toContain('Usage:');
      expect(help).toContain('Examples:');
    });
  });
});
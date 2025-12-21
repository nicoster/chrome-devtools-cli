import { PressKeyHandler } from './PressKeyHandler';
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

describe('PressKeyHandler', () => {
  let handler: PressKeyHandler;

  beforeEach(() => {
    handler = new PressKeyHandler();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should set correct handler name', () => {
      expect(handler.name).toBe('press_key');
    });
  });

  describe('validateArgs', () => {
    it('should return true for valid arguments', () => {
      const args = {
        key: 'Enter'
      };
      expect(handler.validateArgs(args)).toBe(true);
    });

    it('should return false for missing key', () => {
      const args = {};
      expect(handler.validateArgs(args)).toBe(false);
    });

    it('should return false for non-string key', () => {
      const args = {
        key: 123
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
        key: 'a',
        selector: '#input',
        modifiers: ['Ctrl', 'Shift'],
        waitForElement: false,
        timeout: 10000
      };
      expect(handler.validateArgs(args)).toBe(true);
    });

    it('should return false for invalid selector type', () => {
      const args = {
        key: 'Enter',
        selector: 123
      };
      expect(handler.validateArgs(args)).toBe(false);
    });

    it('should return false for invalid modifiers type', () => {
      const args = {
        key: 'a',
        modifiers: 'Ctrl'
      };
      expect(handler.validateArgs(args)).toBe(false);
    });

    it('should return false for invalid modifiers array content', () => {
      const args = {
        key: 'a',
        modifiers: ['Ctrl', 123]
      };
      expect(handler.validateArgs(args)).toBe(false);
    });

    it('should return false for invalid waitForElement type', () => {
      const args = {
        key: 'Enter',
        waitForElement: 'false'
      };
      expect(handler.validateArgs(args)).toBe(false);
    });

    it('should return false for invalid timeout type', () => {
      const args = {
        key: 'Enter',
        timeout: 'fast'
      };
      expect(handler.validateArgs(args)).toBe(false);
    });
  });

  describe('execute', () => {
    it('should return error for missing key', async () => {
      const args = {};

      const result = await handler.execute(mockClient, args);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Key is required for press_key command');
    });

    it('should return error for non-string key', async () => {
      const args = {
        key: 123
      };

      const result = await handler.execute(mockClient, args);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Key must be a string');
    });

    it('should enable Runtime domain', async () => {
      const args = {
        key: 'Enter'
      };

      // Mock successful key press operation
      mockClient.send.mockResolvedValueOnce({ result: { value: { success: true } } });

      await handler.execute(mockClient, args);

      expect(mockClient.send).toHaveBeenCalledWith('Runtime.enable');
    });

    it('should handle key press with selector', async () => {
      const args = {
        key: 'Enter',
        selector: '#input',
        waitForElement: false
      };

      // Mock element exists and focus/key press operations
      mockClient.send
        .mockResolvedValueOnce({ result: { value: true } }) // element exists
        .mockResolvedValueOnce({ result: { value: { success: true } } }) // focus element
        .mockResolvedValueOnce({ result: { value: { success: true } } }); // key press

      const result = await handler.execute(mockClient, args);

      expect(result.success).toBe(true);
      expect(mockClient.send).toHaveBeenCalledWith('Runtime.enable');
    });
  });

  describe('getHelp', () => {
    it('should return help text', () => {
      const help = handler.getHelp();
      expect(help).toContain('press_key - Simulate keyboard input');
      expect(help).toContain('Usage:');
      expect(help).toContain('Examples:');
      expect(help).toContain('Supported Keys:');
    });
  });
});
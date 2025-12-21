import { WaitForHandler } from './WaitForHandler';
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

describe('WaitForHandler', () => {
  let handler: WaitForHandler;

  beforeEach(() => {
    handler = new WaitForHandler();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should set correct handler name', () => {
      expect(handler.name).toBe('wait_for');
    });
  });

  describe('validateArgs', () => {
    it('should return true for valid arguments', () => {
      const args = {
        selector: '#element'
      };
      expect(handler.validateArgs(args)).toBe(true);
    });

    it('should return false for missing selector', () => {
      const args = {};
      expect(handler.validateArgs(args)).toBe(false);
    });

    it('should return false for non-string selector', () => {
      const args = {
        selector: 123
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
        selector: '#element',
        timeout: 15000,
        visible: true,
        condition: 'visible' as const,
        pollInterval: 200
      };
      expect(handler.validateArgs(args)).toBe(true);
    });

    it('should return false for invalid timeout type', () => {
      const args = {
        selector: '#element',
        timeout: 'fast'
      };
      expect(handler.validateArgs(args)).toBe(false);
    });

    it('should return false for invalid visible type', () => {
      const args = {
        selector: '#element',
        visible: 'true'
      };
      expect(handler.validateArgs(args)).toBe(false);
    });

    it('should return false for invalid condition', () => {
      const args = {
        selector: '#element',
        condition: 'invalid'
      };
      expect(handler.validateArgs(args)).toBe(false);
    });

    it('should return true for valid conditions', () => {
      const validConditions = ['exists', 'visible', 'hidden', 'enabled', 'disabled'];
      
      validConditions.forEach(condition => {
        const args = {
          selector: '#element',
          condition: condition as any
        };
        expect(handler.validateArgs(args)).toBe(true);
      });
    });

    it('should return false for invalid pollInterval type', () => {
      const args = {
        selector: '#element',
        pollInterval: 'fast'
      };
      expect(handler.validateArgs(args)).toBe(false);
    });
  });

  describe('execute', () => {
    it('should return error for missing selector', async () => {
      const args = {};

      const result = await handler.execute(mockClient, args);

      expect(result.success).toBe(false);
      expect(result.error).toBe('CSS selector is required for wait_for command');
    });

    it('should return error for non-string selector', async () => {
      const args = {
        selector: 123
      };

      const result = await handler.execute(mockClient, args);

      expect(result.success).toBe(false);
      expect(result.error).toBe('CSS selector must be a string');
    });

    it('should enable Runtime domain', async () => {
      const args = {
        selector: '#element',
        timeout: 100 // Short timeout for test
      };

      // Mock successful condition check
      mockClient.send.mockResolvedValue({ result: { value: { success: true } } });

      await handler.execute(mockClient, args);

      expect(mockClient.send).toHaveBeenCalledWith('Runtime.enable');
    });

    it('should use default condition "exists" when not specified', async () => {
      const args = {
        selector: '#element',
        timeout: 100
      };

      // Mock successful condition check
      mockClient.send.mockResolvedValue({ 
        result: { 
          value: { 
            success: true, 
            condition: 'exists',
            tagName: 'DIV'
          } 
        } 
      });

      const result = await handler.execute(mockClient, args);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        selector: '#element',
        condition: 'exists'
      });
    });

    it('should use "visible" condition when visible option is true', async () => {
      const args = {
        selector: '#element',
        visible: true,
        timeout: 100
      };

      // Mock successful condition check
      mockClient.send.mockResolvedValue({ 
        result: { 
          value: { 
            success: true, 
            condition: 'visible',
            tagName: 'DIV'
          } 
        } 
      });

      const result = await handler.execute(mockClient, args);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        selector: '#element',
        condition: 'visible'
      });
    });

    it('should timeout when condition is not met', async () => {
      const args = {
        selector: '#element',
        timeout: 100
      };

      // Mock condition check that always fails
      mockClient.send.mockResolvedValue({ 
        result: { 
          value: { 
            success: false, 
            error: 'Element does not exist' 
          } 
        } 
      });

      const result = await handler.execute(mockClient, args);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Timeout after 100ms');
    });
  });

  describe('getHelp', () => {
    it('should return help text', () => {
      const help = handler.getHelp();
      expect(help).toContain('wait_for - Wait for an element to appear or meet specific conditions');
      expect(help).toContain('Usage:');
      expect(help).toContain('Examples:');
      expect(help).toContain('Conditions:');
    });
  });
});
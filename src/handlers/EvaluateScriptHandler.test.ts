import { EvaluateScriptHandler } from './EvaluateScriptHandler';
import { CDPClient } from '../types';
import { jest } from '@jest/globals';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn()
  }
}));

const fs = require('fs');

// Mock CDPClient
const mockCDPClient: jest.Mocked<CDPClient> = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  send: jest.fn(),
  on: jest.fn(),
  off: jest.fn()
};

describe('EvaluateScriptHandler', () => {
  let handler: EvaluateScriptHandler;

  beforeEach(() => {
    handler = new EvaluateScriptHandler(false); // Disable proxy for tests
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should execute JavaScript expression successfully', async () => {
      const mockResponse = {
        result: {
          type: 'number',
          value: 4
        }
      };

      mockCDPClient.send.mockResolvedValue(mockResponse);

      const result = await handler.execute(mockCDPClient, {
        expression: '2 + 2'
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe(4);
      expect(mockCDPClient.send).toHaveBeenCalledWith('Runtime.evaluate', {
        expression: '2 + 2',
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
        generatePreview: false
      });
    });

    it('should handle JavaScript execution errors', async () => {
      const mockResponse = {
        result: {
          type: 'undefined'
        },
        exceptionDetails: {
          exceptionId: 1,
          text: 'ReferenceError: undefinedVariable is not defined',
          lineNumber: 1,
          columnNumber: 1,
          exception: {
            type: 'object',
            description: 'ReferenceError: undefinedVariable is not defined'
          }
        }
      };

      mockCDPClient.send.mockResolvedValue(mockResponse);

      const result = await handler.execute(mockCDPClient, {
        expression: 'undefinedVariable'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('ReferenceError: undefinedVariable is not defined');
      expect(result.error).toContain('line 1, column 1');
    });

    it('should execute JavaScript from file', async () => {
      const mockFileContent = 'console.log("Hello from file");';
      const mockResponse = {
        result: {
          type: 'undefined',
          value: undefined
        }
      };

      fs.promises.readFile.mockResolvedValue(mockFileContent);
      mockCDPClient.send.mockResolvedValue(mockResponse);

      const result = await handler.execute(mockCDPClient, {
        file: 'test.js'
      });

      expect(result.success).toBe(true);
      expect(fs.promises.readFile).toHaveBeenCalledWith('test.js', 'utf-8');
      expect(mockCDPClient.send).toHaveBeenCalledWith('Runtime.evaluate', {
        expression: mockFileContent,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
        generatePreview: false
      });
    });

    it('should handle file read errors', async () => {
      fs.promises.readFile.mockRejectedValue(new Error('File not found'));

      const result = await handler.execute(mockCDPClient, {
        file: 'nonexistent.js'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to read script file');
      expect(result.error).toContain('File not found');
    });

    it('should handle timeout', async () => {
      // Mock a slow CDP response
      mockCDPClient.send.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 2000))
      );

      const result = await handler.execute(mockCDPClient, {
        expression: 'while(true) {}',
        timeout: 100
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout after 100ms');
    });

    it('should handle async JavaScript with Promise', async () => {
      const mockResponse = {
        result: {
          type: 'string',
          value: 'async result'
        }
      };

      mockCDPClient.send.mockResolvedValue(mockResponse);

      const result = await handler.execute(mockCDPClient, {
        expression: 'Promise.resolve("async result")',
        awaitPromise: true
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe('async result');
      expect(mockCDPClient.send).toHaveBeenCalledWith('Runtime.evaluate', {
        expression: 'Promise.resolve("async result")',
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
        generatePreview: false
      });
    });

    it('should return error for missing arguments', async () => {
      const result = await handler.execute(mockCDPClient, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Either "expression" or "file" argument is required');
    });

    it('should return error for both expression and file', async () => {
      const result = await handler.execute(mockCDPClient, {
        expression: 'test',
        file: 'test.js'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot specify both "expression" and "file" arguments');
    });
  });

  describe('validateArgs', () => {
    it('should validate correct arguments', () => {
      expect(handler.validateArgs({ expression: 'test' })).toBe(true);
      expect(handler.validateArgs({ file: 'test.js' })).toBe(true);
      expect(handler.validateArgs({ 
        expression: 'test', 
        awaitPromise: true, 
        timeout: 5000 
      })).toBe(true);
    });

    it('should reject invalid arguments', () => {
      expect(handler.validateArgs(null)).toBe(false);
      expect(handler.validateArgs({})).toBe(false);
      expect(handler.validateArgs({ expression: 'test', file: 'test.js' })).toBe(false);
      expect(handler.validateArgs({ expression: 123 })).toBe(false);
      expect(handler.validateArgs({ file: 123 })).toBe(false);
      expect(handler.validateArgs({ expression: 'test', timeout: 'invalid' })).toBe(false);
    });
  });

  describe('getHelp', () => {
    it('should return help text', () => {
      const help = handler.getHelp();
      expect(help).toContain('eval');
      expect(help).toContain('--expression');
      expect(help).toContain('--file');
      expect(help).toContain('Examples:');
    });
  });
});
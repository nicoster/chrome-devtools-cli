import { UploadFileHandler } from './UploadFileHandler';
import { CDPClient } from '../types';
import { jest } from '@jest/globals';
import * as fs from 'fs';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock CDPClient
const mockClient: jest.Mocked<CDPClient> = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  send: jest.fn(),
  on: jest.fn(),
  off: jest.fn()
};

describe('UploadFileHandler', () => {
  let handler: UploadFileHandler;

  beforeEach(() => {
    handler = new UploadFileHandler();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should set correct handler name', () => {
      expect(handler.name).toBe('upload_file');
    });
  });

  describe('validateArgs', () => {
    it('should return true for valid arguments', () => {
      const args = {
        selector: 'input[type="file"]',
        filePath: './test.txt'
      };
      expect(handler.validateArgs(args)).toBe(true);
    });

    it('should return false for missing selector', () => {
      const args = {
        filePath: './test.txt'
      };
      expect(handler.validateArgs(args)).toBe(false);
    });

    it('should return false for missing filePath', () => {
      const args = {
        selector: 'input[type="file"]'
      };
      expect(handler.validateArgs(args)).toBe(false);
    });

    it('should return false for non-string selector', () => {
      const args = {
        selector: 123,
        filePath: './test.txt'
      };
      expect(handler.validateArgs(args)).toBe(false);
    });

    it('should return false for non-string filePath', () => {
      const args = {
        selector: 'input[type="file"]',
        filePath: 123
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
        selector: 'input[type="file"]',
        filePath: './test.txt',
        waitForElement: false,
        timeout: 10000
      };
      expect(handler.validateArgs(args)).toBe(true);
    });

    it('should return false for invalid waitForElement type', () => {
      const args = {
        selector: 'input[type="file"]',
        filePath: './test.txt',
        waitForElement: 'false'
      };
      expect(handler.validateArgs(args)).toBe(false);
    });

    it('should return false for invalid timeout type', () => {
      const args = {
        selector: 'input[type="file"]',
        filePath: './test.txt',
        timeout: 'fast'
      };
      expect(handler.validateArgs(args)).toBe(false);
    });
  });

  describe('execute', () => {
    beforeEach(() => {
      // Mock file system operations
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({
        isFile: () => true,
        size: 1024
      } as any);
    });

    it('should return error for missing selector', async () => {
      const args = {
        filePath: './test.txt'
      };

      const result = await handler.execute(mockClient, args);

      expect(result.success).toBe(false);
      expect(result.error).toBe('CSS selector is required for upload_file command');
    });

    it('should return error for missing filePath', async () => {
      const args = {
        selector: 'input[type="file"]'
      };

      const result = await handler.execute(mockClient, args);

      expect(result.success).toBe(false);
      expect(result.error).toBe('File path is required for upload_file command');
    });

    it('should return error for non-string selector', async () => {
      const args = {
        selector: 123,
        filePath: './test.txt'
      };

      const result = await handler.execute(mockClient, args);

      expect(result.success).toBe(false);
      expect(result.error).toBe('CSS selector must be a string');
    });

    it('should return error for non-string filePath', async () => {
      const args = {
        selector: 'input[type="file"]',
        filePath: 123
      };

      const result = await handler.execute(mockClient, args);

      expect(result.success).toBe(false);
      expect(result.error).toBe('File path must be a string');
    });

    it('should return error for non-existent file', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const args = {
        selector: 'input[type="file"]',
        filePath: './nonexistent.txt'
      };

      const result = await handler.execute(mockClient, args);

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found:');
    });

    it('should return error for directory instead of file', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({
        isFile: () => false
      } as any);

      const args = {
        selector: 'input[type="file"]',
        filePath: './directory'
      };

      const result = await handler.execute(mockClient, args);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Path is not a file:');
    });

    it('should enable DOM and Runtime domains', async () => {
      const args = {
        selector: 'input[type="file"]',
        filePath: './test.txt',
        waitForElement: false
      };

      // Mock successful file input verification and upload
      mockClient.send
        .mockResolvedValueOnce(undefined) // DOM.enable
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({ result: { value: { success: true } } }) // verify file input
        .mockResolvedValueOnce({ root: { nodeId: 1 } }) // DOM.getDocument
        .mockResolvedValueOnce({ nodeId: 2 }) // DOM.querySelector
        .mockResolvedValueOnce(undefined) // DOM.setFileInputFiles
        .mockResolvedValueOnce({ result: { value: { success: true } } }); // trigger change event

      await handler.execute(mockClient, args);

      expect(mockClient.send).toHaveBeenCalledWith('DOM.enable');
      expect(mockClient.send).toHaveBeenCalledWith('Runtime.enable');
    });
  });

  describe('getHelp', () => {
    it('should return help text', () => {
      const help = handler.getHelp();
      expect(help).toContain('upload_file - Upload a file to a file input element');
      expect(help).toContain('Usage:');
      expect(help).toContain('Examples:');
      expect(help).toContain('Requirements:');
    });
  });
});
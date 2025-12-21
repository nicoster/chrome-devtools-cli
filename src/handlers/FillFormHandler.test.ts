import { FillFormHandler } from './FillFormHandler';
import { FillHandler } from './FillHandler';
import { CDPClient } from '../types';
import { jest } from '@jest/globals';

// Mock CDPClient
const mockCDPClient: jest.Mocked<CDPClient> = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  send: jest.fn(),
  on: jest.fn(),
  off: jest.fn()
};

// Mock FillHandler
jest.mock('./FillHandler');
const MockedFillHandler = FillHandler as jest.MockedClass<typeof FillHandler>;

describe('FillFormHandler', () => {
  let handler: FillFormHandler;
  let mockFillHandlerInstance: jest.Mocked<FillHandler>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a mock instance of FillHandler
    mockFillHandlerInstance = {
      name: 'fill',
      execute: jest.fn(),
      validateArgs: jest.fn(),
      getHelp: jest.fn()
    } as any;
    
    // Mock the constructor to return our mock instance
    MockedFillHandler.mockImplementation(() => mockFillHandlerInstance);
    
    handler = new FillFormHandler();
  });

  describe('execute', () => {
    it('should fill multiple form fields successfully', async () => {
      // Mock CDP responses for DOM.enable and Runtime.enable
      mockCDPClient.send
        .mockResolvedValueOnce(undefined) // DOM.enable
        .mockResolvedValueOnce(undefined); // Runtime.enable

      // Mock the FillHandler's execute method to return success for both fields
      mockFillHandlerInstance.execute
        .mockResolvedValueOnce({
          success: true,
          data: {
            selector: '#username',
            text: 'john@example.com',
            element: { tagName: 'INPUT', id: 'username', value: 'john@example.com' },
            method: 'CDP'
          }
        })
        .mockResolvedValueOnce({
          success: true,
          data: {
            selector: '#password',
            text: 'secret123',
            element: { tagName: 'INPUT', id: 'password', value: 'secret123' },
            method: 'CDP'
          }
        });

      const result = await handler.execute(mockCDPClient, {
        fields: [
          { selector: '#username', value: 'john@example.com' },
          { selector: '#password', value: 'secret123' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        summary: {
          total: 2,
          successful: 2,
          failed: 0,
          processed: 2
        }
      });
      const data = result.data as any;
      expect(data.results).toHaveLength(2);
      expect(data.results[0]).toMatchObject({
        selector: '#username',
        value: 'john@example.com',
        success: true
      });
      expect(data.results[1]).toMatchObject({
        selector: '#password',
        value: 'secret123',
        success: true
      });
    });

    it('should handle partial failures with continueOnError=true', async () => {
      // Mock CDP responses for DOM.enable and Runtime.enable
      mockCDPClient.send
        .mockResolvedValueOnce(undefined) // DOM.enable
        .mockResolvedValueOnce(undefined); // Runtime.enable

      // Mock the FillHandler's execute method - first succeeds, second fails
      mockFillHandlerInstance.execute
        .mockResolvedValueOnce({
          success: true,
          data: {
            selector: '#username',
            text: 'john@example.com',
            element: { tagName: 'INPUT', id: 'username', value: 'john@example.com' },
            method: 'CDP'
          }
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'Element with selector "#nonexistent" not found within 500ms'
        });

      const result = await handler.execute(mockCDPClient, {
        fields: [
          { selector: '#username', value: 'john@example.com' },
          { selector: '#nonexistent', value: 'test' }
        ],
        timeout: 500,
        continueOnError: true
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('1 out of 2 fields failed');
      expect(result.data).toMatchObject({
        summary: {
          total: 2,
          successful: 1,
          failed: 1,
          processed: 2
        }
      });
      const data = result.data as any;
      expect(data.results).toHaveLength(2);
      expect(data.results[0].success).toBe(true);
      expect(data.results[1].success).toBe(false);
      expect(data.results[1].error).toContain('not found within 500ms');
    });

    it('should stop on first error when continueOnError=false', async () => {
      // Mock CDP responses for DOM.enable and Runtime.enable
      mockCDPClient.send
        .mockResolvedValueOnce(undefined) // DOM.enable
        .mockResolvedValueOnce(undefined); // Runtime.enable

      // Mock the FillHandler's execute method - first field fails
      mockFillHandlerInstance.execute
        .mockResolvedValueOnce({
          success: false,
          error: 'Element with selector "#nonexistent" not found within 500ms'
        });

      const result = await handler.execute(mockCDPClient, {
        fields: [
          { selector: '#nonexistent', value: 'test' },
          { selector: '#username', value: 'john@example.com' }
        ],
        timeout: 500,
        continueOnError: false
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to fill field "#nonexistent"');
      expect(result.data).toMatchObject({
        summary: {
          total: 2,
          successful: 0,
          failed: 1,
          processed: 1
        }
      });
      const data = result.data as any;
      expect(data.results).toHaveLength(1);
      expect(data.results[0].success).toBe(false);
    });

    it('should fill form without waiting when waitForElements is false', async () => {
      // Mock CDP responses for DOM.enable and Runtime.enable
      mockCDPClient.send
        .mockResolvedValueOnce(undefined) // DOM.enable
        .mockResolvedValueOnce(undefined); // Runtime.enable

      // Mock the FillHandler's execute method
      mockFillHandlerInstance.execute
        .mockResolvedValueOnce({
          success: true,
          data: {
            selector: '#username',
            text: 'test',
            element: { tagName: 'INPUT', id: 'username', value: 'test' },
            method: 'CDP'
          }
        });

      const result = await handler.execute(mockCDPClient, {
        fields: [
          { selector: '#username', value: 'test' }
        ],
        waitForElements: false
      });

      expect(result.success).toBe(true);
      
      // Verify that FillHandler was called with waitForElement: false
      expect(mockFillHandlerInstance.execute).toHaveBeenCalledWith(mockCDPClient, {
        selector: '#username',
        text: 'test',
        waitForElement: false,
        timeout: 5000,
        clearFirst: true
      });
    });

    it('should return error for missing fields', async () => {
      const result = await handler.execute(mockCDPClient, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Fields array is required');
    });

    it('should return error for non-array fields', async () => {
      const result = await handler.execute(mockCDPClient, {
        fields: 'not an array'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Fields must be an array');
    });

    it('should return error for empty fields array', async () => {
      const result = await handler.execute(mockCDPClient, {
        fields: []
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('At least one field is required');
    });

    it('should return error for invalid field selector', async () => {
      const result = await handler.execute(mockCDPClient, {
        fields: [
          { selector: 123, value: 'test' }
        ]
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Field 0: selector is required and must be a string');
    });

    it('should return error for invalid field value', async () => {
      const result = await handler.execute(mockCDPClient, {
        fields: [
          { selector: '#username', value: 123 }
        ]
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Field 0: value is required and must be a string');
    });

    it('should handle clearFirst option', async () => {
      // Mock CDP responses for DOM.enable and Runtime.enable
      mockCDPClient.send
        .mockResolvedValueOnce(undefined) // DOM.enable
        .mockResolvedValueOnce(undefined); // Runtime.enable

      // Mock the FillHandler's execute method
      mockFillHandlerInstance.execute
        .mockResolvedValueOnce({
          success: true,
          data: {
            selector: '#username',
            text: 'test',
            element: { tagName: 'INPUT', id: 'username', value: 'test' },
            method: 'CDP'
          }
        });

      const result = await handler.execute(mockCDPClient, {
        fields: [
          { selector: '#username', value: 'test' }
        ],
        clearFirst: false
      });

      expect(result.success).toBe(true);
      
      // Verify that FillHandler was called with clearFirst: false
      expect(mockFillHandlerInstance.execute).toHaveBeenCalledWith(mockCDPClient, {
        selector: '#username',
        text: 'test',
        waitForElement: true,
        timeout: 5000,
        clearFirst: false
      });
    });
  });

  describe('validateArgs', () => {
    it('should validate correct arguments', () => {
      expect(handler.validateArgs({ 
        fields: [
          { selector: '#username', value: 'test' },
          { selector: '#password', value: 'secret' }
        ]
      })).toBe(true);
      
      expect(handler.validateArgs({ 
        fields: [
          { selector: '.input', value: 'test value' }
        ],
        waitForElements: true, 
        timeout: 5000,
        clearFirst: false,
        continueOnError: true
      })).toBe(true);
    });

    it('should reject invalid arguments', () => {
      expect(handler.validateArgs(null)).toBe(false);
      expect(handler.validateArgs({})).toBe(false);
      expect(handler.validateArgs({ fields: 'not array' })).toBe(false);
      expect(handler.validateArgs({ fields: [] })).toBe(false);
      expect(handler.validateArgs({ 
        fields: [{ selector: 123, value: 'test' }] 
      })).toBe(false);
      expect(handler.validateArgs({ 
        fields: [{ selector: '#test', value: 123 }] 
      })).toBe(false);
      expect(handler.validateArgs({ 
        fields: [{ selector: '#test', value: 'test' }],
        timeout: 'invalid' 
      })).toBe(false);
      expect(handler.validateArgs({ 
        fields: [{ selector: '#test', value: 'test' }],
        waitForElements: 'yes' 
      })).toBe(false);
    });
  });

  describe('getHelp', () => {
    it('should return help text', () => {
      const help = handler.getHelp();
      expect(help).toContain('fill_form');
      expect(help).toContain('fields');
      expect(help).toContain('selector');
      expect(help).toContain('value');
      expect(help).toContain('--timeout');
      expect(help).toContain('--continue-on-error');
      expect(help).toContain('Examples:');
    });
  });
});
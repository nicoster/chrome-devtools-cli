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

describe('FillHandler', () => {
  let handler: FillHandler;

  beforeEach(() => {
    handler = new FillHandler();
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should fill input element successfully using CDP', async () => {
      // Mock CDP responses
      mockCDPClient.send
        .mockResolvedValueOnce(undefined) // DOM.enable
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({ result: { value: true } }) // Element exists check
        .mockResolvedValueOnce({ root: { nodeId: 1 } }) // DOM.getDocument
        .mockResolvedValueOnce({ nodeId: 123 }) // DOM.querySelector
        .mockResolvedValueOnce({ object: { objectId: 'obj-123' } }) // DOM.resolveNode
        .mockResolvedValueOnce({ // Runtime.callFunctionOn
          result: {
            value: {
              success: true,
              tagName: 'INPUT',
              id: 'username',
              className: 'form-control',
              value: 'john@example.com',
              type: 'email'
            }
          }
        });

      const result = await handler.execute(mockCDPClient, {
        selector: '#username',
        text: 'john@example.com'
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        selector: '#username',
        text: 'john@example.com',
        method: 'CDP'
      });
      expect(mockCDPClient.send).toHaveBeenCalledWith('DOM.enable');
      expect(mockCDPClient.send).toHaveBeenCalledWith('Runtime.enable');
    });

    it('should fill textarea element successfully', async () => {
      // Mock CDP responses
      mockCDPClient.send
        .mockResolvedValueOnce(undefined) // DOM.enable
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({ result: { value: true } }) // Element exists check
        .mockResolvedValueOnce({ root: { nodeId: 1 } }) // DOM.getDocument
        .mockResolvedValueOnce({ nodeId: 123 }) // DOM.querySelector
        .mockResolvedValueOnce({ object: { objectId: 'obj-123' } }) // DOM.resolveNode
        .mockResolvedValueOnce({ // Runtime.callFunctionOn
          result: {
            value: {
              success: true,
              tagName: 'TEXTAREA',
              id: 'message',
              className: 'form-control',
              value: 'Hello, this is a test message',
              type: null
            }
          }
        });

      const result = await handler.execute(mockCDPClient, {
        selector: '#message',
        text: 'Hello, this is a test message'
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        selector: '#message',
        text: 'Hello, this is a test message',
        method: 'CDP'
      });
    });

    it('should fill select element successfully', async () => {
      // Mock CDP responses
      mockCDPClient.send
        .mockResolvedValueOnce(undefined) // DOM.enable
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({ result: { value: true } }) // Element exists check
        .mockResolvedValueOnce({ root: { nodeId: 1 } }) // DOM.getDocument
        .mockResolvedValueOnce({ nodeId: 123 }) // DOM.querySelector
        .mockResolvedValueOnce({ object: { objectId: 'obj-123' } }) // DOM.resolveNode
        .mockResolvedValueOnce({ // Runtime.callFunctionOn
          result: {
            value: {
              success: true,
              tagName: 'SELECT',
              id: 'country',
              className: 'form-select',
              value: 'US',
              type: null
            }
          }
        });

      const result = await handler.execute(mockCDPClient, {
        selector: '#country',
        text: 'US'
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        selector: '#country',
        text: 'US',
        method: 'CDP'
      });
    });

    it('should fill element using eval fallback when CDP fails', async () => {
      // Mock CDP responses - CDP approach fails
      mockCDPClient.send
        .mockResolvedValueOnce(undefined) // DOM.enable
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({ result: { value: true } }) // Element exists check
        .mockResolvedValueOnce({ root: { nodeId: 1 } }) // DOM.getDocument
        .mockRejectedValueOnce(new Error('CDP failed')) // DOM.querySelector fails
        .mockResolvedValueOnce({ // Runtime.evaluate (eval fallback)
          result: {
            value: {
              success: true,
              tagName: 'INPUT',
              id: 'username',
              className: 'form-control',
              value: 'john@example.com',
              type: 'email'
            }
          }
        });

      const result = await handler.execute(mockCDPClient, {
        selector: '#username',
        text: 'john@example.com'
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        selector: '#username',
        text: 'john@example.com',
        method: 'eval'
      });
    });

    it('should return error when element not found', async () => {
      // Mock element not found
      mockCDPClient.send
        .mockResolvedValueOnce(undefined) // DOM.enable
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValue({ result: { value: false } }); // Element never exists

      const result = await handler.execute(mockCDPClient, {
        selector: '#nonexistent',
        text: 'test',
        timeout: 500
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found within 500ms');
    });

    it('should fill without waiting when waitForElement is false', async () => {
      // Mock CDP responses
      mockCDPClient.send
        .mockResolvedValueOnce(undefined) // DOM.enable
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({ root: { nodeId: 1 } }) // DOM.getDocument
        .mockResolvedValueOnce({ nodeId: 123 }) // DOM.querySelector
        .mockResolvedValueOnce({ object: { objectId: 'obj-123' } }) // DOM.resolveNode
        .mockResolvedValueOnce({ // Runtime.callFunctionOn
          result: {
            value: {
              success: true,
              tagName: 'INPUT',
              id: 'username',
              className: 'form-control',
              value: 'test',
              type: 'text'
            }
          }
        });

      const result = await handler.execute(mockCDPClient, {
        selector: '#username',
        text: 'test',
        waitForElement: false
      });

      expect(result.success).toBe(true);
      // Should not call element exists check
      expect(mockCDPClient.send).not.toHaveBeenCalledWith('Runtime.evaluate', 
        expect.objectContaining({
          expression: expect.stringContaining('querySelector')
        })
      );
    });

    it('should return error for missing selector', async () => {
      const result = await handler.execute(mockCDPClient, {
        text: 'test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('CSS selector is required');
    });

    it('should return error for missing text', async () => {
      const result = await handler.execute(mockCDPClient, {
        selector: '#username'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Text value is required');
    });

    it('should return error for invalid selector type', async () => {
      const result = await handler.execute(mockCDPClient, {
        selector: 123,
        text: 'test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('CSS selector must be a string');
    });

    it('should return error for invalid text type', async () => {
      const result = await handler.execute(mockCDPClient, {
        selector: '#username',
        text: 123
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Text value must be a string');
    });

    it('should handle CDP execution errors', async () => {
      // Mock CDP responses with exception
      mockCDPClient.send
        .mockResolvedValueOnce(undefined) // DOM.enable
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({ result: { value: true } }) // Element exists check
        .mockResolvedValueOnce({ root: { nodeId: 1 } }) // DOM.getDocument
        .mockResolvedValueOnce({ nodeId: 123 }) // DOM.querySelector
        .mockResolvedValueOnce({ object: { objectId: 'obj-123' } }) // DOM.resolveNode
        .mockResolvedValueOnce({ // Runtime.callFunctionOn with exception
          exceptionDetails: {
            exceptionId: 1,
            text: 'Element is not a form field',
            lineNumber: 1,
            columnNumber: 1,
            exception: {
              type: 'object',
              description: 'Element is not a form field'
            }
          }
        })
        .mockResolvedValueOnce({ // Eval fallback
          result: {
            value: {
              success: true,
              tagName: 'INPUT',
              id: 'username',
              className: 'form-control',
              value: 'test',
              type: 'text'
            }
          }
        });

      const result = await handler.execute(mockCDPClient, {
        selector: '#username',
        text: 'test'
      });

      // Should succeed with eval fallback
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        method: 'eval'
      });
    });

    it('should handle clearFirst option', async () => {
      // Mock CDP responses
      mockCDPClient.send
        .mockResolvedValueOnce(undefined) // DOM.enable
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({ result: { value: true } }) // Element exists check
        .mockResolvedValueOnce({ root: { nodeId: 1 } }) // DOM.getDocument
        .mockResolvedValueOnce({ nodeId: 123 }) // DOM.querySelector
        .mockResolvedValueOnce({ object: { objectId: 'obj-123' } }) // DOM.resolveNode
        .mockResolvedValueOnce({ // Runtime.callFunctionOn
          result: {
            value: {
              success: true,
              tagName: 'INPUT',
              id: 'username',
              className: 'form-control',
              value: 'existing text + new text',
              type: 'text'
            }
          }
        });

      const result = await handler.execute(mockCDPClient, {
        selector: '#username',
        text: 'new text',
        clearFirst: false
      });

      expect(result.success).toBe(true);
      // The function should be called with clearFirst = false
      expect(mockCDPClient.send).toHaveBeenCalledWith('Runtime.callFunctionOn', 
        expect.objectContaining({
          arguments: [
            { value: 'new text' },
            { value: false }
          ]
        })
      );
    });
  });

  describe('validateArgs', () => {
    it('should validate correct arguments', () => {
      expect(handler.validateArgs({ 
        selector: '#test', 
        text: 'value' 
      })).toBe(true);
      
      expect(handler.validateArgs({ 
        selector: '.input', 
        text: 'test value',
        waitForElement: true, 
        timeout: 5000,
        clearFirst: false
      })).toBe(true);
    });

    it('should reject invalid arguments', () => {
      expect(handler.validateArgs(null)).toBe(false);
      expect(handler.validateArgs({})).toBe(false);
      expect(handler.validateArgs({ selector: '#test' })).toBe(false); // missing text
      expect(handler.validateArgs({ text: 'value' })).toBe(false); // missing selector
      expect(handler.validateArgs({ selector: 123, text: 'value' })).toBe(false);
      expect(handler.validateArgs({ selector: '#test', text: 123 })).toBe(false);
      expect(handler.validateArgs({ selector: '#test', text: 'value', timeout: 'invalid' })).toBe(false);
      expect(handler.validateArgs({ selector: '#test', text: 'value', waitForElement: 'yes' })).toBe(false);
      expect(handler.validateArgs({ selector: '#test', text: 'value', clearFirst: 'yes' })).toBe(false);
    });
  });

  describe('getHelp', () => {
    it('should return help text', () => {
      const help = handler.getHelp();
      expect(help).toContain('fill');
      expect(help).toContain('selector');
      expect(help).toContain('text');
      expect(help).toContain('--timeout');
      expect(help).toContain('--clear-first');
      expect(help).toContain('Examples:');
    });
  });
});
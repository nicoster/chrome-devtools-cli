import { HoverHandler } from './HoverHandler';
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

describe('HoverHandler', () => {
  let handler: HoverHandler;

  beforeEach(() => {
    handler = new HoverHandler();
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should hover over element successfully using CDP', async () => {
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
              tagName: 'DIV',
              id: 'menu-item',
              className: 'dropdown-trigger'
            }
          }
        });

      const result = await handler.execute(mockCDPClient, {
        selector: '#menu-item'
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        selector: '#menu-item',
        method: 'CDP'
      });
      expect(mockCDPClient.send).toHaveBeenCalledWith('DOM.enable');
      expect(mockCDPClient.send).toHaveBeenCalledWith('Runtime.enable');
    });

    it('should hover over element using eval fallback when CDP fails', async () => {
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
              tagName: 'DIV',
              id: 'menu-item',
              className: 'dropdown-trigger'
            }
          }
        });

      const result = await handler.execute(mockCDPClient, {
        selector: '#menu-item'
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        selector: '#menu-item',
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
        timeout: 500
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found within 500ms');
    });

    it('should hover without waiting when waitForElement is false', async () => {
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
              tagName: 'DIV',
              id: 'menu-item',
              className: 'dropdown-trigger'
            }
          }
        });

      const result = await handler.execute(mockCDPClient, {
        selector: '#menu-item',
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
      const result = await handler.execute(mockCDPClient, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('CSS selector is required');
    });

    it('should return error for invalid selector type', async () => {
      const result = await handler.execute(mockCDPClient, {
        selector: 123
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('CSS selector must be a string');
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
            text: 'Element is not hoverable',
            lineNumber: 1,
            columnNumber: 1,
            exception: {
              type: 'object',
              description: 'Element is not hoverable'
            }
          }
        })
        .mockResolvedValueOnce({ // Eval fallback
          result: {
            value: {
              success: true,
              tagName: 'DIV',
              id: 'menu-item',
              className: 'dropdown-trigger'
            }
          }
        });

      const result = await handler.execute(mockCDPClient, {
        selector: '#menu-item'
      });

      // Should succeed with eval fallback
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        method: 'eval'
      });
    });

    it('should handle eval execution errors', async () => {
      // Mock CDP approach fails and eval also fails
      mockCDPClient.send
        .mockResolvedValueOnce(undefined) // DOM.enable
        .mockResolvedValueOnce(undefined) // Runtime.enable
        .mockResolvedValueOnce({ result: { value: true } }) // Element exists check
        .mockResolvedValueOnce({ root: { nodeId: 1 } }) // DOM.getDocument
        .mockRejectedValueOnce(new Error('CDP failed')) // DOM.querySelector fails
        .mockResolvedValueOnce({ // Runtime.evaluate (eval fallback) with exception
          exceptionDetails: {
            text: 'Element with selector "#nonexistent" not found'
          }
        });

      const result = await handler.execute(mockCDPClient, {
        selector: '#nonexistent'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Element with selector "#nonexistent" not found');
    });
  });

  describe('validateArgs', () => {
    it('should validate correct arguments', () => {
      expect(handler.validateArgs({ selector: '#test' })).toBe(true);
      expect(handler.validateArgs({ 
        selector: '.menu-item', 
        waitForElement: true, 
        timeout: 5000 
      })).toBe(true);
    });

    it('should reject invalid arguments', () => {
      expect(handler.validateArgs(null)).toBe(false);
      expect(handler.validateArgs({})).toBe(false);
      expect(handler.validateArgs({ selector: 123 })).toBe(false);
      expect(handler.validateArgs({ selector: '#test', timeout: 'invalid' })).toBe(false);
      expect(handler.validateArgs({ selector: '#test', waitForElement: 'yes' })).toBe(false);
    });
  });

  describe('getHelp', () => {
    it('should return help text', () => {
      const help = handler.getHelp();
      expect(help).toContain('hover');
      expect(help).toContain('selector');
      expect(help).toContain('--timeout');
      expect(help).toContain('mouseover');
      expect(help).toContain('Examples:');
    });
  });
});
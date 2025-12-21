import { HandleDialogHandler } from './HandleDialogHandler';
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

describe('HandleDialogHandler', () => {
  let handler: HandleDialogHandler;

  beforeEach(() => {
    handler = new HandleDialogHandler();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should set correct handler name', () => {
      expect(handler.name).toBe('handle_dialog');
    });
  });

  describe('validateArgs', () => {
    it('should return true for valid accept action', () => {
      const args = {
        action: 'accept' as const
      };
      expect(handler.validateArgs(args)).toBe(true);
    });

    it('should return true for valid dismiss action', () => {
      const args = {
        action: 'dismiss' as const
      };
      expect(handler.validateArgs(args)).toBe(true);
    });

    it('should return false for missing action', () => {
      const args = {};
      expect(handler.validateArgs(args)).toBe(false);
    });

    it('should return false for invalid action', () => {
      const args = {
        action: 'invalid'
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
        action: 'accept' as const,
        text: 'user input',
        waitForDialog: false,
        timeout: 10000
      };
      expect(handler.validateArgs(args)).toBe(true);
    });

    it('should return false for invalid text type', () => {
      const args = {
        action: 'accept' as const,
        text: 123
      };
      expect(handler.validateArgs(args)).toBe(false);
    });

    it('should return false for invalid waitForDialog type', () => {
      const args = {
        action: 'accept' as const,
        waitForDialog: 'false'
      };
      expect(handler.validateArgs(args)).toBe(false);
    });

    it('should return false for invalid timeout type', () => {
      const args = {
        action: 'accept' as const,
        timeout: 'fast'
      };
      expect(handler.validateArgs(args)).toBe(false);
    });
  });

  describe('execute', () => {
    it('should return error for missing action', async () => {
      const args = {};

      const result = await handler.execute(mockClient, args);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Action is required for handle_dialog command (accept or dismiss)');
    });

    it('should return error for invalid action', async () => {
      const args = {
        action: 'invalid'
      };

      const result = await handler.execute(mockClient, args);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Action must be either "accept" or "dismiss"');
    });

    it('should enable Page and Runtime domains', async () => {
      const args = {
        action: 'accept' as const,
        waitForDialog: false
      };

      // Mock no pending dialog
      await handler.execute(mockClient, args);

      expect(mockClient.send).toHaveBeenCalledWith('Page.enable');
      expect(mockClient.send).toHaveBeenCalledWith('Runtime.enable');
    });

    it('should return error when no dialog is present and not waiting', async () => {
      const args = {
        action: 'accept' as const,
        waitForDialog: false
      };

      const result = await handler.execute(mockClient, args);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No dialog is currently open');
    });

    it('should set up dialog event listener', async () => {
      const args = {
        action: 'accept' as const,
        waitForDialog: false
      };

      await handler.execute(mockClient, args);

      expect(mockClient.off).toHaveBeenCalledWith('Page.javascriptDialogOpening', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('Page.javascriptDialogOpening', expect.any(Function));
    });
  });

  describe('getHelp', () => {
    it('should return help text', () => {
      const help = handler.getHelp();
      expect(help).toContain('handle_dialog - Handle browser dialogs');
      expect(help).toContain('Usage:');
      expect(help).toContain('Examples:');
      expect(help).toContain('Dialog Types:');
      expect(help).toContain('Actions:');
    });
  });
});
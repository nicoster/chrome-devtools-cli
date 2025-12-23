import * as fc from 'fast-check';
import { 
  CLIConfig, 
  CDPMessage, 
  BrowserTarget,
  CommandResult
} from './index';

describe('Type Definitions', () => {
  describe('CLIConfig', () => {
    it('should have all required properties', () => {
      const config: CLIConfig = {
        host: 'localhost',
        port: 9222,
        outputFormat: 'json',
        verbose: true,
        quiet: false,
        timeout: 30000,
        debug: false
      };

      expect(config.host).toBe('localhost');
      expect(config.port).toBe(9222);
      expect(config.outputFormat).toBe('json');
      expect(config.verbose).toBe(true);
      expect(config.quiet).toBe(false);
      expect(config.timeout).toBe(30000);
      expect(config.debug).toBe(false);
    });
  });

  describe('CDPMessage', () => {
    it('should create valid CDP message', () => {
      const message: CDPMessage = {
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression: 'console.log("test")' }
      };

      expect(message).toBeValidCDPMessage();
    });
  });

  describe('CommandResult', () => {
    it('should create valid command result', () => {
      const result: CommandResult = {
        success: true,
        data: { value: 'test' }
      };

      expect(result).toBeValidCommandResult();
    });

    it('should create valid error result', () => {
      const result: CommandResult = {
        success: false,
        error: 'Test error'
      };

      expect(result).toBeValidCommandResult();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
    });
  });

  describe('BrowserTarget', () => {
    it('should have all required properties', () => {
      const target: BrowserTarget = {
        id: 'target-1',
        type: 'page',
        title: 'Test Page',
        url: 'https://example.com',
        webSocketDebuggerUrl: 'ws://localhost:9222/devtools/page/target-1'
      };

      expect(target.id).toBe('target-1');
      expect(target.type).toBe('page');
      expect(target.title).toBe('Test Page');
      expect(target.url).toBe('https://example.com');
      expect(target.webSocketDebuggerUrl).toContain('ws://');
    });
  });

  describe('Property-based tests', () => {
    it('should validate CDPMessage structure', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1 }),
        fc.string({ minLength: 1 }),
        fc.option(fc.object()),
        (id, method, params) => {
          const message: CDPMessage = { id, method, params };
          expect(typeof message.id).toBe('number');
          expect(typeof message.method).toBe('string');
          expect(message.id).toBeGreaterThan(0);
          expect(message.method.length).toBeGreaterThan(0);
        }
      ));
    });

    it('should validate CommandResult structure', () => {
      fc.assert(fc.property(
        fc.boolean(),
        fc.option(fc.anything()),
        fc.option(fc.string()),
        (success, data, error) => {
          const result: CommandResult = { 
            success, 
            data, 
            error: error || undefined 
          };
          expect(typeof result.success).toBe('boolean');
          if (!success && result.error) {
            expect(typeof result.error).toBe('string');
          }
        }
      ));
    });
  });
});
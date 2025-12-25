/**
 * Integration tests for the output formatting system
 * Tests the complete flow from CLI interface through to formatted output
 */

import { CLIInterface } from './CLIInterface';
import { CommandResult, CLIConfig } from '../types';

describe('Output Formatting Integration', () => {
  let cli: CLIInterface;

  beforeEach(() => {
    cli = new CLIInterface();
  });

  describe('Format Integration', () => {
    it('should format JSON output correctly', () => {
      const result: CommandResult = {
        success: true,
        data: { message: 'test', count: 42 }
      };

      const output = cli.formatOutput(result, 'json');
      
      expect(() => JSON.parse(output)).not.toThrow();
      const parsed = JSON.parse(output);
      expect(parsed.success).toBe(true);
      expect(parsed.data).toEqual({ message: 'test', count: 42 });
    });

    it('should format text output correctly', () => {
      const result: CommandResult = {
        success: true,
        data: 'Hello World'
      };

      const output = cli.formatOutput(result, 'text');
      expect(output).toBe('Hello World');
    });

    it('should format YAML output correctly', () => {
      const result: CommandResult = {
        success: true,
        data: { message: 'test' }
      };

      const output = cli.formatOutput(result, 'yaml');
      expect(output).toContain('success: true');
      expect(output).toContain('message: "test"');
    });
  });

  describe('Error Formatting Integration', () => {
    it('should format errors consistently across formats', () => {
      const config: CLIConfig = {
        host: 'localhost',
        port: 9222,
        outputFormat: 'json',
        verbose: false,
        quiet: false,
        timeout: 30000,
        debug: false
      };

      const errorOutput = cli.formatError('Test error', config, 2);
      
      expect(() => JSON.parse(errorOutput)).not.toThrow();
      const parsed = JSON.parse(errorOutput);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Test error');
      expect(parsed.exitCode).toBe(2);
    });
  });

  describe('Success Formatting Integration', () => {
    it('should format success output', () => {
      const config: CLIConfig = {
        host: 'localhost',
        port: 9222,
        outputFormat: 'text',
        verbose: false,
        quiet: false,
        timeout: 30000,
        debug: false
      };

      const successOutput = cli.formatSuccess('Operation completed', config);
      expect(successOutput).toBe('Operation completed');
    });
  });

  describe('Template Integration', () => {
    it('should support custom templates', () => {
      const config: CLIConfig = {
        host: 'localhost',
        port: 9222,
        outputFormat: 'text',
        verbose: false,
        quiet: false,
        timeout: 30000,
        debug: false
      };

      const result: CommandResult = {
        success: true,
        data: 'test data'
      };

      // Register a custom template through the output manager
      const outputManager = cli.getOutputManager();
      outputManager.registerTemplate(
        'test-template',
        'Test template',
        'Result: {{success}}, Data: {{data}}',
        ['success', 'data']
      );

      const output = cli.formatOutputWithTemplate(result, config, 'test-template');
      expect(output).toBe('Result: true, Data: test data');
    });
  });

  describe('Mode Integration', () => {
    it('should handle quiet mode correctly', () => {
      const quietConfig: CLIConfig = {
        host: 'localhost',
        port: 9222,
        outputFormat: 'text',
        verbose: false,
        quiet: true,
        timeout: 30000,
        debug: false
      };

      const outputManager = cli.getOutputManager();

      // Should suppress output for successful results with no data
      const emptyResult: CommandResult = { success: true };
      expect(outputManager.shouldSuppressOutput(quietConfig, emptyResult)).toBe(true);

      // Should not suppress for results with data
      const dataResult: CommandResult = { success: true, data: 'some data' };
      expect(outputManager.shouldSuppressOutput(quietConfig, dataResult)).toBe(false);

      // Should not suppress for errors
      const errorResult: CommandResult = { success: false, error: 'error' };
      expect(outputManager.shouldSuppressOutput(quietConfig, errorResult)).toBe(false);
    });

    it('should handle verbose mode with timing', () => {
      const outputManager = cli.getOutputManager();
      const timing = outputManager.getTimingInfo(1000, 1500, 'test-operation');
      
      expect(timing).toBe('⏱️  test-operation: 500ms');
    });
  });

  describe('Data Source Integration', () => {
    it('should format data source information', () => {
      const outputManager = cli.getOutputManager();
      
      const proxyInfo = outputManager.formatDataSourceInfo('proxy', true);
      expect(proxyInfo).toContain('📊 Data from proxy server (includes historical data)');
      
      const directInfo = outputManager.formatDataSourceInfo('direct', false);
      expect(directInfo).toContain('⚠️ Data from direct connection (new data only)');
    });
  });

  describe('Utility Integration', () => {
    it('should format validation errors', () => {
      const outputManager = cli.getOutputManager();
      
      const errors = [
        { field: 'host', message: 'Invalid format', suggestion: 'Use localhost' },
        { field: 'port', message: 'Out of range' }
      ];

      const output = outputManager.formatValidationErrors(errors);
      
      expect(output).toContain('❌ Validation Errors:');
      expect(output).toContain('1. host: Invalid format');
      expect(output).toContain('💡 Suggestion: Use localhost');
      expect(output).toContain('2. port: Out of range');
    });

    it('should format help information', () => {
      const outputManager = cli.getOutputManager();
      
      const examples = [
        'chrome-cdp-cli screenshot --filename=test.png',
        'chrome-cdp-cli eval "document.title"'
      ];

      const output = outputManager.formatHelpInfo(
        'Test Command',
        'This is a test command description',
        examples
      );

      expect(output).toContain('📖 Test Command');
      expect(output).toContain('This is a test command description');
      expect(output).toContain('💡 Examples:');
      expect(output).toContain('1. chrome-cdp-cli screenshot --filename=test.png');
      expect(output).toContain('2. chrome-cdp-cli eval "document.title"');
    });
  });

  describe('Complex Data Integration', () => {
    it('should format console messages correctly', () => {
      const result: CommandResult = {
        success: true,
        data: {
          messages: [
            {
              type: 'log',
              text: 'Test message',
              timestamp: 1640995200000,
              args: ['arg1', 'arg2']
            }
          ]
        },
        dataSource: 'proxy',
        hasHistoricalData: true
      };

      const config: CLIConfig = {
        host: 'localhost',
        port: 9222,
        outputFormat: 'text',
        verbose: true,
        quiet: false,
        timeout: 30000,
        debug: false
      };

      const outputManager = cli.getOutputManager();
      const output = outputManager.formatOutput(result, config);
      
      expect(output).toContain('📊 Data from proxy server (includes historical data)');
      expect(output).toContain('Found 1 console message(s)');
      expect(output).toContain('Test message');
      expect(output).toContain('📝'); // log icon
    });

    it('should format network requests correctly', () => {
      const result: CommandResult = {
        success: true,
        data: {
          requests: [
            {
              requestId: '1',
              url: 'https://example.com/api',
              method: 'GET',
              timestamp: 1640995200000,
              status: 200
            }
          ]
        }
      };

      const output = cli.formatOutput(result, 'text');
      
      expect(output).toContain('Found 1 network request(s)');
      expect(output).toContain('GET https://example.com/api [200]');
      expect(output).toContain('📥'); // GET icon
    });
  });
});
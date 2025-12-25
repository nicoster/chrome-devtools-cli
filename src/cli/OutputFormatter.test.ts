/**
 * Unit tests for OutputFormatter
 */

import { OutputFormatter, createOutputOptions, createTimingInfo, enhanceCommandResult } from './OutputFormatter';
import { CommandResult, CLIConfig } from '../types';

describe('OutputFormatter', () => {
  let formatter: OutputFormatter;
  let mockConfig: CLIConfig;

  beforeEach(() => {
    formatter = new OutputFormatter();
    mockConfig = {
      host: 'localhost',
      port: 9222,
      outputFormat: 'text',
      verbose: false,
      quiet: false,
      timeout: 30000,
      debug: false
    };
  });

  describe('JSON Output Format', () => {
    it('should format successful result as valid JSON', () => {
      const result: CommandResult = {
        success: true,
        data: { message: 'test' }
      };

      const options = createOutputOptions({ ...mockConfig, outputFormat: 'json' });
      const output = formatter.formatOutput(result, options);
      
      expect(() => JSON.parse(output)).not.toThrow();
      const parsed = JSON.parse(output);
      expect(parsed.success).toBe(true);
      expect(parsed.data).toEqual({ message: 'test' });
    });

    it('should format error result as valid JSON', () => {
      const result: CommandResult = {
        success: false,
        error: 'Test error',
        exitCode: 1
      };

      const options = createOutputOptions({ ...mockConfig, outputFormat: 'json' });
      const output = formatter.formatOutput(result, options);
      
      expect(() => JSON.parse(output)).not.toThrow();
      const parsed = JSON.parse(output);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Test error');
      expect(parsed.exitCode).toBe(1);
    });

    it('should include timing information in verbose mode', () => {
      const result: CommandResult = {
        success: true,
        data: 'test'
      };

      const timing = createTimingInfo('test-operation', 1000, 1500);
      const enhancedResult = enhanceCommandResult(result, timing);
      
      const options = createOutputOptions({ ...mockConfig, outputFormat: 'json', verbose: true }, false, true);
      const output = formatter.formatOutput(enhancedResult, options);
      
      const parsed = JSON.parse(output);
      expect(parsed.timing).toBeDefined();
      expect(parsed.timing.duration).toBe('500ms');
      expect(parsed.timing.operation).toBe('test-operation');
    });
  });

  describe('Text Output Format', () => {
    it('should format simple string data', () => {
      const result: CommandResult = {
        success: true,
        data: 'Hello World'
      };

      const options = createOutputOptions(mockConfig);
      const output = formatter.formatOutput(result, options);
      
      expect(output).toBe('Hello World');
    });

    it('should format console messages array', () => {
      const result: CommandResult = {
        success: true,
        data: {
          messages: [
            {
              type: 'log',
              text: 'Test message',
              timestamp: 1640995200000,
              args: []
            }
          ]
        }
      };

      const options = createOutputOptions(mockConfig);
      const output = formatter.formatOutput(result, options);
      
      expect(output).toContain('Found 1 console message(s)');
      expect(output).toContain('Test message');
      expect(output).toContain('📝'); // log icon
    });

    it('should format network requests array', () => {
      const result: CommandResult = {
        success: true,
        data: {
          requests: [
            {
              requestId: '1',
              url: 'https://example.com',
              method: 'GET',
              timestamp: 1640995200000,
              status: 200
            }
          ]
        }
      };

      const options = createOutputOptions(mockConfig);
      const output = formatter.formatOutput(result, options);
      
      expect(output).toContain('Found 1 network request(s)');
      expect(output).toContain('GET https://example.com [200]');
      expect(output).toContain('📥'); // GET icon
    });

    it('should show timing information in verbose mode', () => {
      const result: CommandResult = {
        success: true,
        data: 'test'
      };

      const timing = createTimingInfo('test-command', 1000, 1250);
      const enhancedResult = enhanceCommandResult(result, timing);
      
      const options = createOutputOptions({ ...mockConfig, verbose: true }, false, true);
      const output = formatter.formatOutput(enhancedResult, options);
      
      expect(output).toContain('⏱️  Operation: test-command (250ms)');
    });

    it('should show data source information in verbose mode', () => {
      const result: CommandResult = {
        success: true,
        data: { messages: [] },
        dataSource: 'proxy',
        hasHistoricalData: true
      };

      const options = createOutputOptions({ ...mockConfig, verbose: true });
      const output = formatter.formatOutput(result, options);
      
      expect(output).toContain('📊 Data from proxy server (includes historical data)');
    });
  });

  describe('Quiet Mode', () => {
    it('should suppress output for successful results with no data', () => {
      const result: CommandResult = {
        success: true
      };

      const options = createOutputOptions({ ...mockConfig, quiet: true });
      const output = formatter.formatOutput(result, options);
      
      expect(output).toBe('');
    });

    it('should return minimal output for data in quiet mode', () => {
      const result: CommandResult = {
        success: true,
        data: { messages: [1, 2, 3] }
      };

      const options = createOutputOptions({ ...mockConfig, quiet: true });
      const output = formatter.formatOutput(result, options);
      
      expect(output).toBe('3'); // Just the count
    });

    it('should still show errors in quiet mode', () => {
      const result: CommandResult = {
        success: false,
        error: 'Test error'
      };

      const options = createOutputOptions({ ...mockConfig, quiet: true });
      const output = formatter.formatOutput(result, options);
      
      expect(output).toContain('❌ Error: Test error');
    });
  });

  describe('YAML Output Format', () => {
    it('should format result as YAML', () => {
      const result: CommandResult = {
        success: true,
        data: { message: 'test', count: 42 }
      };

      const options = createOutputOptions({ ...mockConfig, outputFormat: 'yaml' });
      const output = formatter.formatOutput(result, options);
      
      expect(output).toContain('success: true');
      expect(output).toContain('data:');
      expect(output).toContain('message: "test"');
      expect(output).toContain('count: 42');
    });
  });

  describe('Custom Templates', () => {
    it('should apply custom template', () => {
      formatter.registerTemplate({
        name: 'test-template',
        description: 'Test template',
        template: 'Result: {{success}}, Data: {{data}}',
        variables: ['success', 'data']
      });

      const result: CommandResult = {
        success: true,
        data: 'hello'
      };

      const options = createOutputOptions(mockConfig);
      options.template = 'test-template';
      
      const output = formatter.formatOutput(result, options);
      expect(output).toBe('Result: true, Data: hello');
    });

    it('should throw error for unknown template', () => {
      const result: CommandResult = {
        success: true,
        data: 'test'
      };

      const options = createOutputOptions(mockConfig);
      options.template = 'unknown-template';
      
      expect(() => formatter.formatOutput(result, options)).toThrow('Unknown template: unknown-template');
    });
  });

  describe('Error Handling', () => {
    it('should format errors consistently across formats', () => {
      const result: CommandResult = {
        success: false,
        error: 'Connection failed',
        exitCode: 2
      };

      // Test JSON format
      const jsonOptions = createOutputOptions({ ...mockConfig, outputFormat: 'json' });
      const jsonOutput = formatter.formatOutput(result, jsonOptions);
      const parsed = JSON.parse(jsonOutput);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Connection failed');
      expect(parsed.exitCode).toBe(2);

      // Test text format
      const textOptions = createOutputOptions(mockConfig);
      const textOutput = formatter.formatOutput(result, textOptions);
      expect(textOutput).toContain('❌ Error: Connection failed');
    });

    it('should include debug information in debug mode', () => {
      const result: CommandResult = {
        success: false,
        error: 'Test error',
        exitCode: 1
      };

      const timing = createTimingInfo('failed-operation', 1000, 1100);
      const enhancedResult = enhanceCommandResult(result, timing);

      const options = createOutputOptions({ ...mockConfig, debug: true }, false, true);
      const output = formatter.formatOutput(enhancedResult, options);
      
      expect(output).toContain('Exit Code: 1');
      expect(output).toContain('Duration: 100ms');
    });
  });

  describe('Helper Functions', () => {
    it('should create timing info correctly', () => {
      const timing = createTimingInfo('test-op', 1000, 1500);
      
      expect(timing.operationName).toBe('test-op');
      expect(timing.startTime).toBe(1000);
      expect(timing.endTime).toBe(1500);
      expect(timing.duration).toBe(500);
    });

    it('should enhance command result with timing and metadata', () => {
      const result: CommandResult = {
        success: true,
        data: 'test'
      };

      const timing = createTimingInfo('test', 1000, 1500);
      const metadata = {
        command: 'test-command',
        args: { arg1: 'value1' },
        config: mockConfig
      };

      const enhanced = enhanceCommandResult(result, timing, metadata);
      
      expect(enhanced.success).toBe(true);
      expect(enhanced.data).toBe('test');
      expect(enhanced.timing).toBe(timing);
      expect(enhanced.metadata).toBe(metadata);
    });

    it('should create output options from config', () => {
      const config: CLIConfig = {
        ...mockConfig,
        outputFormat: 'json',
        verbose: true,
        quiet: false,
        debug: true
      };

      const options = createOutputOptions(config, true, true);
      
      expect(options.format).toBe('json');
      expect(options.mode.verbose).toBe(true);
      expect(options.mode.quiet).toBe(false);
      expect(options.mode.debug).toBe(true);
      expect(options.includeMetadata).toBe(true);
      expect(options.includeTiming).toBe(true);
    });
  });
});
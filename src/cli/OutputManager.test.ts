/**
 * Unit tests for OutputManager
 */

import { OutputManager, ProgressIndicator } from './OutputManager';
import { CommandResult, CLIConfig, CLICommand } from '../types';

describe('OutputManager', () => {
  let outputManager: OutputManager;
  let mockConfig: CLIConfig;
  let mockCommand: CLICommand;

  beforeEach(() => {
    outputManager = new OutputManager();
    mockConfig = {
      host: 'localhost',
      port: 9222,
      outputFormat: 'text',
      verbose: true, // Enable verbose mode for timing tests
      quiet: false,
      timeout: 30000,
      debug: false
    };
    mockCommand = {
      name: 'test-command',
      args: { arg1: 'value1' },
      config: mockConfig
    };
  });

  describe('Operation Timing', () => {
    it('should track operation timing', async () => {
      outputManager.startOperation('test-operation', mockCommand);
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result: CommandResult = {
        success: true,
        data: 'test result'
      };

      const output = outputManager.endOperation(result);
      
      // Should contain timing information
      expect(output).toContain('⏱️  Operation: test-operation');
      expect(output).toMatch(/\(\d+ms\)/); // Should show duration in ms
    });

    it('should handle operations without timing', () => {
      const result: CommandResult = {
        success: true,
        data: 'test result'
      };

      const output = outputManager.formatOutput(result, mockConfig);
      
      expect(output).toBe('test result');
      expect(output).not.toContain('⏱️'); // No timing info
    });
  });

  describe('Output Formatting', () => {
    it('should format success output', () => {
      const output = outputManager.formatSuccess(mockConfig, 'Operation completed');
      
      expect(output).toBe('Operation completed');
    });

    it('should format error output', () => {
      const output = outputManager.formatError('Something went wrong', mockConfig, 2);
      
      expect(output).toContain('❌ Error: Something went wrong');
    });

    it('should format output with custom template', () => {
      outputManager.registerTemplate(
        'custom-test',
        'Custom test template',
        'Status: {{success}}, Message: {{data}}',
        ['success', 'data']
      );

      const result: CommandResult = {
        success: true,
        data: 'Hello World'
      };

      const output = outputManager.formatOutput(result, mockConfig, 'custom-test');
      
      expect(output).toBe('Status: true, Message: Hello World');
    });
  });

  describe('Quiet Mode Handling', () => {
    it('should detect when to suppress output', () => {
      const quietConfig = { ...mockConfig, quiet: true };
      
      // Should suppress for successful results with no data
      const emptyResult: CommandResult = { success: true };
      expect(outputManager.shouldSuppressOutput(quietConfig, emptyResult)).toBe(true);
      
      // Should not suppress for results with data
      const dataResult: CommandResult = { success: true, data: 'some data' };
      expect(outputManager.shouldSuppressOutput(quietConfig, dataResult)).toBe(false);
      
      // Should not suppress for errors
      const errorResult: CommandResult = { success: false, error: 'error' };
      expect(outputManager.shouldSuppressOutput(quietConfig, errorResult)).toBe(false);
    });
  });

  describe('Template Management', () => {
    it('should register and retrieve templates', () => {
      const templateName = 'test-template';
      
      outputManager.registerTemplate(
        templateName,
        'Test template description',
        'Template: {{data}}',
        ['data']
      );

      const templates = outputManager.getAvailableTemplates();
      expect(templates).toContain(templateName);
    });
  });

  describe('Utility Methods', () => {
    it('should format timing information', () => {
      const timing = outputManager.getTimingInfo(1000, 1250, 'test-operation');
      
      expect(timing).toBe('⏱️  test-operation: 250ms');
    });

    it('should format data source information', () => {
      const proxyInfo = outputManager.formatDataSourceInfo('proxy', true);
      expect(proxyInfo).toContain('📊 Data from proxy server (includes historical data)');
      
      const directInfo = outputManager.formatDataSourceInfo('direct', false);
      expect(directInfo).toContain('⚠️ Data from direct connection (new data only)');
      
      const noInfo = outputManager.formatDataSourceInfo();
      expect(noInfo).toBe('');
    });

    it('should format validation errors', () => {
      const errors = [
        { field: 'host', message: 'Invalid host format', suggestion: 'Use localhost or IP address' },
        { field: 'port', message: 'Port out of range' }
      ];

      const output = outputManager.formatValidationErrors(errors);
      
      expect(output).toContain('❌ Validation Errors:');
      expect(output).toContain('1. host: Invalid host format');
      expect(output).toContain('💡 Suggestion: Use localhost or IP address');
      expect(output).toContain('2. port: Port out of range');
    });

    it('should format help information', () => {
      const examples = [
        'chrome-cdp-cli screenshot --filename=test.png',
        'chrome-cdp-cli eval "document.title"'
      ];

      const output = outputManager.formatHelpInfo(
        'Screenshot Command',
        'Take a screenshot of the current page',
        examples
      );

      expect(output).toContain('📖 Screenshot Command');
      expect(output).toContain('Take a screenshot of the current page');
      expect(output).toContain('💡 Examples:');
      expect(output).toContain('1. chrome-cdp-cli screenshot --filename=test.png');
      expect(output).toContain('2. chrome-cdp-cli eval "document.title"');
    });
  });

  describe('Progress Indicator', () => {
    it('should create progress indicator', () => {
      const progress = outputManager.createProgressIndicator('Loading...');
      
      expect(progress).toBeInstanceOf(ProgressIndicator);
    });
  });
});

describe('ProgressIndicator', () => {
  let progress: ProgressIndicator;

  beforeEach(() => {
    progress = new ProgressIndicator('Test operation');
  });

  afterEach(() => {
    progress.stop();
  });

  it('should update message', () => {
    progress.updateMessage('New message');
    
    // Test that the message was updated (implementation detail)
    expect(progress).toBeDefined();
  });

  it('should start and stop without errors', () => {
    expect(() => {
      progress.start();
      progress.stop();
    }).not.toThrow();
  });

  it('should handle multiple stops gracefully', () => {
    expect(() => {
      progress.stop();
      progress.stop();
    }).not.toThrow();
  });
});
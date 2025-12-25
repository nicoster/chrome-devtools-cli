/**
 * Standardized Output Formatting System
 * 
 * This module provides consistent output formatting across all CLI commands
 * with support for multiple formats, quiet/verbose modes, and custom templates.
 */

import { CommandResult, CLIConfig } from '../types';

/**
 * Output format types
 */
export type OutputFormat = 'json' | 'text' | 'yaml';

/**
 * Output mode configuration
 */
export interface OutputMode {
  quiet: boolean;
  verbose: boolean;
  debug: boolean;
}

/**
 * Timing information for verbose mode
 */
export interface TimingInfo {
  startTime: number;
  endTime: number;
  duration: number;
  operationName: string;
}

/**
 * Enhanced command result with timing and metadata
 */
export interface EnhancedCommandResult extends CommandResult {
  timing?: TimingInfo;
  metadata?: {
    command: string;
    args: Record<string, unknown>;
    config: Partial<CLIConfig>;
  };
}

/**
 * Custom output template definition
 */
export interface OutputTemplate {
  name: string;
  description: string;
  template: string;
  variables: string[];
}

/**
 * Output formatting options
 */
export interface OutputOptions {
  format: OutputFormat;
  mode: OutputMode;
  template?: string;
  includeMetadata?: boolean;
  includeTiming?: boolean;
}

/**
 * Standardized output formatter
 */
export class OutputFormatter {
  private templates: Map<string, OutputTemplate> = new Map();

  constructor() {
    this.registerDefaultTemplates();
  }

  /**
   * Format command result according to specified options
   */
  formatOutput(result: EnhancedCommandResult, options: OutputOptions): string {
    // Handle quiet mode - suppress all non-essential output
    if (options.mode.quiet && result.success) {
      return this.formatQuietOutput(result);
    }

    // Handle error output consistently across all formats
    if (!result.success) {
      return this.formatErrorOutput(result, options);
    }

    // Apply custom template if specified
    if (options.template) {
      return this.applyTemplate(result, options.template, options);
    }

    // Format according to specified format
    switch (options.format) {
      case 'json':
        return this.formatJsonOutput(result, options);
      case 'yaml':
        return this.formatYamlOutput(result, options);
      case 'text':
      default:
        return this.formatTextOutput(result, options);
    }
  }

  /**
   * Format JSON output with consistent structure
   */
  private formatJsonOutput(result: EnhancedCommandResult, options: OutputOptions): string {
    const output: any = {
      success: result.success,
      data: result.data
    };

    // Add metadata in verbose mode
    if (options.mode.verbose && options.includeMetadata && result.metadata) {
      output.metadata = result.metadata;
    }

    // Add timing information in verbose mode
    if (options.mode.verbose && options.includeTiming && result.timing) {
      output.timing = {
        operation: result.timing.operationName,
        duration: `${result.timing.duration}ms`,
        startTime: new Date(result.timing.startTime).toISOString(),
        endTime: new Date(result.timing.endTime).toISOString()
      };
    }

    // Add debug information in debug mode
    if (options.mode.debug) {
      output.debug = {
        exitCode: result.exitCode,
        dataSource: result.dataSource,
        hasHistoricalData: result.hasHistoricalData
      };
    }

    return JSON.stringify(output, null, 2);
  }

  /**
   * Format YAML output (basic implementation)
   */
  private formatYamlOutput(result: EnhancedCommandResult, options: OutputOptions): string {
    // Simple YAML formatting - in a real implementation, use a YAML library
    const lines: string[] = [];
    
    lines.push(`success: ${result.success}`);
    
    if (result.data !== undefined) {
      if (typeof result.data === 'object' && result.data !== null) {
        lines.push('data:');
        lines.push(this.objectToYaml(result.data, 1));
      } else {
        lines.push(`data: ${JSON.stringify(result.data)}`);
      }
    }

    // Add timing in verbose mode
    if (options.mode.verbose && result.timing) {
      lines.push('timing:');
      lines.push(`  operation: ${result.timing.operationName}`);
      lines.push(`  duration: ${result.timing.duration}ms`);
      lines.push(`  startTime: ${new Date(result.timing.startTime).toISOString()}`);
      lines.push(`  endTime: ${new Date(result.timing.endTime).toISOString()}`);
    }

    return lines.join('\n');
  }

  /**
   * Format text output with human-readable formatting
   */
  private formatTextOutput(result: EnhancedCommandResult, options: OutputOptions): string {
    let output = '';

    // Add timing information in verbose mode (at the top)
    if (options.mode.verbose && result.timing) {
      output += `⏱️  Operation: ${result.timing.operationName} (${result.timing.duration}ms)\n`;
      if (options.mode.debug) {
        output += `   Started: ${new Date(result.timing.startTime).toISOString()}\n`;
        output += `   Ended: ${new Date(result.timing.endTime).toISOString()}\n`;
      }
      output += '\n';
    }

    // Handle data source information
    if (result.dataSource && options.mode.verbose) {
      const sourceIcon = result.dataSource === 'proxy' ? '📊' : '⚠️';
      const sourceText = result.dataSource === 'proxy' 
        ? 'Data from proxy server' 
        : 'Data from direct connection';
      const historyText = result.hasHistoricalData 
        ? '(includes historical data)' 
        : '(new data only)';
      
      output += `${sourceIcon} ${sourceText} ${historyText}\n\n`;
    }

    // Format the main data
    if (result.data === undefined || result.data === null) {
      output += 'Success';
    } else {
      output += this.formatDataForText(result.data, options);
    }

    // Add metadata in verbose mode
    if (options.mode.verbose && options.includeMetadata && result.metadata) {
      output += '\n\n📋 Command Details:\n';
      output += `   Command: ${result.metadata.command}\n`;
      if (Object.keys(result.metadata.args).length > 0) {
        output += `   Arguments: ${JSON.stringify(result.metadata.args)}\n`;
      }
    }

    // Add debug information in debug mode
    if (options.mode.debug) {
      output += '\n\n🔧 Debug Information:\n';
      output += `   Exit Code: ${result.exitCode || 0}\n`;
      if (result.dataSource) {
        output += `   Data Source: ${result.dataSource}\n`;
      }
      if (result.hasHistoricalData !== undefined) {
        output += `   Historical Data: ${result.hasHistoricalData}\n`;
      }
    }

    return output.trim();
  }

  /**
   * Format data for text output with intelligent formatting
   */
  private formatDataForText(data: unknown, options: OutputOptions): string {
    if (typeof data === 'string') {
      return data;
    }

    if (typeof data === 'object' && data !== null) {
      const obj = data as any;

      // Handle snapshot output - show the text representation directly
      if (obj.snapshot && typeof obj.snapshot === 'string') {
        return obj.snapshot;
      }

      // Handle console messages output
      if (obj.messages && Array.isArray(obj.messages)) {
        if (obj.messages.length === 0) {
          return 'No console messages found.';
        }

        let output = `Found ${obj.messages.length} console message(s):\n\n`;
        obj.messages.forEach((msg: any, index: number) => {
          const timestamp = new Date(msg.timestamp).toISOString();
          const typeIcon = this.getConsoleTypeIcon(msg.type);
          output += `[${index + 1}] ${timestamp} ${typeIcon} ${msg.text}\n`;
          
          if (options.mode.debug && msg.stackTrace) {
            output += `    Stack: ${JSON.stringify(msg.stackTrace)}\n`;
          }
        });
        return output.trim();
      }

      // Handle network requests output
      if (obj.requests && Array.isArray(obj.requests)) {
        if (obj.requests.length === 0) {
          return 'No network requests found.';
        }

        let output = `Found ${obj.requests.length} network request(s):\n\n`;
        obj.requests.forEach((req: any, index: number) => {
          const timestamp = new Date(req.timestamp).toISOString();
          const status = req.status ? ` [${req.status}]` : ' [pending]';
          const methodIcon = this.getHttpMethodIcon(req.method);
          output += `[${index + 1}] ${timestamp} ${methodIcon} ${req.method} ${req.url}${status}\n`;
          
          if (options.mode.verbose && req.headers) {
            output += `    Headers: ${Object.keys(req.headers).length} items\n`;
          }
          
          if (options.mode.debug && req.responseBody) {
            const bodyPreview = req.responseBody.substring(0, 100);
            output += `    Response: ${bodyPreview}${req.responseBody.length > 100 ? '...' : ''}\n`;
          }
        });
        return output.trim();
      }

      // Handle single console message
      if (obj.type && obj.text !== undefined && obj.timestamp) {
        const timestamp = new Date(obj.timestamp).toISOString();
        const typeIcon = this.getConsoleTypeIcon(obj.type);
        let output = `${timestamp} ${typeIcon} ${obj.text}`;
        return output;
      }

      // Handle single network request
      if (obj.requestId && obj.url && obj.method) {
        const timestamp = new Date(obj.timestamp).toISOString();
        const status = obj.status ? ` [${obj.status}]` : ' [pending]';
        const methodIcon = this.getHttpMethodIcon(obj.method);
        return `${timestamp} ${methodIcon} ${obj.method} ${obj.url}${status}`;
      }

      // Handle generic object - format as JSON in verbose mode, summary otherwise
      if (options.mode.verbose) {
        return JSON.stringify(obj, null, 2);
      } else {
        // Provide a summary for complex objects
        const keys = Object.keys(obj);
        return `Object with ${keys.length} properties: ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}`;
      }
    }

    return String(data);
  }

  /**
   * Format quiet mode output (minimal)
   */
  private formatQuietOutput(result: EnhancedCommandResult): string {
    if (result.data === undefined || result.data === null) {
      return '';
    }

    // For quiet mode, return only essential data
    if (typeof result.data === 'string') {
      return result.data;
    }

    if (typeof result.data === 'object' && result.data !== null) {
      const obj = result.data as any;
      
      // Handle snapshot - return just the snapshot text
      if (obj.snapshot && typeof obj.snapshot === 'string') {
        return obj.snapshot;
      }
      
      // Handle arrays - return count only
      if (Array.isArray(obj)) {
        return `${obj.length}`;
      }
      
      // Handle messages/requests - return count only
      if (obj.messages && Array.isArray(obj.messages)) {
        return `${obj.messages.length}`;
      }
      
      if (obj.requests && Array.isArray(obj.requests)) {
        return `${obj.requests.length}`;
      }
    }

    return '';
  }

  /**
   * Format error output consistently
   */
  private formatErrorOutput(result: EnhancedCommandResult, options: OutputOptions): string {
    if (options.format === 'json') {
      const errorOutput: any = {
        success: false,
        error: result.error,
        exitCode: result.exitCode || 1
      };

      if (options.mode.debug && result.timing) {
        errorOutput.timing = {
          operation: result.timing.operationName,
          duration: `${result.timing.duration}ms`
        };
      }

      return JSON.stringify(errorOutput, null, 2);
    }

    // Text format error
    let output = `❌ Error: ${result.error}`;
    
    if (options.mode.debug) {
      output += `\n   Exit Code: ${result.exitCode || 1}`;
      if (result.timing) {
        output += `\n   Duration: ${result.timing.duration}ms`;
      }
    }

    return output;
  }

  /**
   * Apply custom template to format output
   */
  private applyTemplate(result: EnhancedCommandResult, templateName: string, _options: OutputOptions): string {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Unknown template: ${templateName}`);
    }

    let output = template.template;

    // Replace template variables
    const variables = {
      success: result.success,
      data: result.data,
      error: result.error,
      exitCode: result.exitCode,
      timing: result.timing,
      metadata: result.metadata,
      dataSource: result.dataSource,
      hasHistoricalData: result.hasHistoricalData
    };

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      if (output.includes(placeholder)) {
        const replacement = typeof value === 'object' ? JSON.stringify(value) : String(value || '');
        output = output.replace(new RegExp(placeholder, 'g'), replacement);
      }
    }

    return output;
  }

  /**
   * Register a custom output template
   */
  registerTemplate(template: OutputTemplate): void {
    this.templates.set(template.name, template);
  }

  /**
   * Get available template names
   */
  getAvailableTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Get template definition
   */
  getTemplate(name: string): OutputTemplate | undefined {
    return this.templates.get(name);
  }

  /**
   * Register default templates
   */
  private registerDefaultTemplates(): void {
    // Minimal template
    this.registerTemplate({
      name: 'minimal',
      description: 'Minimal output with just the result',
      template: '{{data}}',
      variables: ['data']
    });

    // Status template
    this.registerTemplate({
      name: 'status',
      description: 'Status-focused output',
      template: 'Status: {{success}}\n{{#if error}}Error: {{error}}{{/if}}',
      variables: ['success', 'error']
    });

    // Detailed template
    this.registerTemplate({
      name: 'detailed',
      description: 'Detailed output with metadata and timing',
      template: 'Result: {{success}}\nData: {{data}}\nTiming: {{timing.duration}}ms\nCommand: {{metadata.command}}',
      variables: ['success', 'data', 'timing', 'metadata']
    });
  }

  /**
   * Check if console message args provide additional information beyond the formatted text
   */
  private argsProvideAdditionalInfo(text: string, args: any[]): boolean {
    // If there are no args, they don't provide additional info
    if (!args || args.length === 0) {
      return false;
    }

    // If the text is empty but there are args, show them
    if (!text || text.trim() === '') {
      return true;
    }

    // Check if args contain only formatting information (CSS styles, etc.)
    // Common patterns where args are redundant:
    // 1. First arg is the same as the text (console.log formatting)
    // 2. Args contain only CSS styling information
    // 3. Args are just the message split into parts
    
    try {
      // If first arg matches the text exactly, it's likely redundant
      if (args.length >= 1 && String(args[0]) === text) {
        // Check if remaining args are just CSS styles
        const remainingArgs = args.slice(1);
        const allAreCSSStyles = remainingArgs.every(arg => 
          typeof arg === 'string' && (
            arg.includes('font-weight') ||
            arg.includes('color:') ||
            arg.includes('background:') ||
            arg.includes('font-size') ||
            arg.startsWith('font-') ||
            arg.startsWith('text-') ||
            arg.startsWith('border') ||
            arg === '' ||
            arg.trim() === ''
          )
        );
        
        if (allAreCSSStyles) {
          return false; // Args are just CSS styling, don't show them
        }
      }

      // If the text contains placeholders (%s, %d, %o, etc.) and args fill them,
      // the args might be redundant if the text is already formatted
      const placeholderCount = (text.match(/%[sdioO%]/g) || []).length;
      if (placeholderCount > 0 && args.length >= placeholderCount) {
        // The text is likely already formatted, args might be redundant
        // But show them in debug mode for troubleshooting
        return false;
      }

      // If we get here, args might provide additional context
      return true;
      
    } catch (error) {
      // If there's any error in analysis, err on the side of showing args
      return true;
    }
  }

  /**
   * Get console message type icon
   */
  private getConsoleTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      log: '📝',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
      debug: '🔍'
    };
    return icons[type] || '📝';
  }

  /**
   * Get HTTP method icon
   */
  private getHttpMethodIcon(method: string): string {
    const icons: Record<string, string> = {
      GET: '📥',
      POST: '📤',
      PUT: '🔄',
      DELETE: '🗑️',
      PATCH: '🔧',
      HEAD: '👁️',
      OPTIONS: '⚙️'
    };
    return icons[method.toUpperCase()] || '🌐';
  }

  /**
   * Simple object to YAML conversion (basic implementation)
   */
  private objectToYaml(obj: any, indent: number = 0): string {
    const spaces = '  '.repeat(indent);
    const lines: string[] = [];

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        lines.push(`${spaces}${key}:`);
        lines.push(this.objectToYaml(value, indent + 1));
      } else if (Array.isArray(value)) {
        lines.push(`${spaces}${key}:`);
        value.forEach((item) => {
          if (typeof item === 'object' && item !== null) {
            lines.push(`${spaces}  - `);
            lines.push(this.objectToYaml(item, indent + 2));
          } else {
            lines.push(`${spaces}  - ${JSON.stringify(item)}`);
          }
        });
      } else {
        lines.push(`${spaces}${key}: ${JSON.stringify(value)}`);
      }
    }

    return lines.join('\n');
  }
}

/**
 * Create output options from CLI configuration
 */
export function createOutputOptions(config: CLIConfig, includeMetadata = false, includeTiming = false): OutputOptions {
  return {
    format: config.outputFormat as OutputFormat,
    mode: {
      quiet: config.quiet,
      verbose: config.verbose,
      debug: config.debug
    },
    includeMetadata,
    includeTiming
  };
}

/**
 * Create timing information for command execution
 */
export function createTimingInfo(operationName: string, startTime: number, endTime: number): TimingInfo {
  return {
    operationName,
    startTime,
    endTime,
    duration: endTime - startTime
  };
}

/**
 * Enhance command result with timing and metadata
 */
export function enhanceCommandResult(
  result: CommandResult,
  timing?: TimingInfo,
  metadata?: {
    command: string;
    args: Record<string, unknown>;
    config: Partial<CLIConfig>;
  }
): EnhancedCommandResult {
  return {
    ...result,
    timing,
    metadata
  };
}
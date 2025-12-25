/**
 * Output Manager
 * 
 * This module provides a high-level interface for managing output formatting
 * across the CLI application with integrated timing and metadata collection.
 */

import { CommandResult, CLIConfig, CLICommand } from '../types';
import { 
  OutputFormatter, 
  TimingInfo, 
  createOutputOptions,
  createTimingInfo,
  enhanceCommandResult
} from './OutputFormatter';

/**
 * Output manager for coordinating formatting across the CLI
 */
export class OutputManager {
  private formatter: OutputFormatter;
  private currentOperation?: {
    name: string;
    startTime: number;
    command: CLICommand;
  };

  constructor() {
    this.formatter = new OutputFormatter();
  }

  /**
   * Start timing an operation
   */
  startOperation(operationName: string, command: CLICommand): void {
    this.currentOperation = {
      name: operationName,
      startTime: Date.now(),
      command
    };
  }

  /**
   * End timing and format output
   */
  endOperation(result: CommandResult): string {
    const endTime = Date.now();
    let timing: TimingInfo | undefined;
    let metadata: any;
    let operationConfig: CLIConfig;

    if (this.currentOperation) {
      timing = createTimingInfo(
        this.currentOperation.name,
        this.currentOperation.startTime,
        endTime
      );

      metadata = {
        command: this.currentOperation.command.name,
        args: this.currentOperation.command.args,
        config: this.currentOperation.command.config
      };

      operationConfig = this.currentOperation.command.config;

      // Clear current operation
      this.currentOperation = undefined;
    } else {
      operationConfig = {
        outputFormat: 'text',
        quiet: false,
        verbose: false,
        debug: false
      } as CLIConfig;
    }

    // Enhance result with timing and metadata
    const enhancedResult = enhanceCommandResult(result, timing, metadata);

    // Create output options from config
    const options = createOutputOptions(
      operationConfig,
      true, // include metadata
      true  // include timing
    );

    return this.formatter.formatOutput(enhancedResult, options);
  }

  /**
   * Format output without timing (for immediate results)
   */
  formatOutput(result: CommandResult, config: CLIConfig, template?: string): string {
    const options = createOutputOptions(config, false, false);
    if (template) {
      options.template = template;
    }

    return this.formatter.formatOutput(result, options);
  }

  /**
   * Format error output
   */
  formatError(error: string, config: CLIConfig, exitCode = 1): string {
    const result: CommandResult = {
      success: false,
      error,
      exitCode
    };

    const options = createOutputOptions(config, false, false);
    return this.formatter.formatOutput(result, options);
  }

  /**
   * Format success output
   */
  formatSuccess(config: CLIConfig, data?: unknown): string {
    const result: CommandResult = {
      success: true,
      data
    };

    const options = createOutputOptions(config, false, false);
    return this.formatter.formatOutput(result, options);
  }

  /**
   * Register a custom template
   */
  registerTemplate(name: string, description: string, template: string, variables: string[]): void {
    this.formatter.registerTemplate({
      name,
      description,
      template,
      variables
    });
  }

  /**
   * Get available templates
   */
  getAvailableTemplates(): string[] {
    return this.formatter.getAvailableTemplates();
  }

  /**
   * Check if quiet mode should suppress output
   */
  shouldSuppressOutput(config: CLIConfig, result: CommandResult): boolean {
    return config.quiet && result.success && (result.data === undefined || result.data === null);
  }

  /**
   * Get verbose timing information as string
   */
  getTimingInfo(startTime: number, endTime: number, operationName: string): string {
    const duration = endTime - startTime;
    return `⏱️  ${operationName}: ${duration}ms`;
  }

  /**
   * Format data source information
   */
  formatDataSourceInfo(dataSource?: string, hasHistoricalData?: boolean): string {
    if (!dataSource) return '';

    const sourceIcon = dataSource === 'proxy' ? '📊' : '⚠️';
    const sourceText = dataSource === 'proxy' 
      ? 'Data from proxy server' 
      : 'Data from direct connection';
    const historyText = hasHistoricalData 
      ? '(includes historical data)' 
      : '(new data only)';
    
    return `${sourceIcon} ${sourceText} ${historyText}`;
  }

  /**
   * Create a progress indicator for long operations
   */
  createProgressIndicator(message: string): ProgressIndicator {
    return new ProgressIndicator(message);
  }

  /**
   * Format validation errors consistently
   */
  formatValidationErrors(errors: Array<{ field: string; message: string; suggestion?: string }>): string {
    if (errors.length === 0) return '';

    let output = '❌ Validation Errors:\n\n';
    errors.forEach((error, index) => {
      output += `${index + 1}. ${error.field}: ${error.message}\n`;
      if (error.suggestion) {
        output += `   💡 Suggestion: ${error.suggestion}\n`;
      }
    });

    return output.trim();
  }

  /**
   * Format help information with consistent styling
   */
  formatHelpInfo(title: string, content: string, examples?: string[]): string {
    let output = `📖 ${title}\n\n${content}\n`;

    if (examples && examples.length > 0) {
      output += '\n💡 Examples:\n';
      examples.forEach((example, index) => {
        output += `${index + 1}. ${example}\n`;
      });
    }

    return output.trim();
  }
}

/**
 * Progress indicator for long-running operations
 */
export class ProgressIndicator {
  private message: string;
  private startTime: number;
  private interval?: NodeJS.Timeout;

  constructor(message: string) {
    this.message = message;
    this.startTime = Date.now();
  }

  /**
   * Start showing progress
   */
  start(): void {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let frameIndex = 0;

    this.interval = setInterval(() => {
      const elapsed = Date.now() - this.startTime;
      const elapsedSeconds = Math.floor(elapsed / 1000);
      process.stdout.write(`\r${frames[frameIndex]} ${this.message} (${elapsedSeconds}s)`);
      frameIndex = (frameIndex + 1) % frames.length;
    }, 100);
  }

  /**
   * Stop and clear progress indicator
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
    process.stdout.write('\r\x1b[K'); // Clear line
  }

  /**
   * Update message
   */
  updateMessage(message: string): void {
    this.message = message;
  }
}

/**
 * Global output manager instance
 */
export const outputManager = new OutputManager();
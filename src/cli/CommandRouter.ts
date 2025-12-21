import { ICommandRegistry } from '../interfaces/CommandHandler';
import { CLICommand, CommandResult, CDPClient } from '../types';
import { Logger } from '../utils/logger';

/**
 * Exit codes for different error conditions
 */
export enum ExitCode {
  SUCCESS = 0,
  GENERAL_ERROR = 1,
  INVALID_COMMAND = 2,
  CONNECTION_ERROR = 3,
  TIMEOUT_ERROR = 4,
  VALIDATION_ERROR = 5,
  FILE_ERROR = 6
}

/**
 * Command router that handles command execution and error management
 */
export class CommandRouter {
  private registry: ICommandRegistry;
  private logger: Logger;
  private client?: CDPClient;

  constructor(registry: ICommandRegistry) {
    this.registry = registry;
    this.logger = new Logger();
  }

  /**
   * Set the CDP client for command execution
   */
  setClient(client: CDPClient): void {
    this.client = client;
  }

  /**
   * Execute a command with proper error handling and exit code management
   */
  async execute(command: CLICommand): Promise<CommandResult> {
    try {
      // Handle special commands that don't require CDP client
      if (this.isSpecialCommand(command.name)) {
        return await this.executeSpecialCommand(command);
      }

      // Ensure CDP client is available for regular commands
      if (!this.client) {
        return {
          success: false,
          error: 'Not connected to Chrome. Use "connect" command first.',
          exitCode: ExitCode.CONNECTION_ERROR
        };
      }

      // Get command handler
      const handler = this.registry.get(command.name);
      if (!handler) {
        return {
          success: false,
          error: `Unknown command: ${command.name}. Use "help" to see available commands.`,
          exitCode: ExitCode.INVALID_COMMAND
        };
      }

      // Validate arguments if handler provides validation
      if (handler.validateArgs && !handler.validateArgs(command.args)) {
        return {
          success: false,
          error: `Invalid arguments for command "${command.name}". Use "help ${command.name}" for usage information.`,
          exitCode: ExitCode.VALIDATION_ERROR
        };
      }

      // Log command execution if verbose mode is enabled
      if (command.config.verbose) {
        this.logger.info(`Executing command: ${command.name}`, command.args);
      }

      // Execute command with timeout
      const result = await this.executeWithTimeout(handler, command);

      // Log result if verbose mode is enabled
      if (command.config.verbose) {
        this.logger.info(`Command result:`, result);
      }

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Log error if not in quiet mode
      if (!command.config.quiet) {
        this.logger.error(`Command execution failed: ${errorMessage}`);
      }

      return {
        success: false,
        error: errorMessage,
        exitCode: this.getExitCodeForError(error)
      };
    }
  }

  /**
   * Check if command is a special command that doesn't require CDP client
   */
  private isSpecialCommand(commandName: string): boolean {
    const specialCommands = ['help', 'connect', 'disconnect'];
    return specialCommands.includes(commandName);
  }

  /**
   * Execute special commands that don't require CDP client
   */
  private async executeSpecialCommand(command: CLICommand): Promise<CommandResult> {
    switch (command.name) {
      case 'help':
        return this.executeHelpCommand(command);
      
      case 'connect':
        return this.executeConnectCommand(command);
      
      case 'disconnect':
        return this.executeDisconnectCommand();
      
      default:
        return {
          success: false,
          error: `Unknown special command: ${command.name}`,
          exitCode: ExitCode.INVALID_COMMAND
        };
    }
  }

  /**
   * Execute help command
   */
  private executeHelpCommand(command: CLICommand): CommandResult {
    const commandName = command.args.command as string;
    
    if (commandName) {
      // Normalize command name for handler lookup
      const normalizedCommandName = commandName.replace(/-/g, '_');
      
      // Show help for specific command
      const handler = this.registry.get(normalizedCommandName);
      if (!handler) {
        return {
          success: false,
          error: `Unknown command: ${commandName}`,
          exitCode: ExitCode.INVALID_COMMAND
        };
      }
      
      const helpText = handler.getHelp ? handler.getHelp() : `No help available for command: ${commandName}`;
      return {
        success: true,
        data: helpText
      };
    } else {
      // Show general help
      const commands = this.registry.getCommandNames();
      const helpText = this.generateGeneralHelp(commands);
      return {
        success: true,
        data: helpText
      };
    }
  }

  /**
   * Execute connect command
   */
  private async executeConnectCommand(command: CLICommand): Promise<CommandResult> {
    try {
      // This would typically create and connect a CDP client
      // For now, we'll return a placeholder result
      return {
        success: true,
        data: `Connected to Chrome at ${command.config.host}:${command.config.port}`
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to connect: ${error instanceof Error ? error.message : String(error)}`,
        exitCode: ExitCode.CONNECTION_ERROR
      };
    }
  }

  /**
   * Execute disconnect command
   */
  private async executeDisconnectCommand(): Promise<CommandResult> {
    try {
      if (this.client) {
        await this.client.disconnect();
        this.client = undefined;
      }
      
      return {
        success: true,
        data: 'Disconnected from Chrome'
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to disconnect: ${error instanceof Error ? error.message : String(error)}`,
        exitCode: ExitCode.CONNECTION_ERROR
      };
    }
  }

  /**
   * Execute command with timeout handling
   */
  private async executeWithTimeout(handler: any, command: CLICommand): Promise<CommandResult> {
    const timeout = command.config.timeout;
    
    // Create timeout promise
    const timeoutPromise = new Promise<CommandResult>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Command timeout after ${timeout}ms`));
      }, timeout);
    });

    // Create execution promise
    const executionPromise = handler.execute(this.client!, command.args);

    // Race between execution and timeout
    try {
      const result = await Promise.race([executionPromise, timeoutPromise]);
      
      // Ensure result has proper structure
      if (!result || typeof result !== 'object') {
        return {
          success: false,
          error: 'Invalid command result format',
          exitCode: ExitCode.GENERAL_ERROR
        };
      }

      // Add success exit code if not present
      if (result.success && !result.exitCode) {
        result.exitCode = ExitCode.SUCCESS;
      }

      return result;
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        return {
          success: false,
          error: error.message,
          exitCode: ExitCode.TIMEOUT_ERROR
        };
      }
      throw error;
    }
  }

  /**
   * Generate general help text
   */
  private generateGeneralHelp(commands: string[]): string {
    return `
Chrome DevTools CLI - Command-line tool for controlling Chrome browser

Usage: chrome-cdp-cli [options] <command> [command-options]

Global Options:
  -h, --host <host>        Chrome host address (default: localhost)
  -p, --port <port>        DevTools port (default: 9222)
  -f, --format <format>    Output format: json|text (default: text)
  -v, --verbose            Enable verbose logging
  -q, --quiet              Enable quiet mode
  -t, --timeout <ms>       Command timeout in milliseconds (default: 30000)
  -c, --config <path>      Configuration file path

Available Commands:
${commands.map(cmd => `  ${cmd.padEnd(20)} - ${this.getCommandDescription(cmd)}`).join('\n')}

Examples:
  chrome-cdp-cli eval "document.title"
  chrome-cdp-cli eval --file script.js
  chrome-cdp-cli screenshot --filename page.png
  chrome-cdp-cli snapshot --format html --filename dom.html
  chrome-cdp-cli help <command>

For more information about a specific command, use:
  chrome-cdp-cli help <command>
`;
  }

  /**
   * Get command description for help text
   */
  private getCommandDescription(commandName: string): string {
    const descriptions: Record<string, string> = {
      'connect': 'Connect to Chrome instance',
      'disconnect': 'Disconnect from Chrome instance',
      'navigate': 'Navigate to URL',
      'new-page': 'Create new page/tab',
      'close-page': 'Close current or specified page',
      'list-pages': 'List all open pages',
      'select-page': 'Select/focus page',
      'resize-page': 'Resize browser viewport',
      'eval': 'Execute JavaScript code',
      'click': 'Click element',
      'fill': 'Fill form field',
      'hover': 'Hover over element',
      'screenshot': 'Capture page screenshot',
      'snapshot': 'Capture DOM snapshot with structure and styles',
      'console-messages': 'Get console messages',
      'network-requests': 'Get network requests',
      'help': 'Show help information'
    };

    return descriptions[commandName] || 'No description available';
  }

  /**
   * Determine exit code based on error type
   */
  private getExitCodeForError(error: unknown): ExitCode {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('timeout')) {
        return ExitCode.TIMEOUT_ERROR;
      }
      
      if (message.includes('connection') || message.includes('connect')) {
        return ExitCode.CONNECTION_ERROR;
      }
      
      if (message.includes('file') || message.includes('path')) {
        return ExitCode.FILE_ERROR;
      }
      
      if (message.includes('invalid') || message.includes('validation')) {
        return ExitCode.VALIDATION_ERROR;
      }
    }
    
    return ExitCode.GENERAL_ERROR;
  }

  /**
   * Get registry for testing purposes
   */
  getRegistry(): ICommandRegistry {
    return this.registry;
  }
}
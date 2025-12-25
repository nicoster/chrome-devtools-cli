import { ArgumentParser } from './ArgumentParser';
import { CommandSchemaRegistry } from './CommandSchemaRegistry';
import { ICLIInterface, DEFAULT_CLI_CONFIG } from '../interfaces/CLIInterface';
import { CLICommand, CLIConfig, CommandResult, CDPClient } from '../types';
import { CommandRegistry } from './CommandRegistry';
import { CommandRouter } from './CommandRouter';
import { ParseResult } from './interfaces/ArgumentParser';

// Import package.json to get version dynamically
const packageJson = require('../../package.json');

/**
 * Enhanced CLI Interface implementation using the new argument parser
 * Provides schema validation, consistent option handling, and boolean negation support
 */
export class EnhancedCLIInterface implements ICLIInterface {
  private argumentParser: ArgumentParser;
  private schemaRegistry: CommandSchemaRegistry;
  private commandRegistry: CommandRegistry;
  private router: CommandRouter;

  constructor() {
    this.argumentParser = new ArgumentParser();
    this.schemaRegistry = CommandSchemaRegistry.getInstance();
    this.commandRegistry = new CommandRegistry();
    this.router = new CommandRouter(this.commandRegistry);
    this.initializeParser();
  }

  /**
   * Initialize the argument parser with command schemas
   */
  private initializeParser(): void {
    // Register all built-in command definitions
    const commands = this.schemaRegistry.getAllCommands();
    for (const command of commands) {
      this.argumentParser.registerCommand(command);
    }
  }

  /**
   * Parse command line arguments into structured command using enhanced parser
   */
  parseArgs(argv: string[]): CLICommand {
    try {
      // Use enhanced argument parser
      const parseResult: ParseResult = this.argumentParser.parseArguments(argv);
      
      if (!parseResult.success) {
        // Handle parse errors by showing help with error information
        const errorMessage = parseResult.errors.join('\n');
        
        // Generate contextual help for the error
        const contextualHelp = this.argumentParser.generateContextualHelp(errorMessage, parseResult.command);
        
        throw new Error(`Parse error: ${errorMessage}\n\n${contextualHelp}`);
      }

      // Handle special commands
      if (parseResult.command === 'version') {
        console.log(packageJson.version);
        if (process.env.NODE_ENV !== 'test') {
          process.exit(0);
        }
        // Return a special command result for tests
        throw new Error('VERSION_COMMAND_EXECUTED');
      }

      // Handle help command with topic support
      if (parseResult.command === 'help') {
        const helpArg = parseResult.arguments[0] as string;
        const helpText = this.argumentParser.generateHelp(helpArg);
        console.log(helpText);
        if (process.env.NODE_ENV !== 'test') {
          process.exit(0);
        }
        // Return a special command result for tests
        throw new Error('HELP_COMMAND_EXECUTED');
      }

      // Build CLI configuration from parsed global options
      const config = this.buildConfiguration(parseResult.options);
      
      // Build command arguments from parsed command-specific options and arguments
      const args = this.buildCommandArguments(parseResult);

      return {
        name: parseResult.command,
        args,
        config
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // If it's "Invalid count value", try to provide more context
      if (errorMessage.includes('Invalid count value')) {
        // This might be from array.slice() with invalid parameters
        console.error('Error details:', error);
        if (error instanceof Error && error.stack) {
          console.error('Stack trace:', error.stack);
        }
      }
      throw new Error(`Failed to parse arguments: ${errorMessage}`);
    }
  }

  /**
   * Build CLI configuration from parsed global options
   */
  private buildConfiguration(globalOptions: Record<string, unknown>): CLIConfig {
    return {
      host: (globalOptions.host as string) || DEFAULT_CLI_CONFIG.host,
      port: (globalOptions.port as number) || DEFAULT_CLI_CONFIG.port,
      outputFormat: (globalOptions.format as 'json' | 'text') || DEFAULT_CLI_CONFIG.outputFormat,
      verbose: (globalOptions.verbose as boolean) || DEFAULT_CLI_CONFIG.verbose,
      quiet: (globalOptions.quiet as boolean) || DEFAULT_CLI_CONFIG.quiet,
      timeout: (globalOptions.timeout as number) || DEFAULT_CLI_CONFIG.timeout,
      debug: (globalOptions.debug as boolean) || DEFAULT_CLI_CONFIG.debug
    };
  }

  /**
   * Build command arguments from parse result
   */
  private buildCommandArguments(parseResult: ParseResult): Record<string, unknown> {
    const args: Record<string, unknown> = {};
    
    // Add command-specific options
    for (const [key, value] of Object.entries(parseResult.options)) {
      // Skip global options that are handled in configuration
      const globalOptions = ['host', 'port', 'format', 'verbose', 'quiet', 'timeout', 'debug', 'config'];
      if (!globalOptions.includes(key)) {
        args[key] = value;
      }
    }

    // Add positional arguments based on command definition
    const commandDef = this.schemaRegistry.getCommand(parseResult.command);
    if (commandDef) {
      for (let i = 0; i < parseResult.arguments.length && i < commandDef.arguments.length; i++) {
        const argDef = commandDef.arguments[i];
        args[argDef.name] = parseResult.arguments[i];
      }
    }

    return args;
  }

  /**
   * Execute a parsed command using the command router
   */
  async execute(command: CLICommand): Promise<CommandResult> {
    try {
      // Validate arguments against command schema
      const commandDef = this.schemaRegistry.getCommand(command.name);
      if (commandDef) {
        const validation = this.argumentParser.validateArguments(command.name, {
          options: command.args,
          arguments: Object.values(command.args)
        });
        
        if (!validation.valid) {
          const errorMessage = `Validation failed: ${validation.errors.join(', ')}`;
          
          // Generate contextual help for validation errors
          const contextualHelp = this.argumentParser.generateContextualHelp(errorMessage, command.name);
          
          return {
            success: false,
            error: `${errorMessage}\n\n${contextualHelp}`,
            exitCode: 5 // VALIDATION_ERROR
          };
        }

        // Show warnings if any
        if (validation.warnings.length > 0 && command.config.verbose) {
          console.warn('Warnings:', validation.warnings.join(', '));
        }
      }

      return await this.router.execute(command);
    } catch (error) {
      const errorMessage = `Command execution failed: ${error instanceof Error ? error.message : String(error)}`;
      
      // Generate contextual help for execution errors
      const contextualHelp = this.argumentParser.generateContextualHelp(errorMessage, command.name);
      
      return {
        success: false,
        error: `${errorMessage}\n\n${contextualHelp}`,
        exitCode: 1
      };
    }
  }

  /**
   * Format command output according to specified format
   */
  formatOutput(result: CommandResult, format: string): string {
    if (format === 'json') {
      return JSON.stringify(result, null, 2);
    }

    // Text format
    if (!result.success) {
      return `Error: ${result.error}`;
    }

    if (result.data === undefined || result.data === null) {
      return 'Success';
    }

    // Handle data source and historical data indicators
    let output = '';
    let dataSourceInfo = '';
    
    // Add data source information
    if (result.dataSource === 'proxy' && result.hasHistoricalData) {
      dataSourceInfo = '📊 Data from proxy server (includes historical data)\n';
    } else if (result.dataSource === 'direct' && result.hasHistoricalData === false) {
      dataSourceInfo = '⚠️  Data from direct connection (new messages only, no historical data)\n';
    }
    
    if (result.data && typeof result.data === 'object') {
      const data = result.data as any;
      
      // Handle snapshot output - show the text representation directly
      if (data.snapshot && typeof data.snapshot === 'string') {
        return data.snapshot;
      }
      
      // Handle console messages output
      if (data.messages && Array.isArray(data.messages)) {
        output += dataSourceInfo;
        if (data.messages.length === 0) {
          output += 'No console messages found.';
        } else {
          output += `Found ${data.messages.length} console message(s):\n\n`;
          data.messages.forEach((msg: any, index: number) => {
            const timestamp = new Date(msg.timestamp).toISOString();
            output += `[${index + 1}] ${timestamp} [${msg.type.toUpperCase()}] ${msg.text}\n`;
          });
        }
        return output.trim();
      }
      
      // Handle network requests output
      if (data.requests && Array.isArray(data.requests)) {
        output += dataSourceInfo;
        if (data.requests.length === 0) {
          output += 'No network requests found.';
        } else {
          output += `Found ${data.requests.length} network request(s):\n\n`;
          data.requests.forEach((req: any, index: number) => {
            const timestamp = new Date(req.timestamp).toISOString();
            const status = req.status ? ` [${req.status}]` : ' [pending]';
            output += `[${index + 1}] ${timestamp} ${req.method} ${req.url}${status}\n`;
          });
        }
        return output.trim();
      }
      
      // Handle single console message
      if (data.type && data.text !== undefined && data.timestamp) {
        output += dataSourceInfo;
        const timestamp = new Date(data.timestamp).toISOString();
        output += `${timestamp} [${data.type.toUpperCase()}] ${data.text}`;
        return output;
      }
      
      // Handle single network request
      if (data.requestId && data.url && data.method) {
        output += dataSourceInfo;
        const timestamp = new Date(data.timestamp).toISOString();
        const status = data.status ? ` [${data.status}]` : ' [pending]';
        output += `${timestamp} ${data.method} ${data.url}${status}`;
        return output;
      }
    }

    if (typeof result.data === 'string') {
      return result.data;
    }

    if (typeof result.data === 'object') {
      return JSON.stringify(result.data, null, 2);
    }

    return String(result.data);
  }

  /**
   * Show help for specific command or general help using enhanced parser
   */
  showHelp(commandName?: string): string {
    return this.argumentParser.generateHelp(commandName);
  }

  /**
   * Get available commands list
   */
  getAvailableCommands(): string[] {
    return this.argumentParser.getCommands().map(cmd => cmd.name);
  }

  /**
   * Register a command handler
   */
  registerHandler(handler: any): void {
    this.commandRegistry.register(handler);
  }

  /**
   * Set the CDP client for command execution
   */
  setClient(client: CDPClient): void {
    this.router.setClient(client);
  }

  /**
   * Get the command registry
   */
  getRegistry(): CommandRegistry {
    return this.commandRegistry;
  }

  /**
   * Get the command router
   */
  getRouter(): CommandRouter {
    return this.router;
  }

  /**
   * Get the argument parser for testing
   */
  getArgumentParser(): ArgumentParser {
    return this.argumentParser;
  }

  /**
   * Get the schema registry for testing
   */
  getSchemaRegistry(): CommandSchemaRegistry {
    return this.schemaRegistry;
  }

  /**
   * Get the help system for advanced usage
   */
  getHelpSystem() {
    return this.argumentParser.getHelpSystem();
  }
}
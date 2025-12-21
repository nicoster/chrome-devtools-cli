import { Command } from 'commander';
import { promises as fs } from 'fs';
import * as path from 'path';
import { ICLIInterface, DEFAULT_CLI_CONFIG } from '../interfaces/CLIInterface';
import { CLICommand, CLIConfig, CommandResult, CDPClient } from '../types';
import { Logger } from '../utils/logger';
import { CommandRegistry } from './CommandRegistry';
import { CommandRouter } from './CommandRouter';

/**
 * Configuration file structure
 */
interface ConfigFile {
  host?: string;
  port?: number;
  outputFormat?: 'json' | 'text';
  verbose?: boolean;
  quiet?: boolean;
  timeout?: number;
}

/**
 * CLI Interface implementation using commander.js
 * Handles command line argument parsing and configuration management
 */
export class CLIInterface implements ICLIInterface {
  private program: Command;
  private logger: Logger;
  private registry: CommandRegistry;
  private router: CommandRouter;

  constructor() {
    this.program = new Command();
    this.logger = new Logger();
    this.registry = new CommandRegistry();
    this.router = new CommandRouter(this.registry);
    this.setupProgram();
  }

  /**
   * Setup commander.js program with global options
   */
  private setupProgram(): void {
    this.program
      .name('chrome-cli')
      .description('Command-line tool for controlling Chrome browser via DevTools Protocol')
      .version('1.0.0')
      .allowUnknownOption(true)
      .allowExcessArguments(true);

    // Global options
    this.program
      .option('-h, --host <host>', 'Chrome host address', DEFAULT_CLI_CONFIG.host)
      .option('-p, --port <port>', 'DevTools port', (value) => parseInt(value, 10), DEFAULT_CLI_CONFIG.port)
      .option('-f, --format <format>', 'Output format (json|text)', DEFAULT_CLI_CONFIG.outputFormat)
      .option('-v, --verbose', 'Enable verbose logging', DEFAULT_CLI_CONFIG.verbose)
      .option('-q, --quiet', 'Enable quiet mode', DEFAULT_CLI_CONFIG.quiet)
      .option('-t, --timeout <timeout>', 'Command timeout in milliseconds', (value) => parseInt(value, 10), DEFAULT_CLI_CONFIG.timeout)
      .option('-c, --config <config>', 'Configuration file path');
  }

  /**
   * Parse command line arguments into structured command
   */
  parseArgs(argv: string[]): CLICommand {
    try {
      // Parse arguments - skip first two (node and script path)
      const args = argv.slice(2);
      
      // Separate options from command and arguments
      const options: any = {};
      const commandArgs: string[] = [];
      let i = 0;
      
      while (i < args.length) {
        const arg = args[i];
        
        if (arg.startsWith('--')) {
          const optionName = arg.substring(2);
          if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
            options[optionName] = args[i + 1];
            i += 2;
          } else {
            options[optionName] = true;
            i++;
          }
        } else if (arg.startsWith('-') && arg.length > 1) {
          const shortOption = arg.substring(1);
          if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
            options[shortOption] = args[i + 1];
            i += 2;
          } else {
            options[shortOption] = true;
            i++;
          }
        } else {
          commandArgs.push(arg);
          i++;
        }
      }

      // Map short options to long options
      if (options.h) options.host = options.h;
      if (options.p) options.port = parseInt(options.p, 10);
      if (options.f) options.format = options.f;
      if (options.v) options.verbose = true;
      if (options.q) options.quiet = true;
      if (options.t) options.timeout = parseInt(options.t, 10);
      if (options.c) options.config = options.c;

      // Parse numeric options
      if (options.port && typeof options.port === 'string') {
        options.port = parseInt(options.port, 10);
      }
      if (options.timeout && typeof options.timeout === 'string') {
        options.timeout = parseInt(options.timeout, 10);
      }

      const command = commandArgs[0] || 'help';
      const remainingArgs = commandArgs.slice(1);

      // Load configuration
      const config = this.loadConfiguration(options.config, options);

      // Extract command-specific arguments
      const parsedArgs = this.extractCommandArgs(command, remainingArgs, options);

      return {
        name: command,
        args: parsedArgs,
        config
      };
    } catch (error) {
      throw new Error(`Failed to parse arguments: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Load configuration from file and merge with command line options
   */
  private loadConfiguration(configPath?: string, cliOptions: any = {}): CLIConfig {
    let fileConfig: ConfigFile = {};

    // Try to load configuration file
    if (configPath) {
      fileConfig = this.loadConfigFile(configPath);
    } else {
      // Try default config locations
      const defaultPaths = [
        '.chrome-cli.json',
        path.join(process.env.HOME || '', '.chrome-cli.json'),
        '/etc/chrome-cli.json'
      ];

      for (const defaultPath of defaultPaths) {
        try {
          fileConfig = this.loadConfigFile(defaultPath);
          break;
        } catch {
          // Continue to next path
        }
      }
    }

    // Merge configurations: defaults < file < CLI options
    return {
      host: cliOptions.host || fileConfig.host || DEFAULT_CLI_CONFIG.host,
      port: cliOptions.port || fileConfig.port || DEFAULT_CLI_CONFIG.port,
      outputFormat: cliOptions.format || fileConfig.outputFormat || DEFAULT_CLI_CONFIG.outputFormat,
      verbose: cliOptions.verbose || fileConfig.verbose || DEFAULT_CLI_CONFIG.verbose,
      quiet: cliOptions.quiet || fileConfig.quiet || DEFAULT_CLI_CONFIG.quiet,
      timeout: cliOptions.timeout || fileConfig.timeout || DEFAULT_CLI_CONFIG.timeout
    };
  }

  /**
   * Load configuration from JSON file
   */
  private loadConfigFile(configPath: string): ConfigFile {
    try {
      const content = require('fs').readFileSync(configPath, 'utf-8');
      const config = JSON.parse(content);
      
      // Validate configuration
      this.validateConfig(config);
      
      return config;
    } catch (error) {
      throw new Error(`Failed to load config file "${configPath}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate configuration object
   */
  private validateConfig(config: any): void {
    if (typeof config !== 'object' || config === null) {
      throw new Error('Configuration must be a JSON object');
    }

    if (config.host !== undefined && typeof config.host !== 'string') {
      throw new Error('Configuration "host" must be a string');
    }

    if (config.port !== undefined && (typeof config.port !== 'number' || config.port < 1 || config.port > 65535)) {
      throw new Error('Configuration "port" must be a number between 1 and 65535');
    }

    if (config.outputFormat !== undefined && !['json', 'text'].includes(config.outputFormat)) {
      throw new Error('Configuration "outputFormat" must be "json" or "text"');
    }

    if (config.verbose !== undefined && typeof config.verbose !== 'boolean') {
      throw new Error('Configuration "verbose" must be a boolean');
    }

    if (config.quiet !== undefined && typeof config.quiet !== 'boolean') {
      throw new Error('Configuration "quiet" must be a boolean');
    }

    if (config.timeout !== undefined && (typeof config.timeout !== 'number' || config.timeout < 1)) {
      throw new Error('Configuration "timeout" must be a positive number');
    }
  }

  /**
   * Extract command-specific arguments from parsed options
   */
  private extractCommandArgs(command: string, args: string[], options: any): Record<string, unknown> {
    const commandArgs: Record<string, unknown> = {};

    switch (command) {
      case 'navigate':
        commandArgs.url = args[0];
        break;

      case 'new-page':
        if (options.url) commandArgs.url = options.url;
        break;

      case 'close-page':
        if (options['page-id']) commandArgs.pageId = options['page-id'];
        break;

      case 'select-page':
        commandArgs.pageId = args[0];
        break;

      case 'resize-page':
        commandArgs.width = parseInt(args[0], 10);
        commandArgs.height = parseInt(args[1], 10);
        break;

      case 'evaluate-script':
        if (options.expression || options.e) commandArgs.expression = options.expression || options.e;
        if (options.file || options.f) commandArgs.file = options.file || options.f;
        commandArgs.awaitPromise = options['await-promise'] !== false;
        commandArgs.returnByValue = options['return-by-value'] !== false;
        break;

      case 'click':
      case 'hover':
        commandArgs.selector = args[0];
        break;

      case 'fill':
        commandArgs.selector = args[0];
        commandArgs.text = args[1];
        break;

      case 'screenshot':
        if (options.output || options.o) commandArgs.output = options.output || options.o;
        if (options.width || options.w) commandArgs.width = parseInt(options.width || options.w, 10);
        if (options.height || options.h) commandArgs.height = parseInt(options.height || options.h, 10);
        break;

      case 'console-messages':
        if (options.filter) commandArgs.filter = options.filter;
        break;

      case 'network-requests':
        if (options.filter) commandArgs.filter = options.filter;
        break;

      case 'help':
        if (args[0]) commandArgs.command = args[0];
        break;

      default:
        // For unknown commands, pass all arguments
        args.forEach((arg, index) => {
          commandArgs[`arg${index}`] = arg;
        });
        break;
    }

    return commandArgs;
  }

  /**
   * Execute a parsed command using the command router
   */
  async execute(command: CLICommand): Promise<CommandResult> {
    try {
      return await this.router.execute(command);
    } catch (error) {
      return {
        success: false,
        error: `Command execution failed: ${error instanceof Error ? error.message : String(error)}`,
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

    if (typeof result.data === 'string') {
      return result.data;
    }

    if (typeof result.data === 'object') {
      return JSON.stringify(result.data, null, 2);
    }

    return String(result.data);
  }

  /**
   * Show help for specific command or general help
   */
  showHelp(commandName?: string): string {
    if (commandName) {
      // Show help for specific command
      const handler = this.registry.get(commandName);
      if (handler && handler.getHelp) {
        return handler.getHelp();
      } else {
        return `Unknown command: ${commandName}`;
      }
    }

    // Show general help
    return this.program.helpInformation();
  }

  /**
   * Get available commands list
   */
  getAvailableCommands(): string[] {
    return this.registry.getCommandNames();
  }

  /**
   * Register a command handler
   */
  registerHandler(handler: any): void {
    this.registry.register(handler);
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
    return this.registry;
  }

  /**
   * Get the command router
   */
  getRouter(): CommandRouter {
    return this.router;
  }
}
import { Command } from 'commander';
import * as path from 'path';
import { ICLIInterface, DEFAULT_CLI_CONFIG } from '../interfaces/CLIInterface';
import { CLICommand, CLIConfig, CommandResult, CDPClient } from '../types';
import { CommandRegistry } from './CommandRegistry';
import { CommandRouter } from './CommandRouter';
import { OutputManager } from './OutputManager';

// Import package.json to get version dynamically
const packageJson = require('../../package.json');

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
  debug?: boolean;
}

/**
 * CLI Interface implementation using commander.js
 * Handles command line argument parsing and configuration management
 */
export class CLIInterface implements ICLIInterface {
  private program: Command;
  private registry: CommandRegistry;
  private router: CommandRouter;
  private outputManager: OutputManager;

  constructor() {
    this.program = new Command();
    this.registry = new CommandRegistry();
    this.router = new CommandRouter(this.registry);
    this.outputManager = new OutputManager();
    this.setupProgram();
  }

  /**
   * Setup commander.js program with global options
   */
  private setupProgram(): void {
    this.program
      .name('chrome-cdp-cli')
      .description('Command-line tool for controlling Chrome browser via DevTools Protocol')
      .version(packageJson.version)
      .allowUnknownOption(true)
      .allowExcessArguments(true);

    // Global options
    this.program
      .option('-h, --host <host>', 'Chrome host address', DEFAULT_CLI_CONFIG.host)
      .option('-p, --port <port>', 'DevTools port', (value) => parseInt(value, 10), DEFAULT_CLI_CONFIG.port)
      .option('-f, --format <format>', 'Output format (json|text|yaml)', DEFAULT_CLI_CONFIG.outputFormat)
      .option('-v, --verbose', 'Enable verbose logging', DEFAULT_CLI_CONFIG.verbose)
      .option('-q, --quiet', 'Enable quiet mode', DEFAULT_CLI_CONFIG.quiet)
      .option('-t, --timeout <timeout>', 'Command timeout in milliseconds', (value) => parseInt(value, 10), DEFAULT_CLI_CONFIG.timeout)
      .option('-d, --debug', 'Enable debug logging', DEFAULT_CLI_CONFIG.debug)
      .option('-c, --config <config>', 'Configuration file path');
  }

  /**
   * Parse command line arguments into structured command
   */
  parseArgs(argv: string[]): CLICommand {
    try {
      // First, let commander.js handle built-in options like --version
      // We'll catch the exit and handle it gracefully
      const args = argv.slice(2);
      
      // Check for version flag specifically
      if (args.includes('--version') || args.includes('-V')) {
        console.log(packageJson.version);
        process.exit(0);
      }

      // Parse arguments - skip first two (node and script path)
      
      // Separate options from command and arguments
      const options: any = {};
      const commandArgs: string[] = [];
      let i = 0;
      
      while (i < args.length) {
        const arg = args[i];
        
        if (arg.startsWith('--')) {
          const optionName = arg.substring(2);
          // Handle boolean flags that don't take values
          const booleanFlags = ['verbose', 'quiet', 'debug'];
          if (booleanFlags.includes(optionName)) {
            options[optionName] = true;
            i++;
          } else if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
            options[optionName] = args[i + 1];
            i += 2;
          } else {
            options[optionName] = true;
            i++;
          }
        } else if (arg.startsWith('-') && arg.length > 1) {
          const shortOption = arg.substring(1);
          // Handle boolean flags that don't take values
          const booleanShortFlags = ['v', 'q', 'd'];
          if (booleanShortFlags.includes(shortOption)) {
            options[shortOption] = true;
            i++;
          } else if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
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
      if (options.d) options.debug = true;
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

      // Normalize command name (convert hyphens to underscores for handler lookup)
      const normalizedCommand = command.replace(/-/g, '_');

      // Load configuration
      const config = this.loadConfiguration(options.config, options);

      // Extract command-specific arguments
      const parsedArgs = this.extractCommandArgs(normalizedCommand, remainingArgs, options);

      return {
        name: normalizedCommand,
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
        '.chrome-cdp-cli.json',
        path.join(process.env.HOME || '', '.chrome-cdp-cli.json'),
        '/etc/chrome-cdp-cli.json'
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
      timeout: cliOptions.timeout || fileConfig.timeout || DEFAULT_CLI_CONFIG.timeout,
      debug: cliOptions.debug || fileConfig.debug || DEFAULT_CLI_CONFIG.debug
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

    if (config.outputFormat !== undefined && !['json', 'text', 'yaml'].includes(config.outputFormat)) {
      throw new Error('Configuration "outputFormat" must be "json", "text", or "yaml"');
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

    if (config.debug !== undefined && typeof config.debug !== 'boolean') {
      throw new Error('Configuration "debug" must be a boolean');
    }
  }

  /**
   * Extract command-specific arguments from parsed options
   */
  private extractCommandArgs(command: string, args: string[], options: any): Record<string, unknown> {
    const commandArgs: Record<string, unknown> = {};

    // Normalize command name (convert hyphens to underscores)
    const normalizedCommand = command.replace(/-/g, '_');

    switch (normalizedCommand) {
      case 'navigate':
        commandArgs.url = args[0];
        break;

      case 'new_page':
        if (options.url) commandArgs.url = options.url;
        break;

      case 'close_page':
        if (options['page-id']) commandArgs.pageId = options['page-id'];
        break;

      case 'select_page':
        commandArgs.pageId = args[0];
        break;

      case 'resize_page':
        commandArgs.width = parseInt(args[0], 10);
        commandArgs.height = parseInt(args[1], 10);
        break;

      case 'eval':
        // Handle direct expression as first argument
        if (args[0] && !options.expression && !options.e && !options.file && !options.f) {
          commandArgs.expression = args[0];
        } else {
          if (options.expression || options.e) commandArgs.expression = options.expression || options.e;
          if (options.file || options.f) commandArgs.file = options.file || options.f;
        }
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
        // Handle filename parameter
        if (options.filename) commandArgs.filename = options.filename;
        if (options.output || options.o) commandArgs.filename = options.output || options.o; // Legacy support
        
        // Handle dimensions
        if (options.width || options.w) commandArgs.width = parseInt(options.width || options.w, 10);
        if (options.height || options.h) commandArgs.height = parseInt(options.height || options.h, 10);
        
        // Handle format and quality
        if (options.format) commandArgs.format = options.format;
        if (options.quality) commandArgs.quality = parseInt(options.quality, 10);
        
        // Handle boolean flags
        if (options['full-page']) commandArgs.fullPage = true;
        
        // Handle clip rectangle
        if (options['clip-x'] || options['clip-y'] || options['clip-width'] || options['clip-height'] || options['clip-scale']) {
          commandArgs.clip = {
            x: options['clip-x'] ? parseInt(options['clip-x'], 10) : 0,
            y: options['clip-y'] ? parseInt(options['clip-y'], 10) : 0,
            width: options['clip-width'] ? parseInt(options['clip-width'], 10) : 0,
            height: options['clip-height'] ? parseInt(options['clip-height'], 10) : 0,
            scale: options['clip-scale'] ? parseFloat(options['clip-scale']) : 1
          };
        }
        break;

      case 'snapshot':
        // Handle filename parameter
        if (options.filename) commandArgs.filename = options.filename;
        if (options.output || options.o) commandArgs.filename = options.output || options.o; // Legacy support
        
        // Handle format
        if (options.format) commandArgs.format = options.format;
        
        // Handle boolean flags
        if (options['include-styles'] !== undefined) commandArgs.includeStyles = options['include-styles'] !== 'false';
        if (options['include-attributes'] !== undefined) commandArgs.includeAttributes = options['include-attributes'] !== 'false';
        if (options['include-paint-order']) commandArgs.includePaintOrder = true;
        if (options['include-text-index']) commandArgs.includeTextIndex = true;
        break;

      case 'console_messages':
        if (options.filter) commandArgs.filter = options.filter;
        break;

      case 'network_requests':
        if (options.filter) commandArgs.filter = options.filter;
        break;

      case 'help':
        if (args[0]) commandArgs.command = args[0];
        break;

      case 'install_cursor_command':
        if (options['target-directory']) commandArgs.targetDirectory = options['target-directory'];
        if (options['include-examples'] !== undefined) commandArgs.includeExamples = options['include-examples'] !== 'false';
        if (options['force']) commandArgs.force = true;
        break;

      case 'install_claude_skill':
        if (options['skill-type']) commandArgs.skillType = options['skill-type'];
        if (options['target-directory']) commandArgs.targetDirectory = options['target-directory'];
        if (options['include-examples'] !== undefined) commandArgs.includeExamples = options['include-examples'] !== 'false';
        if (options['include-references'] !== undefined) commandArgs.includeReferences = options['include-references'] !== 'false';
        if (options['force']) commandArgs.force = true;
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
      // Start timing the operation
      this.outputManager.startOperation(command.name, command);
      
      const result = await this.router.execute(command);
      return result;
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
    // Create a config with the specified format
    const config: CLIConfig = {
      ...DEFAULT_CLI_CONFIG,
      outputFormat: format as 'json' | 'text' | 'yaml'
    };

    // Use the output manager to format with the specified config
    return this.outputManager.formatOutput(result, config);
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

  /**
   * Get the output manager
   */
  getOutputManager(): OutputManager {
    return this.outputManager;
  }

  /**
   * Format output with custom template
   */
  formatOutputWithTemplate(result: CommandResult, config: CLIConfig, template: string): string {
    return this.outputManager.formatOutput(result, config, template);
  }

  /**
   * Format error with consistent styling
   */
  formatError(error: string, config: CLIConfig, exitCode = 1): string {
    return this.outputManager.formatError(error, config, exitCode);
  }

  /**
   * Format success with consistent styling
   */
  formatSuccess(data: unknown, config: CLIConfig): string {
    return this.outputManager.formatSuccess(config, data);
  }
}
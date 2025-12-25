import { EnhancedCLIInterface } from './EnhancedCLIInterface';
import { ConfigurationManager } from '../config/ConfigurationManager';
import { ConnectionManager } from '../connection/ConnectionManager';
import { 
  EvaluateScriptHandler, 
  TakeScreenshotHandler, 
  TakeSnapshotHandler,
  ListConsoleMessagesHandler,
  ListNetworkRequestsHandler,
  InstallCursorCommandHandler,
  InstallClaudeSkillHandler,
  ClickHandler,
  HoverHandler,
  FillHandler,
  FillFormHandler,
  DragHandler,
  PressKeyHandler,
  UploadFileHandler,
  WaitForHandler,
  HandleDialogHandler,
  RestartProxyHandler
} from '../handlers';
import { Logger } from '../utils/logger';
import { CLICommand, CommandResult, CDPClient } from '../types';
import { ExitCode } from './CommandRouter';
import { ProxyManager } from '../proxy/ProxyManager';
import { OutputManager } from './OutputManager';

/**
 * Main CLI application that coordinates all components
 */
export class CLIApplication {
  private cli: EnhancedCLIInterface;
  private configManager: ConfigurationManager;
  private connectionManager: ConnectionManager;
  private outputManager: OutputManager;
  private logger: Logger;
  private client?: CDPClient;
  private proxyManager: ProxyManager;

  constructor() {
    this.cli = new EnhancedCLIInterface();
    this.configManager = new ConfigurationManager();
    this.connectionManager = new ConnectionManager();
    this.outputManager = new OutputManager();
    this.logger = new Logger();
    this.proxyManager = ProxyManager.getInstance();
    this.setupHandlers();
  }

  /**
   * Setup and register all command handlers
   */
  private setupHandlers(): void {
    // Register available command handlers
    this.cli.registerHandler(new EvaluateScriptHandler());
    this.cli.registerHandler(new TakeScreenshotHandler());
    this.cli.registerHandler(new TakeSnapshotHandler());
    this.cli.registerHandler(new ListConsoleMessagesHandler());
    this.cli.registerHandler(new ListNetworkRequestsHandler());
    this.cli.registerHandler(new InstallCursorCommandHandler());
    this.cli.registerHandler(new InstallClaudeSkillHandler());
    this.cli.registerHandler(new ClickHandler());
    this.cli.registerHandler(new HoverHandler());
    this.cli.registerHandler(new FillHandler());
    this.cli.registerHandler(new FillFormHandler());
    this.cli.registerHandler(new DragHandler());
    this.cli.registerHandler(new PressKeyHandler());
    this.cli.registerHandler(new UploadFileHandler());
    this.cli.registerHandler(new WaitForHandler());
    this.cli.registerHandler(new HandleDialogHandler());
    this.cli.registerHandler(new RestartProxyHandler());
    
    // TODO: Register other handlers as they are implemented
    // this.cli.registerHandler(new NavigatePageHandler());
    // etc.
  }

  /**
   * Configure debug mode for all handlers that support it
   */
  private configureDebugMode(debug: boolean): void {
    const registry = this.cli.getRegistry();
    const handlerNames = registry.getCommandNames();
    
    for (const handlerName of handlerNames) {
      const handler = registry.get(handlerName);
      if (handler && typeof (handler as any).setDebug === 'function') {
        (handler as any).setDebug(debug);
      }
    }
  }

  /**
   * Run the CLI application with given arguments
   */
  async run(argv: string[]): Promise<number> {
    try {
      // Parse command line arguments using enhanced parser
      let command: CLICommand;
      
      try {
        command = this.cli.parseArgs(argv);
      } catch (parseError) {
        // Handle special command exceptions in test mode
        if (parseError instanceof Error) {
          if (parseError.message === 'VERSION_COMMAND_EXECUTED') {
            return ExitCode.SUCCESS;
          }
          if (parseError.message === 'HELP_COMMAND_EXECUTED') {
            return ExitCode.SUCCESS;
          }
        }
        
        // Enhanced error handling with contextual help
        const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
        console.error(errorMessage);
        return ExitCode.INVALID_ARGUMENTS;
      }
      
      // Load configuration using the new configuration manager
      try {
        const cliOptions = this.extractCLIOptions(argv);
        const configSources = await this.configManager.createConfigurationSources(cliOptions);
        const loadedConfig = await this.configManager.loadConfiguration(configSources);
        
        // Merge loaded configuration with parsed command config
        command.config = { ...loadedConfig, ...command.config };
      } catch (configError) {
        const errorMessage = `Configuration error: ${configError instanceof Error ? configError.message : String(configError)}`;
        console.error(this.formatError(errorMessage, command.config));
        return ExitCode.CONFIG_ERROR;
      }
      
      // Configure logger based on debug flag
      if (command.config.debug) {
        this.logger.setLevel(3); // DEBUG level
      } else {
        this.logger.setLevel(2); // INFO level
      }
      
      // Configure debug mode for all handlers
      this.configureDebugMode(command.config.debug);
      
      this.logger.debug('CLIApplication.run called with argv:', argv);
      this.logger.debug('Parsed command:', command);

      // Enable proxy manager logging if verbose mode
      if (command.config.verbose) {
        this.proxyManager.setLogging(true);
      }

      // Ensure proxy is ready for all commands (seamless experience)
      this.logger.debug('Ensuring proxy is ready...');
      await this.ensureProxyReady();

      // Handle connection for commands that need it
      if (this.needsConnection(command.name)) {
        this.logger.debug('Command needs connection, ensuring connection...');
        await this.ensureConnection(command);
      }

      // Execute the command
      this.logger.debug('Executing command via CLI interface...');
      const result = await this.cli.execute(command);
      this.logger.debug('Command execution result:', result);

      // Output the result using enhanced formatting
      this.outputResult(result, command);

      // Return appropriate exit code
      return result.exitCode || (result.success ? ExitCode.SUCCESS : ExitCode.GENERAL_ERROR);

    } catch (error) {
      this.logger.debug('Error in CLIApplication.run:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Output error with enhanced formatting
      console.error(this.formatError(errorMessage, { outputFormat: 'text', verbose: false, quiet: false, debug: false, host: 'localhost', port: 9222, timeout: 30000 }));
      
      // Return error exit code
      return ExitCode.GENERAL_ERROR;
    }
  }

  /**
   * Ensure proxy server is ready and healthy
   */
  private async ensureProxyReady(): Promise<void> {
    try {
      const isReady = await this.proxyManager.ensureProxyReady();
      if (!isReady) {
        // Proxy failed to start, but we continue with direct CDP fallback
        // This is logged by ProxyManager if verbose mode is enabled
      }
    } catch (error) {
      // Silently continue - proxy failure should not break CLI functionality
      // Individual handlers will fall back to direct CDP connections
    }
  }

  /**
   * Check if command needs a CDP connection
   */
  private needsConnection(commandName: string): boolean {
    const noConnectionCommands = [
      'help', 
      'connect', 
      'disconnect', 
      'install_cursor_command', 
      'install_claude_skill'
    ];
    return !noConnectionCommands.includes(commandName);
  }

  /**
   * Ensure CDP connection is established
   */
  private async ensureConnection(command: CLICommand): Promise<void> {
    if (this.client) {
      return; // Already connected
    }

    try {
      // Discover available targets
      const targets = await this.connectionManager.discoverTargets(
        command.config.host,
        command.config.port
      );

      if (targets.length === 0) {
        throw new Error(
          `No Chrome targets found at ${command.config.host}:${command.config.port}. ` +
          'Make sure Chrome is running with --remote-debugging-port=9222'
        );
      }

      // Connect to the first available page target
      const pageTarget = targets.find(target => target.type === 'page');
      if (!pageTarget) {
        throw new Error('No page targets available. Open a tab in Chrome.');
      }

      // Create and connect CDP client
      this.client = await this.connectionManager.connectToTarget(pageTarget) as CDPClient;

      // Set client in CLI interface
      this.cli.setClient(this.client);

      if (command.config.verbose) {
        this.logger.info(`Connected to Chrome target: ${pageTarget.title} (${pageTarget.url})`);
      }

    } catch (error) {
      throw new Error(
        `Failed to connect to Chrome: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Output command result to console
   */
  private outputResult(result: CommandResult, command: CLICommand): void {
    if (command.config.quiet && result.success) {
      return; // Don't output anything in quiet mode for successful commands
    }

    const output = this.cli.formatOutput(result, command.config.outputFormat);
    
    if (result.success) {
      console.log(output);
    } else {
      console.error(output);
    }
  }

  /**
   * Extract CLI options from argv for configuration loading
   */
  private extractCLIOptions(argv: string[]): Record<string, unknown> {
    const options: Record<string, unknown> = {};
    const args = argv.slice(2);
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg === '--config' || arg === '-c') {
        if (i + 1 < args.length) {
          options.configFile = args[i + 1];
        }
      } else if (arg === '--profile') {
        if (i + 1 < args.length) {
          options.profile = args[i + 1];
        }
      } else if (arg === '--host' || arg === '-h') {
        if (i + 1 < args.length) {
          options.host = args[i + 1];
        }
      } else if (arg === '--port' || arg === '-p') {
        if (i + 1 < args.length) {
          options.port = parseInt(args[i + 1], 10);
        }
      } else if (arg === '--timeout' || arg === '-t') {
        if (i + 1 < args.length) {
          options.timeout = parseInt(args[i + 1], 10);
        }
      } else if (arg === '--format' || arg === '-f') {
        if (i + 1 < args.length) {
          options.outputFormat = args[i + 1];
        }
      } else if (arg === '--verbose' || arg === '-v') {
        options.verbose = true;
      } else if (arg === '--quiet' || arg === '-q') {
        options.quiet = true;
      } else if (arg === '--debug' || arg === '-d') {
        options.debug = true;
      }
    }
    
    return options;
  }

  /**
   * Format error message with enhanced styling
   */
  private formatError(message: string, config: any): string {
    return this.outputManager.formatError(message, config);
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.client) {
      try {
        await this.client.disconnect();
      } catch (error) {
        this.logger.error('Error during shutdown:', error);
      }
    }

    // Shutdown proxy manager
    try {
      await this.proxyManager.shutdown();
    } catch (error) {
      this.logger.error('Error shutting down proxy manager:', error);
    }
  }

  /**
   * Get CLI interface for testing
   */
  getCLI(): EnhancedCLIInterface {
    return this.cli;
  }

  /**
   * Get configuration manager for testing
   */
  getConfigurationManager(): ConfigurationManager {
    return this.configManager;
  }

  /**
   * Get connection manager for testing
   */
  getConnectionManager(): ConnectionManager {
    return this.connectionManager;
  }

  /**
   * Get output manager for testing
   */
  getOutputManager(): OutputManager {
    return this.outputManager;
  }
}
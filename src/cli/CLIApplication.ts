import { CLIInterface } from './CLIInterface';
import { ConnectionManager } from '../connection/ConnectionManager';
import { 
  EvaluateScriptHandler, 
  TakeScreenshotHandler, 
  TakeSnapshotHandler,
  GetConsoleMessageHandler,
  ListConsoleMessagesHandler,
  GetNetworkRequestHandler,
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
  HandleDialogHandler
} from '../handlers';
import { Logger } from '../utils/logger';
import { CLICommand, CommandResult, CDPClient } from '../types';
import { ExitCode } from './CommandRouter';

/**
 * Main CLI application that coordinates all components
 */
export class CLIApplication {
  private cli: CLIInterface;
  private connectionManager: ConnectionManager;
  private logger: Logger;
  private client?: CDPClient;

  constructor() {
    this.cli = new CLIInterface();
    this.connectionManager = new ConnectionManager();
    this.logger = new Logger();
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
    this.cli.registerHandler(new GetConsoleMessageHandler());
    this.cli.registerHandler(new ListConsoleMessagesHandler());
    this.cli.registerHandler(new GetNetworkRequestHandler());
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
    
    // TODO: Register other handlers as they are implemented
    // this.cli.registerHandler(new NavigatePageHandler());
    // etc.
  }

  /**
   * Run the CLI application with given arguments
   */
  async run(argv: string[]): Promise<number> {
    try {
      // Parse command line arguments
      const command = this.cli.parseArgs(argv);

      // Handle connection for commands that need it
      if (this.needsConnection(command.name)) {
        await this.ensureConnection(command);
      }

      // Execute the command
      const result = await this.cli.execute(command);

      // Output the result
      this.outputResult(result, command);

      // Return appropriate exit code
      return result.exitCode || (result.success ? ExitCode.SUCCESS : ExitCode.GENERAL_ERROR);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Output error
      console.error(`Error: ${errorMessage}`);
      
      // Return error exit code
      return ExitCode.GENERAL_ERROR;
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
  }

  /**
   * Get CLI interface for testing
   */
  getCLI(): CLIInterface {
    return this.cli;
  }

  /**
   * Get connection manager for testing
   */
  getConnectionManager(): ConnectionManager {
    return this.connectionManager;
  }
}
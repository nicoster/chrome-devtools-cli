import { EnhancedCLIInterface } from "./EnhancedCLIInterface";
import { ConfigurationManager } from "../config/ConfigurationManager";
import { ConnectionManager } from "../connection/ConnectionManager";
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
} from "../handlers";
import { Logger } from "../utils/logger";
import { CLICommand, CommandResult, CDPClient, BrowserTarget } from "../types";
import { ExitCode } from "./CommandRouter";
import { OutputManager } from "./OutputManager";

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

  constructor() {
    this.cli = new EnhancedCLIInterface();
    this.configManager = new ConfigurationManager();
    this.connectionManager = new ConnectionManager();
    this.outputManager = new OutputManager();
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
      if (handler && typeof (handler as any).setDebug === "function") {
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
          if (parseError.message === "VERSION_COMMAND_EXECUTED") {
            return ExitCode.SUCCESS;
          }
          if (parseError.message === "HELP_COMMAND_EXECUTED") {
            return ExitCode.SUCCESS;
          }
        }

        // Enhanced error handling with contextual help
        const errorMessage =
          parseError instanceof Error ? parseError.message : String(parseError);
        console.error(errorMessage);
        return ExitCode.INVALID_ARGUMENTS;
      }

      // Load configuration using the new configuration manager
      try {
        const cliOptions = this.extractCLIOptions(argv);
        const configSources =
          await this.configManager.createConfigurationSources(cliOptions);
        const loadedConfig =
          await this.configManager.loadConfiguration(configSources);

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

      this.logger.debug("CLIApplication.run called with argv:", argv);
      this.logger.debug("Parsed command:", command);

      // Handle connection for commands that need it
      // Note: Connection errors are handled by CommandRouter, not here
      // This allows commands to handle connection errors gracefully
      if (this.needsConnection(command.name)) {
        this.logger.debug("Command needs connection, ensuring connection...");
        try {
          await this.ensureConnection(command);
        } catch (connectionError) {
          const msg =
            connectionError instanceof Error
              ? connectionError.message
              : String(connectionError);

          // User cancelled the interactive selector — exit silently, treated as normal termination
          if (msg === "Cancelled") {
            return ExitCode.SUCCESS;
          }

          // Chrome truly unreachable — surface a helpful error and stop
          process.stderr.write(`\nError: ${msg}\n`);
          process.stderr.write(
            "\nTip: Launch Chrome with remote debugging enabled:\n" +
              "  chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug\n\n" +
              "From Chrome 136, --user-data-dir is required. See:\n" +
              "  https://developer.chrome.com/blog/remote-debugging-port\n\n",
          );
          return ExitCode.CONNECTION_ERROR;
        }
      }

      // Execute the command
      this.logger.debug("Executing command via CLI interface...");
      const result = await this.cli.execute(command);
      this.logger.debug("Command execution result:", result);

      // Output the result using enhanced formatting
      this.outputResult(result, command);

      // Return appropriate exit code
      return (
        result.exitCode ||
        (result.success ? ExitCode.SUCCESS : ExitCode.GENERAL_ERROR)
      );
    } catch (error) {
      this.logger.debug("Error in CLIApplication.run:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Output error with enhanced formatting
      console.error(
        this.formatError(errorMessage, {
          outputFormat: "text",
          verbose: false,
          quiet: false,
          debug: false,
          host: "localhost",
          port: 9222,
          timeout: 30000,
        }),
      );

      // Return error exit code
      return ExitCode.GENERAL_ERROR;
    }
  }

  /**
   * Check if command needs a CDP connection
   */
  private needsConnection(commandName: string): boolean {
    const noConnectionCommands = [
      "help",
      "connect",
      "disconnect",
      "install_cursor_command",
      "install_claude_skill",
    ];
    return !noConnectionCommands.includes(commandName);
  }

  /**
   * Check if a target is a DevTools window
   */
  private isDevToolsWindow(target: BrowserTarget): boolean {
    const url = target.url.toLowerCase();
    const title = target.title.toLowerCase();

    return (
      url.startsWith("chrome-devtools://") ||
      url.startsWith("devtools://") ||
      // Chrome internal UI pages (omnibox popup, settings, new tab service, etc.)
      url.startsWith("chrome://") ||
      url.startsWith("chrome-extension://") ||
      url.startsWith("chrome-untrusted://") ||
      title.includes("devtools") ||
      title.includes("chrome devtools")
    );
  }

  /**
   * Interactive arrow-key target selector. Renders a live menu on stderr so
   * that stdout remains clean for piped output.  Falls back to a plain list
   * + error when stdin is not a TTY (e.g. piped / scripted usage).
   */
  private async selectTargetInteractive(
    targets: BrowserTarget[],
  ): Promise<BrowserTarget> {
    // Non-TTY fallback: print list and reject so the caller can surface the error.
    if (!process.stdin.isTTY || !process.stderr.isTTY) {
      process.stderr.write(
        "\nAvailable Chrome pages (excluding DevTools windows):\n",
      );
      targets.forEach((t, i) => {
        const url = t.url.length > 70 ? t.url.substring(0, 67) + "..." : t.url;
        process.stderr.write(
          `  [${i + 1}] ${t.title || "(Untitled)"}\n      ${url}\n`,
        );
      });
      process.stderr.write(`\nTip: re-run with  cdp -i <number> <command>\n\n`);
      throw new Error(
        `Multiple Chrome pages found (${targets.length}). Use  -i <number>  to pick one.`,
      );
    }

    return new Promise((resolve, reject) => {
      let cursor = 0;

      const RESET = "\x1b[0m";
      const BOLD = "\x1b[1m";
      const CYAN = "\x1b[36m";
      const DIM = "\x1b[2m";
      const CLEAR_LINE = "\x1b[2K\x1b[G";
      // 1 header + 1 top-sep + N*2 items + 1 bot-sep + 2 tips = N*2 + 5 lines per render
      const TOTAL_LINES = targets.length * 2 + 5;

      const truncate = (s: string, max: number) =>
        s.length > max ? s.substring(0, max - 1) + "…" : s;

      const render = (first: boolean) => {
        if (!first) {
          process.stderr.write(`\x1b[${TOTAL_LINES}A`);
        }
        process.stderr.write(
          `${CLEAR_LINE}${BOLD}Select a Chrome page${RESET}  (↑↓ navigate, Enter select, q quit)\n`,
        );
        process.stderr.write(`${CLEAR_LINE}${"─".repeat(54)}\n`);
        targets.forEach((t, i) => {
          const num = `[${i + 1}]`;
          const title = truncate(t.title || "(Untitled)", 50);
          const url = truncate(t.url, 58);
          const selected = i === cursor;
          if (selected) {
            process.stderr.write(
              `${CLEAR_LINE}${CYAN}${BOLD} ❯ ${num} ${title}${RESET}\n`,
            );
            process.stderr.write(`${CLEAR_LINE}${CYAN}       ${url}${RESET}\n`);
          } else {
            process.stderr.write(`${CLEAR_LINE}   ${num} ${title}\n`);
            process.stderr.write(`${CLEAR_LINE}${DIM}       ${url}${RESET}\n`);
          }
        });
        process.stderr.write(`${CLEAR_LINE}${"─".repeat(54)}\n`);
        process.stderr.write(
          `${CLEAR_LINE}${DIM}Tip: skip this prompt with  cdp -i <number> <command>${RESET}\n`,
        );
        process.stderr.write(
          `${CLEAR_LINE}${DIM}     or close other tabs until only one remains.${RESET}\n`,
        );
      };

      render(true);

      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf8");

      const onKey = (key: string) => {
        if (key === "\x1b[A") {
          // Up arrow
          cursor = (cursor - 1 + targets.length) % targets.length;
          render(false);
        } else if (key === "\x1b[B") {
          // Down arrow
          cursor = (cursor + 1) % targets.length;
          render(false);
        } else if (key === "\r" || key === "\n") {
          // Enter
          cleanup();
          process.stderr.write("\n");
          resolve(targets[cursor]);
        } else if (key === "q" || key === "\x03" || key === "\x1b") {
          cleanup(); // q / Ctrl-C / ESC
          process.stderr.write("\n");
          reject(new Error("Cancelled"));
        }
      };

      const cleanup = () => {
        process.stdin.removeListener("data", onKey);
        process.stdin.setRawMode(false);
        process.stdin.pause();
      };

      process.stdin.on("data", onKey);
    });
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
        command.config.port,
      );

      if (targets.length === 0) {
        throw new Error(
          `No Chrome targets found at ${command.config.host}:${command.config.port}. ` +
            "Make sure Chrome is running with --remote-debugging-port=9222",
        );
      }

      // Filter page targets and exclude DevTools windows
      const pageTargets = targets.filter((target) => target.type === "page");
      const nonDevToolsTargets = pageTargets.filter(
        (target) => !this.isDevToolsWindow(target),
      );

      if (nonDevToolsTargets.length === 0) {
        throw new Error(
          "No page targets available (excluding DevTools windows). Open a tab in Chrome.",
        );
      }

      // Select target based on user's choice
      let selectedTarget: BrowserTarget;

      if (command.config.targetIndex !== undefined) {
        const index = command.config.targetIndex - 1; // Convert to 0-based
        if (index < 0 || index >= nonDevToolsTargets.length) {
          process.stderr.write("\nAvailable Chrome pages:\n");
          nonDevToolsTargets.forEach((t, i) => {
            process.stderr.write(`  [${i + 1}] ${t.title || "(Untitled)"}\n`);
          });
          throw new Error(
            `Invalid -i value: ${command.config.targetIndex}. ` +
              `Choose a number between 1 and ${nonDevToolsTargets.length}.`,
          );
        }
        selectedTarget = nonDevToolsTargets[index];
      } else if (nonDevToolsTargets.length === 1) {
        selectedTarget = nonDevToolsTargets[0];
      } else {
        // Multiple targets — launch interactive selector
        selectedTarget = await this.selectTargetInteractive(nonDevToolsTargets);
      }

      // Create and connect CDP client
      this.client = (await this.connectionManager.connectToTarget(
        selectedTarget,
      )) as CDPClient;

      // Set client in CLI interface
      this.cli.setClient(this.client);

      if (command.config.verbose) {
        this.logger.info(
          `Connected to Chrome target: ${selectedTarget.title} (${selectedTarget.url})`,
        );
      }
    } catch (error) {
      // Propagate as-is — avoids duplicating any prefix the inner error already carries
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(String(error));
    }
  }

  /**
   * Output command result to console
   */
  private outputResult(result: CommandResult, command: CLICommand): void {
    // Skip formatting for commands that write directly to stdout (e.g. screenshot binary)
    if ((result as any)._rawOutput === true) {
      return;
    }

    if (command.config.quiet && result.success) {
      return; // Don't output anything in quiet mode for successful commands
    }

    // Skip output for long-running commands (they stream directly to stdout)
    if ((result as any).isLongRunning === true) {
      return;
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

      if (arg === "--config" || arg === "-c") {
        if (i + 1 < args.length) {
          options.configFile = args[i + 1];
        }
      } else if (arg === "--profile") {
        if (i + 1 < args.length) {
          options.profile = args[i + 1];
        }
      } else if (arg === "--host" || arg === "-h") {
        if (i + 1 < args.length) {
          options.host = args[i + 1];
        }
      } else if (arg === "--port" || arg === "-p") {
        if (i + 1 < args.length) {
          options.port = parseInt(args[i + 1], 10);
        }
      } else if (arg === "--timeout" || arg === "-t") {
        if (i + 1 < args.length) {
          options.timeout = parseInt(args[i + 1], 10);
        }
      } else if (arg === "--format" || arg === "-f") {
        if (i + 1 < args.length) {
          options.outputFormat = args[i + 1];
        }
      } else if (arg === "--verbose" || arg === "-v") {
        options.verbose = true;
      } else if (arg === "--quiet" || arg === "-q") {
        options.quiet = true;
      } else if (arg === "--debug" || arg === "-d") {
        options.debug = true;
      } else if (arg === "--target-index") {
        if (i + 1 < args.length) {
          options.targetIndex = parseInt(args[i + 1], 10);
        }
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
        this.logger.error("Error during shutdown:", error);
      }
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

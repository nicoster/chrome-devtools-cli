import { ICommandHandler } from "../interfaces/CommandHandler";
import { CDPClient, CommandResult } from "../types";
import {
  ConsoleMonitor,
  ConsoleMessageFilter,
} from "../monitors/ConsoleMonitor";
import { ConsoleMessage } from "../types";

/**
 * Handler for real-time console log monitoring (follow-only mode)
 */
export class ListConsoleMessagesHandler implements ICommandHandler {
  readonly name = "log";
  readonly aliases = ["console"];
  private consoleMonitor: ConsoleMonitor | null = null;

  async execute(client: CDPClient, args: unknown): Promise<CommandResult> {
    try {
      const params = args as {
        types?: Array<"log" | "info" | "warn" | "error" | "debug">;
        textPattern?: string;
        follow?: boolean;
        f?: boolean;
        format?: "text" | "json" | "pretty";
      };

      return await this.executeFollowMode(client, params);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Execute in follow mode (real-time tail) — the only supported mode
   */
  private async executeFollowMode(
    client: CDPClient,
    params: any,
  ): Promise<CommandResult> {
    if (!this.consoleMonitor) {
      this.consoleMonitor = new ConsoleMonitor(client);
    }

    await this.consoleMonitor.startMonitoring();

    const filter: ConsoleMessageFilter = {};
    if (params.types && params.types.length > 0) {
      filter.types = params.types;
    }
    if (params.textPattern) {
      filter.textPattern = params.textPattern;
    }

    const outputFormat = params.format || "text";

    const messageCallback = (message: ConsoleMessage) => {
      if (!this.shouldOutputMessage(message, filter)) {
        return;
      }
      this.outputMessage(message, outputFormat);
    };

    this.consoleMonitor.onMessage(messageCallback);

    let isShuttingDown = false;
    const cleanup = async () => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      this.consoleMonitor?.offMessage(messageCallback);
      await this.consoleMonitor?.stopMonitoring();
    };

    const signalHandler = async () => {
      process.stderr.write("\n");
      await cleanup();
      process.exit(0);
    };

    process.removeAllListeners("SIGINT");
    process.removeAllListeners("SIGTERM");
    process.on("SIGINT", signalHandler);
    process.on("SIGTERM", signalHandler);

    if (outputFormat === "text") {
      console.log("Following console messages (press Ctrl+C to stop)...\n");
    }

    return {
      success: true,
      data: {
        message:
          "Following console messages in real-time. Press Ctrl+C to stop.",
        isLongRunning: true,
      },
      isLongRunning: true,
    } as CommandResult & { isLongRunning?: boolean };
  }

  private shouldOutputMessage(
    message: ConsoleMessage,
    filter: ConsoleMessageFilter,
  ): boolean {
    if (filter.types && filter.types.length > 0) {
      if (!filter.types.includes(message.type)) {
        return false;
      }
    }
    if (filter.textPattern) {
      const pattern = new RegExp(filter.textPattern, "i");
      if (!pattern.test(message.text)) {
        return false;
      }
    }
    return true;
  }

  private outputMessage(
    message: ConsoleMessage,
    format: "text" | "json" | "pretty",
  ): void {
    switch (format) {
      case "json":
        console.log(
          JSON.stringify({
            type: message.type,
            text: message.text,
            timestamp: message.timestamp,
            args: message.args,
            stackTrace: message.stackTrace,
          }),
        );
        break;

      case "pretty": {
        const timestamp = new Date(message.timestamp).toISOString();
        const typeColor = this.getTypeColor(message.type);
        const typeLabel = message.type.toUpperCase().padEnd(5);
        console.log(
          `[${timestamp}] ${typeColor}${typeLabel}\x1b[0m ${message.text}`,
        );
        if (message.stackTrace && message.stackTrace.length > 0) {
          const frame = message.stackTrace[0];
          console.log(
            `  at ${frame.functionName} (${frame.url}:${frame.lineNumber}:${frame.columnNumber})`,
          );
        }
        break;
      }

      case "text":
      default: {
        const time = new Date(message.timestamp).toISOString();
        const type = message.type.toUpperCase().padEnd(5);
        console.log(`[${time}] ${type} ${message.text}`);
        break;
      }
    }
  }

  private getTypeColor(type: string): string {
    switch (type) {
      case "error":
        return "\x1b[31m";
      case "warn":
        return "\x1b[33m";
      case "info":
        return "\x1b[36m";
      case "debug":
        return "\x1b[90m";
      default:
        return "\x1b[0m";
    }
  }

  validateArgs(args: unknown): boolean {
    if (!args || typeof args !== "object") {
      return true;
    }

    const params = args as Record<string, unknown>;

    if (params.types !== undefined) {
      if (!Array.isArray(params.types)) return false;
      const validTypes = ["log", "info", "warn", "error", "debug"];
      for (const type of params.types) {
        if (typeof type !== "string" || !validTypes.includes(type))
          return false;
      }
    }

    if (
      params.textPattern !== undefined &&
      typeof params.textPattern !== "string"
    ) {
      return false;
    }

    if (params.format !== undefined) {
      const validFormats = ["text", "json", "pretty"];
      if (
        typeof params.format !== "string" ||
        !validFormats.includes(params.format)
      ) {
        return false;
      }
    }

    return true;
  }

  getHelp(): string {
    return `log - Follow console messages in real-time

Usage:
  cdp log [options]

Options:
  --types <types>         Filter by message types (comma-separated: log,info,warn,error,debug)
  --textPattern <pattern> Filter by text pattern (regex, case-insensitive)
  --format <format>       Output format: text, json, or pretty (default: text)
  -f, --follow            Alias flag (follow mode is always active)

Examples:
  cdp log                                    # Follow all console messages
  cdp log --types error,warn                 # Follow only errors and warnings
  cdp log --textPattern "API"                # Follow messages matching /API/i
  cdp log --format json                      # Output as JSON (one object per line)
  cdp log --format pretty                    # Colorized output
  cdp log --types error --textPattern "404"  # Combined filters

Note:
  This command runs continuously and streams console messages in real-time.
  Press Ctrl+C to stop. The command connects directly to Chrome via CDP —
  no background process is required. Only messages arriving after the command
  starts will be shown.

Aliases:
  cdp console   (deprecated, use cdp log)`;
  }
}

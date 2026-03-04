import { ICommandHandler } from "../interfaces/CommandHandler";
import { CDPClient, CommandResult } from "../types";
import { ConsoleMonitor } from "../monitors/ConsoleMonitor";
import { ConsoleMessage } from "../types";

interface LogParams {
  /** Positional argument — pattern to match */
  pattern?: string;
  /** -e / --expression: one or more patterns (OR logic) */
  expression?: string | string[];
  /** -F / --fixed-strings: treat patterns as literal strings */
  fixedStrings?: boolean;
  "fixed-strings"?: boolean;
  /** -v / --invert-match: output messages that do NOT match */
  invertMatch?: boolean;
  "invert-match"?: boolean;
  /** --case-sensitive: disable default case-insensitive matching */
  caseSensitive?: boolean;
  "case-sensitive"?: boolean;
  types?: Array<"log" | "info" | "warn" | "error" | "debug">;
  follow?: boolean;
  f?: boolean;
  format?: "text" | "json" | "pretty";
}

/**
 * Handler for real-time console log monitoring (follow-only mode)
 */
export class ListConsoleMessagesHandler implements ICommandHandler {
  readonly name = "log";
  readonly aliases = ["console"];
  private consoleMonitor: ConsoleMonitor | null = null;

  async execute(client: CDPClient, args: unknown): Promise<CommandResult> {
    try {
      const params = args as LogParams;
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
   * Build a text-matching function from the grep-like filter flags.
   * Returns a predicate that takes a message text and returns true if it
   * should be output.
   */
  private buildMatcher(params: LogParams): (text: string) => boolean {
    // Collect all patterns: positional arg + -e list
    const rawExpressions = params.expression
      ? Array.isArray(params.expression)
        ? params.expression
        : [params.expression]
      : [];
    const patterns = [
      ...(params.pattern ? [params.pattern] : []),
      ...rawExpressions,
    ];

    if (patterns.length === 0) return () => true;

    const fixedStrings =
      params.fixedStrings ?? params["fixed-strings"] ?? false;
    const caseSensitive =
      params.caseSensitive ?? params["case-sensitive"] ?? false;
    const invertMatch = params.invertMatch ?? params["invert-match"] ?? false;
    const flags = caseSensitive ? "" : "i";

    const tests: Array<(text: string) => boolean> = patterns.map((p) => {
      if (fixedStrings) {
        return caseSensitive
          ? (text) => text.includes(p)
          : (text) => text.toLowerCase().includes(p.toLowerCase());
      }
      const re = new RegExp(p, flags);
      return (text) => re.test(text);
    });

    // OR across multiple patterns
    const anyMatch = (text: string) => tests.some((t) => t(text));
    return invertMatch ? (text) => !anyMatch(text) : anyMatch;
  }

  /**
   * Execute in follow mode (real-time tail) — the only supported mode
   */
  private async executeFollowMode(
    client: CDPClient,
    params: LogParams,
  ): Promise<CommandResult> {
    if (!this.consoleMonitor) {
      this.consoleMonitor = new ConsoleMonitor(client);
    }

    await this.consoleMonitor.startMonitoring();

    const typeFilter =
      params.types && params.types.length > 0 ? params.types : null;
    const matchText = this.buildMatcher(params);
    const outputFormat = params.format || "text";

    const messageCallback = (message: ConsoleMessage) => {
      if (!this.shouldOutputMessage(message, typeFilter, matchText)) {
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
    typeFilter: Array<string> | null,
    matchText: (text: string) => boolean,
  ): boolean {
    if (typeFilter && !typeFilter.includes(message.type)) {
      return false;
    }
    return matchText(message.text);
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

    if (params.pattern !== undefined && typeof params.pattern !== "string") {
      return false;
    }

    if (params.expression !== undefined) {
      const exprs = Array.isArray(params.expression)
        ? params.expression
        : [params.expression];
      if (!exprs.every((e) => typeof e === "string")) return false;
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
  cdp log [PATTERN] [options]

Arguments:
  PATTERN                 Pattern to match (regex, case-insensitive by default)

Options:
  -e, --expression <pat>  Pattern to match; may be used multiple times (OR logic)
  -F, --fixed-strings     Treat pattern(s) as literal strings, not regexps
  -v, --invert-match      Output messages that do NOT match the pattern
      --case-sensitive    Case-sensitive matching (default: case-insensitive)
      --types <types>     Filter by message types (log,info,warn,error,debug)
      --format <format>   Output format: text, json, or pretty (default: text)
  -f, --follow            Alias flag (follow mode is always active)

Examples:
  cdp log                          # Follow all console messages
  cdp log '\\[AI'                  # Messages matching regex /\\[AI/i
  cdp log -e error -e warn         # Messages containing 'error' OR 'warn'
  cdp log -F '[AI'                 # Messages containing literal '[AI'
  cdp log -v debug                 # Messages NOT containing 'debug'
  cdp log '404' --case-sensitive   # Case-sensitive match
  cdp log --types error,warn       # Filter by type
  cdp log --format json            # Output as JSON (one object per line)
  cdp log --format pretty          # Colorized output

Note:
  This command runs continuously and streams console messages in real-time.
  Press Ctrl+C to stop. The command connects directly to Chrome via CDP —
  no background process is required. Only messages arriving after the command
  starts will be shown.

Aliases:
  cdp console   (deprecated, use cdp log)`;
  }
}

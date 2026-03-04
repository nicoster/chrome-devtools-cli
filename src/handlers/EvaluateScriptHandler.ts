import { ICommandHandler } from "../interfaces/CommandHandler";
import { CDPClient, CommandResult } from "../types";
import { Logger } from "../utils/logger";
import { promises as fs } from "fs";

/**
 * Arguments for eval command
 */
export interface EvaluateScriptArgs {
  expression?: string; // JavaScript expression to evaluate
  file?: string; // Path to JavaScript file
  awaitPromise?: boolean; // Wait for Promise resolution
  timeout?: number; // Execution timeout in milliseconds
  returnByValue?: boolean; // Return result by value instead of object reference
}

/**
 * CDP Runtime.evaluate response
 */
interface RuntimeEvaluateResponse {
  result: {
    type: string;
    value?: unknown;
    description?: string;
    objectId?: string;
  };
  exceptionDetails?: {
    exceptionId: number;
    text: string;
    lineNumber: number;
    columnNumber: number;
    exception?: {
      type: string;
      value?: unknown;
      description?: string;
    };
    stackTrace?: {
      callFrames: Array<{
        functionName: string;
        scriptId: string;
        url: string;
        lineNumber: number;
        columnNumber: number;
      }>;
    };
  };
}

/**
 * Handler for eval command
 * Executes JavaScript code in the browser context via CDP Runtime.evaluate
 */
export class EvaluateScriptHandler implements ICommandHandler {
  readonly name = "eval";
  private logger: Logger;

  constructor(debug: boolean = false) {
    this.logger = new Logger();
    if (debug) {
      this.logger.setLevel(3);
    } else {
      this.logger.setLevel(2);
    }
  }

  setDebug(debug: boolean): void {
    this.logger.setLevel(debug ? 3 : 2);
  }

  async execute(client: CDPClient, args: unknown): Promise<CommandResult> {
    this.logger.debug("EvaluateScriptHandler.execute called with args:", args);

    const scriptArgs = args as EvaluateScriptArgs;

    if (!scriptArgs.expression && !scriptArgs.file) {
      return {
        success: false,
        error: 'Either "expression" or "file" argument is required',
      };
    }

    if (scriptArgs.expression && scriptArgs.file) {
      return {
        success: false,
        error: 'Cannot specify both "expression" and "file" arguments',
      };
    }

    try {
      let expression: string;
      if (scriptArgs.file) {
        expression = await this.readScriptFile(scriptArgs.file);
      } else {
        expression = scriptArgs.expression!;
      }

      return await this.executeWithTimeout(client, expression, scriptArgs);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async readScriptFile(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, "utf-8");
    } catch (error) {
      throw new Error(
        `Failed to read script file "${filePath}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async executeWithTimeout(
    client: CDPClient,
    expression: string,
    args: EvaluateScriptArgs,
  ): Promise<CommandResult> {
    const timeout = args.timeout || 30000;
    const awaitPromise = args.awaitPromise ?? true;
    const returnByValue = args.returnByValue ?? true;

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`Script execution timeout after ${timeout}ms`)),
        timeout,
      );
    });

    const executionPromise = this.executeScript(
      client,
      expression,
      awaitPromise,
      returnByValue,
    );

    try {
      return await Promise.race([executionPromise, timeoutPromise]);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async executeScript(
    client: CDPClient,
    expression: string,
    awaitPromise: boolean,
    returnByValue: boolean,
  ): Promise<CommandResult> {
    const consoleHandler = (params: unknown) =>
      this.handleConsoleOutput(params);
    client.on("Runtime.consoleAPICalled", consoleHandler);

    try {
      const response = (await client.send("Runtime.evaluate", {
        expression,
        awaitPromise,
        returnByValue,
        userGesture: true,
        generatePreview: false,
      })) as RuntimeEvaluateResponse;

      if (!response) {
        return { success: false, error: "CDP returned empty response" };
      }

      if (response.exceptionDetails) {
        return this.formatException(response.exceptionDetails);
      }

      if (!response.result) {
        return { success: false, error: "CDP response missing result field" };
      }

      return { success: true, data: this.formatResult(response.result) };
    } catch (error) {
      return {
        success: false,
        error: `CDP command failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    } finally {
      client.off("Runtime.consoleAPICalled", consoleHandler);
    }
  }

  private handleConsoleOutput(params: unknown): void {
    try {
      const p = params as {
        type: string;
        args: Array<{ type: string; value?: unknown; description?: string }>;
      };
      const text = (p.args || [])
        .map((a) =>
          a.value !== undefined
            ? typeof a.value === "string"
              ? a.value
              : JSON.stringify(a.value)
            : a.description || "",
        )
        .join(" ");

      const type = this.mapConsoleType(p.type);
      if (type === "warn" || type === "error") {
        process.stderr.write(text + "\n");
      } else {
        process.stdout.write(text + "\n");
      }
    } catch {
      // silently ignore formatting errors
    }
  }

  private mapConsoleType(
    cdpType: string,
  ): "log" | "info" | "warn" | "error" | "debug" {
    switch (cdpType) {
      case "warning":
        return "warn";
      case "error":
        return "error";
      case "info":
        return "info";
      case "debug":
        return "debug";
      default:
        return "log";
    }
  }

  private formatException(
    exceptionDetails: RuntimeEvaluateResponse["exceptionDetails"],
  ): CommandResult {
    if (!exceptionDetails) {
      return { success: false, error: "Unknown JavaScript error" };
    }
    const errorMessage =
      exceptionDetails.exception?.description || exceptionDetails.text;
    let stackTrace = "";
    if (exceptionDetails.stackTrace?.callFrames) {
      stackTrace =
        "\nStack trace:\n" +
        exceptionDetails.stackTrace.callFrames
          .map(
            (f) =>
              `  at ${f.functionName || "<anonymous>"} (${f.url}:${f.lineNumber}:${f.columnNumber})`,
          )
          .join("\n");
    }
    return {
      success: false,
      error: `JavaScript error at line ${exceptionDetails.lineNumber}, column ${exceptionDetails.columnNumber}: ${errorMessage}${stackTrace}`,
    };
  }

  private formatResult(result: RuntimeEvaluateResponse["result"]): unknown {
    if (!result || result.type === "undefined") return "";
    if (result.value !== undefined) return result.value;
    if (result.objectId)
      return {
        type: result.type,
        description: result.description,
        objectId: result.objectId,
      };
    return result.description || result.type;
  }

  validateArgs(args: unknown): boolean {
    if (typeof args !== "object" || args === null) return false;
    const a = args as EvaluateScriptArgs;
    if (!a.expression && !a.file) return false;
    if (a.expression && a.file) return false;
    if (a.expression && typeof a.expression !== "string") return false;
    if (a.file && typeof a.file !== "string") return false;
    if (a.awaitPromise !== undefined && typeof a.awaitPromise !== "boolean")
      return false;
    if (a.timeout !== undefined && typeof a.timeout !== "number") return false;
    return true;
  }

  getHelp(): string {
    return `
eval - Execute JavaScript code in the browser context

Usage:
  cdp eval "document.title"
  cdp eval --file script.js
  cdp eval "await fetch('/api').then(r => r.json())"
  cdp eval "heavyComputation()" --timeout 60000

Arguments:
  <expression>            JavaScript code to execute
  --expression <code>     JavaScript code to execute (explicit flag)
  --file <path>           Path to JavaScript file to execute
  --await-promise         Wait for Promise resolution (default: true)
  --timeout <ms>          Execution timeout in milliseconds (default: 30000)
  --return-by-value       Return result by value (default: true)

Examples:
  cdp eval "2 + 2"
  cdp eval "Array.from(document.links).map(l => l.href)"
  cdp eval --file ./scripts/init.js
  cdp eval "await new Promise(r => setTimeout(r, 5000))" --timeout 10000
`;
  }
}

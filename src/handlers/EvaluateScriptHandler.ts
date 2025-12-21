import { ICommandHandler } from '../interfaces/CommandHandler';
import { CDPClient, CommandResult } from '../types';
import { promises as fs } from 'fs';

/**
 * Arguments for evaluate_script command
 */
export interface EvaluateScriptArgs {
  expression?: string;      // JavaScript expression to evaluate
  file?: string;            // Path to JavaScript file
  awaitPromise?: boolean;   // Wait for Promise resolution
  timeout?: number;         // Execution timeout in milliseconds
  returnByValue?: boolean;  // Return result by value instead of object reference
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
 * Handler for evaluate_script command
 * Executes JavaScript code in the browser context via CDP Runtime.evaluate
 */
export class EvaluateScriptHandler implements ICommandHandler {
  readonly name = 'evaluate_script';

  /**
   * Execute JavaScript code in the browser
   */
  async execute(client: CDPClient, args: unknown): Promise<CommandResult> {
    const scriptArgs = args as EvaluateScriptArgs;

    // Validate arguments
    if (!scriptArgs.expression && !scriptArgs.file) {
      return {
        success: false,
        error: 'Either "expression" or "file" argument is required'
      };
    }

    if (scriptArgs.expression && scriptArgs.file) {
      return {
        success: false,
        error: 'Cannot specify both "expression" and "file" arguments'
      };
    }

    try {
      // Get the JavaScript code to execute
      let expression: string;
      if (scriptArgs.file) {
        expression = await this.readScriptFile(scriptArgs.file);
      } else {
        expression = scriptArgs.expression!;
      }

      // Execute the JavaScript with timeout handling
      const result = await this.executeWithTimeout(
        client,
        expression,
        scriptArgs
      );

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Read JavaScript code from file
   */
  private async readScriptFile(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      throw new Error(
        `Failed to read script file "${filePath}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Execute JavaScript with timeout handling
   */
  private async executeWithTimeout(
    client: CDPClient,
    expression: string,
    args: EvaluateScriptArgs
  ): Promise<CommandResult> {
    const timeout = args.timeout || 30000; // Default 30 seconds
    const awaitPromise = args.awaitPromise ?? true;
    const returnByValue = args.returnByValue ?? true;

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Script execution timeout after ${timeout}ms`));
      }, timeout);
    });

    // Create execution promise
    const executionPromise = this.executeScript(
      client,
      expression,
      awaitPromise,
      returnByValue
    );

    // Race between execution and timeout
    try {
      const result = await Promise.race([executionPromise, timeoutPromise]);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Execute JavaScript via CDP Runtime.evaluate
   */
  private async executeScript(
    client: CDPClient,
    expression: string,
    awaitPromise: boolean,
    returnByValue: boolean
  ): Promise<CommandResult> {
    try {
      const response = (await client.send('Runtime.evaluate', {
        expression,
        awaitPromise,
        returnByValue,
        userGesture: true,
        generatePreview: false
      })) as RuntimeEvaluateResponse;

      // Check if response is valid
      if (!response) {
        return {
          success: false,
          error: 'CDP returned empty response'
        };
      }

      // Check for JavaScript execution errors
      if (response.exceptionDetails) {
        return this.formatException(response.exceptionDetails);
      }

      // Check if result exists
      if (!response.result) {
        return {
          success: false,
          error: 'CDP response missing result field'
        };
      }

      // Return successful result
      return {
        success: true,
        data: this.formatResult(response.result)
      };
    } catch (error) {
      return {
        success: false,
        error: `CDP command failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      };
    }
  }

  /**
   * Format exception details into error message
   */
  private formatException(exceptionDetails: RuntimeEvaluateResponse['exceptionDetails']): CommandResult {
    if (!exceptionDetails) {
      return {
        success: false,
        error: 'Unknown JavaScript error'
      };
    }

    const exception = exceptionDetails.exception;
    const errorMessage = exception?.description || exceptionDetails.text;
    
    // Build stack trace if available
    let stackTrace = '';
    if (exceptionDetails.stackTrace?.callFrames) {
      stackTrace = '\nStack trace:\n' + 
        exceptionDetails.stackTrace.callFrames
          .map(frame => 
            `  at ${frame.functionName || '<anonymous>'} (${frame.url}:${frame.lineNumber}:${frame.columnNumber})`
          )
          .join('\n');
    }

    return {
      success: false,
      error: `JavaScript error at line ${exceptionDetails.lineNumber}, column ${exceptionDetails.columnNumber}: ${errorMessage}${stackTrace}`
    };
  }

  /**
   * Format result value for output
   */
  private formatResult(result: RuntimeEvaluateResponse['result']): unknown {
    // Check if result exists
    if (!result) {
      return 'undefined';
    }

    // If returnByValue is true, the value is already serialized
    if (result.value !== undefined) {
      return result.value;
    }

    // For object references, return description
    if (result.objectId) {
      return {
        type: result.type,
        description: result.description,
        objectId: result.objectId
      };
    }

    // For undefined, null, etc.
    return result.description || result.type;
  }

  /**
   * Validate command arguments
   */
  validateArgs(args: unknown): boolean {
    if (typeof args !== 'object' || args === null) {
      return false;
    }

    const scriptArgs = args as EvaluateScriptArgs;

    // Must have either expression or file
    if (!scriptArgs.expression && !scriptArgs.file) {
      return false;
    }

    // Cannot have both
    if (scriptArgs.expression && scriptArgs.file) {
      return false;
    }

    // Validate types
    if (scriptArgs.expression && typeof scriptArgs.expression !== 'string') {
      return false;
    }

    if (scriptArgs.file && typeof scriptArgs.file !== 'string') {
      return false;
    }

    if (scriptArgs.awaitPromise !== undefined && typeof scriptArgs.awaitPromise !== 'boolean') {
      return false;
    }

    if (scriptArgs.timeout !== undefined && typeof scriptArgs.timeout !== 'number') {
      return false;
    }

    return true;
  }

  /**
   * Get command help text
   */
  getHelp(): string {
    return `
evaluate_script - Execute JavaScript code in the browser context

Usage:
  evaluate_script --expression "console.log('Hello')"
  evaluate_script --file script.js
  evaluate_script --expression "fetch('/api')" --await-promise
  evaluate_script --expression "longRunning()" --timeout 60000

Arguments:
  --expression <code>     JavaScript code to execute
  --file <path>           Path to JavaScript file to execute
  --await-promise         Wait for Promise resolution (default: true)
  --timeout <ms>          Execution timeout in milliseconds (default: 30000)
  --return-by-value       Return result by value (default: true)

Examples:
  # Execute simple expression
  evaluate_script --expression "2 + 2"

  # Execute async code
  evaluate_script --expression "await fetch('/api').then(r => r.json())"

  # Execute from file
  evaluate_script --file ./scripts/init.js

  # Set custom timeout
  evaluate_script --expression "heavyComputation()" --timeout 120000
`;
  }
}

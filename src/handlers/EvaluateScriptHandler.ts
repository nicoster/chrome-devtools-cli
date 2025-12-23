import { ICommandHandler } from '../interfaces/CommandHandler';
import { CDPClient, CommandResult } from '../types';
import { ProxyClient } from '../client/ProxyClient';
import { promises as fs } from 'fs';
import fetch from 'node-fetch';

/**
 * Arguments for eval command
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
 * Handler for eval command
 * Executes JavaScript code in the browser context via CDP Runtime.evaluate
 */
export class EvaluateScriptHandler implements ICommandHandler {
  readonly name = 'eval';
  private proxyClient: ProxyClient;
  private useProxy: boolean;

  constructor(useProxy: boolean = false) {
    this.proxyClient = new ProxyClient();
    this.useProxy = useProxy;
  }

  /**
   * Execute JavaScript code in the browser
   */
  async execute(client: CDPClient, args: unknown): Promise<CommandResult> {
    console.log('[DEBUG] EvaluateScriptHandler.execute called with args:', args);
    
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

    console.log('[DEBUG] Arguments validated, useProxy:', this.useProxy);

    try {
      // Try proxy first if enabled
      if (this.useProxy) {
        console.log('[DEBUG] Checking proxy availability...');
        const proxyAvailable = await this.proxyClient.isProxyAvailable();
        console.log('[DEBUG] Proxy available:', proxyAvailable);
        
        if (proxyAvailable) {
          console.log('[INFO] Using proxy connection for script evaluation');
          console.log('[DEBUG] About to call executeWithProxy...');
          const result = await this.executeWithProxy(scriptArgs);
          console.log('[DEBUG] executeWithProxy returned:', result);
          return result;
        } else {
          console.warn('[WARN] Proxy not available, falling back to direct CDP connection');
        }
      }
    } catch (error) {
      console.warn('[WARN] Proxy execution failed, falling back to direct CDP:', error instanceof Error ? error.message : error);
    }

    // Fallback to direct CDP
    console.log('[DEBUG] Falling back to direct CDP');
    return await this.executeWithDirectCDP(client, scriptArgs);
  }

  /**
   * Execute script through proxy using HTTP API
   */
  private async executeWithProxy(scriptArgs: EvaluateScriptArgs): Promise<CommandResult> {
    try {
      console.log('[DEBUG] Starting executeWithProxy');
      
      // Get the JavaScript code to execute
      let expression: string;
      if (scriptArgs.file) {
        expression = await this.readScriptFile(scriptArgs.file);
      } else {
        expression = scriptArgs.expression!;
      }

      console.log('[DEBUG] Expression to execute:', expression.substring(0, 100));

      // Connect to Chrome through the proxy
      console.log('[DEBUG] Creating new proxy connection...');
      const connectionId = await this.proxyClient.connect('localhost', 9222);
      console.log(`[DEBUG] Created new proxy connection: ${connectionId}`);

      try {
        // Execute script through HTTP API instead of WebSocket
        const result = await this.executeScriptThroughHTTP(connectionId, expression, scriptArgs);
        
        return {
          success: true,
          data: result
        };
      } finally {
        // Disconnect from proxy (this will also release the CLI client)
        await this.proxyClient.disconnect();
      }
    } catch (error) {
      console.log('[DEBUG] Error in executeWithProxy:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Execute script through proxy HTTP API
   */
  private async executeScriptThroughHTTP(connectionId: string, expression: string, args: EvaluateScriptArgs): Promise<any> {
    const timeout = args.timeout || 30000;
    const awaitPromise = args.awaitPromise ?? true;
    const returnByValue = args.returnByValue ?? true;

    console.log(`[DEBUG] Starting HTTP script execution, timeout: ${timeout}ms`);
    console.log(`[DEBUG] Expression: ${expression.substring(0, 100)}${expression.length > 100 ? '...' : ''}`);

    try {
      // Use the proxy client's HTTP API to execute the command
      const proxyUrl = this.proxyClient.getConfig().proxyUrl;
      const commandId = Date.now() + Math.floor(Math.random() * 10000);

      const command = {
        id: commandId,
        method: 'Runtime.evaluate',
        params: {
          expression: expression,
          awaitPromise: awaitPromise,
          returnByValue: returnByValue,
          userGesture: true,
          generatePreview: false
        }
      };

      console.log(`[DEBUG] Sending HTTP command to ${proxyUrl}/api/execute/${connectionId}`);

      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(`${proxyUrl}/api/execute/${connectionId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-client-id': `eval_handler_${Date.now()}`
          },
          body: JSON.stringify({
            command,
            timeout
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutHandle);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
        }

        const result = await response.json();
        console.log(`[DEBUG] HTTP command response:`, result);

        if (!result.success) {
          throw new Error(`Command execution failed: ${result.error || 'Unknown error'}`);
        }

        const commandResult = result.data.result;
        if (result.data.error) {
          throw new Error(`CDP Error: ${result.data.error.message}`);
        }

        // Handle the result similar to WebSocket approach
        if (commandResult.exceptionDetails) {
          console.log(`[DEBUG] Exception details:`, commandResult.exceptionDetails);
          const error = new Error(commandResult.result?.description || 'Script execution failed');
          (error as any).exceptionDetails = commandResult.exceptionDetails;
          throw error;
        }

        // Handle the result
        let value = commandResult.result?.value;
        if (commandResult.result?.type === 'undefined') {
          value = undefined;
        } else if (commandResult.result?.unserializableValue) {
          value = commandResult.result.unserializableValue;
        }

        console.log(`[DEBUG] Successful HTTP result:`, value);
        return value;

      } catch (error) {
        clearTimeout(timeoutHandle);
        throw error;
      }

    } catch (error) {
      console.log(`[DEBUG] Error in HTTP script execution:`, error);
      throw error;
    }
  }

  /**
   * Execute script with direct CDP (fallback)
   */
  private async executeWithDirectCDP(client: CDPClient, scriptArgs: EvaluateScriptArgs): Promise<CommandResult> {
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
eval - Execute JavaScript code in the browser context

Usage:
  eval "console.log('Hello')"
  eval --file script.js
  eval "fetch('/api')" --await-promise
  eval "longRunning()" --timeout 60000

Arguments:
  <expression>            JavaScript code to execute (direct argument)
  --expression <code>     JavaScript code to execute (explicit flag)
  --file <path>           Path to JavaScript file to execute
  --await-promise         Wait for Promise resolution (default: true)
  --timeout <ms>          Execution timeout in milliseconds (default: 30000)
  --return-by-value       Return result by value (default: true)

Examples:
  # Execute simple expression (recommended)
  eval "2 + 2"

  # Execute with explicit flag
  eval --expression "2 + 2"

  # Execute async code
  eval "await fetch('/api').then(r => r.json())"

  # Execute from file
  eval --file ./scripts/init.js

  # Set custom timeout
  eval "heavyComputation()" --timeout 120000
`;
  }
}

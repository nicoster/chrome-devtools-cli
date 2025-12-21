import { ICommandHandler } from '../interfaces/CommandHandler';
import { CDPClient, CommandResult } from '../types';

/**
 * Arguments for fill command
 */
export interface FillArgs {
  selector: string;         // CSS selector for the form field to fill
  text: string;            // Text to input into the field
  waitForElement?: boolean; // Wait for element to be available (default: true)
  timeout?: number;         // Timeout for waiting for element (default: 5000ms)
  clearFirst?: boolean;     // Clear field before filling (default: true)
}

/**
 * CDP DOM.querySelector response
 */
interface DOMQuerySelectorResponse {
  nodeId: number;
}

/**
 * CDP Runtime.callFunctionOn response
 */
interface RuntimeCallFunctionResponse {
  result: {
    type: string;
    value?: unknown;
    description?: string;
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
  };
}

/**
 * Handler for fill command
 * Fills form fields using CSS selectors via CDP DOM.querySelector and Runtime.callFunctionOn
 */
export class FillHandler implements ICommandHandler {
  readonly name = 'fill';

  /**
   * Execute fill command on specified form field
   */
  async execute(client: CDPClient, args: unknown): Promise<CommandResult> {
    const fillArgs = args as FillArgs;

    // Validate arguments
    if (!fillArgs.selector) {
      return {
        success: false,
        error: 'CSS selector is required for fill command'
      };
    }

    if (typeof fillArgs.selector !== 'string') {
      return {
        success: false,
        error: 'CSS selector must be a string'
      };
    }

    if (fillArgs.text === undefined || fillArgs.text === null) {
      return {
        success: false,
        error: 'Text value is required for fill command'
      };
    }

    if (typeof fillArgs.text !== 'string') {
      return {
        success: false,
        error: 'Text value must be a string'
      };
    }

    try {
      // Enable DOM domain first
      await client.send('DOM.enable');
      await client.send('Runtime.enable');

      const timeout = fillArgs.timeout || 5000;
      const waitForElement = fillArgs.waitForElement !== false;

      if (waitForElement) {
        // Wait for element to be available
        const elementFound = await this.waitForElement(client, fillArgs.selector, timeout);
        if (!elementFound) {
          return {
            success: false,
            error: `Element with selector "${fillArgs.selector}" not found within ${timeout}ms`
          };
        }
      }

      // Try CDP approach first
      const cdpResult = await this.fillViaCDP(client, fillArgs.selector, fillArgs.text, fillArgs.clearFirst);
      if (cdpResult.success) {
        return cdpResult;
      }

      // Fallback to eval approach if CDP fails
      const evalResult = await this.fillViaEval(client, fillArgs.selector, fillArgs.text, fillArgs.clearFirst);
      return evalResult;

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Wait for element to be available in the DOM
   */
  private async waitForElement(
    client: CDPClient, 
    selector: string, 
    timeout: number
  ): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        // Try to find the element
        const result = await client.send('Runtime.evaluate', {
          expression: `document.querySelector('${selector.replace(/'/g, "\\'")}') !== null`,
          returnByValue: true
        }) as { result: { value: boolean } };

        if (result.result.value) {
          return true;
        }

        // Wait 100ms before trying again
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        // Continue waiting if there's an error
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return false;
  }

  /**
   * Fill form field using CDP DOM.querySelector and Runtime.callFunctionOn
   */
  private async fillViaCDP(client: CDPClient, selector: string, text: string, clearFirst = true): Promise<CommandResult> {
    try {
      // Get the document root
      const documentResponse = await client.send('DOM.getDocument') as { root: { nodeId: number } };
      const rootNodeId = documentResponse.root.nodeId;

      // Query for the element
      const queryResponse = await client.send('DOM.querySelector', {
        nodeId: rootNodeId,
        selector: selector
      }) as DOMQuerySelectorResponse;

      if (!queryResponse.nodeId || queryResponse.nodeId === 0) {
        return {
          success: false,
          error: `Element with selector "${selector}" not found`
        };
      }

      // Get the remote object for the element
      const objectResponse = await client.send('DOM.resolveNode', {
        nodeId: queryResponse.nodeId
      }) as { object: { objectId: string } };

      if (!objectResponse.object?.objectId) {
        return {
          success: false,
          error: 'Failed to resolve element to remote object'
        };
      }

      // Call fill function on the element
      const fillResponse = await client.send('Runtime.callFunctionOn', {
        objectId: objectResponse.object.objectId,
        functionDeclaration: `
          function(text, clearFirst) {
            // Check if element is a form field
            const tagName = this.tagName.toLowerCase();
            const inputType = this.type ? this.type.toLowerCase() : '';
            
            if (!['input', 'textarea', 'select'].includes(tagName)) {
              throw new Error('Element is not a form field (input, textarea, or select)');
            }
            
            // For select elements, try to select by value or text
            if (tagName === 'select') {
              // Try to find option by value first
              let option = Array.from(this.options).find(opt => opt.value === text);
              
              // If not found by value, try by text content
              if (!option) {
                option = Array.from(this.options).find(opt => opt.textContent.trim() === text);
              }
              
              if (option) {
                this.value = option.value;
                this.selectedIndex = option.index;
              } else {
                throw new Error('Option not found in select element: ' + text);
              }
            } else {
              // For input and textarea elements
              if (clearFirst) {
                this.value = '';
              }
              
              // Set the value
              this.value = text;
              
              // Trigger input events to notify any listeners
              this.dispatchEvent(new Event('input', { bubbles: true }));
              this.dispatchEvent(new Event('change', { bubbles: true }));
            }
            
            // Focus the element
            this.focus();
            
            return {
              success: true,
              tagName: this.tagName,
              id: this.id,
              className: this.className,
              value: this.value,
              type: this.type || null
            };
          }
        `,
        arguments: [
          { value: text },
          { value: clearFirst }
        ],
        returnByValue: true,
        userGesture: true
      }) as RuntimeCallFunctionResponse;

      // Check for execution errors
      if (fillResponse.exceptionDetails) {
        return {
          success: false,
          error: `Fill execution failed: ${fillResponse.exceptionDetails.exception?.description || fillResponse.exceptionDetails.text}`
        };
      }

      return {
        success: true,
        data: {
          selector: selector,
          text: text,
          element: fillResponse.result.value,
          method: 'CDP'
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `CDP fill failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Fill form field using eval as fallback
   */
  private async fillViaEval(client: CDPClient, selector: string, text: string, clearFirst = true): Promise<CommandResult> {
    try {
      // Escape the selector and text for JavaScript string
      const escapedSelector = selector.replace(/'/g, "\\'").replace(/"/g, '\\"');
      const escapedText = text.replace(/'/g, "\\'").replace(/"/g, '\\"');
      
      const expression = `
        (function() {
          const element = document.querySelector('${escapedSelector}');
          if (!element) {
            throw new Error('Element with selector "${escapedSelector}" not found');
          }
          
          // Check if element is a form field
          const tagName = element.tagName.toLowerCase();
          const inputType = element.type ? element.type.toLowerCase() : '';
          
          if (!['input', 'textarea', 'select'].includes(tagName)) {
            throw new Error('Element is not a form field (input, textarea, or select)');
          }
          
          const text = '${escapedText}';
          const clearFirst = ${clearFirst};
          
          // For select elements, try to select by value or text
          if (tagName === 'select') {
            // Try to find option by value first
            let option = Array.from(element.options).find(opt => opt.value === text);
            
            // If not found by value, try by text content
            if (!option) {
              option = Array.from(element.options).find(opt => opt.textContent.trim() === text);
            }
            
            if (option) {
              element.value = option.value;
              element.selectedIndex = option.index;
            } else {
              throw new Error('Option not found in select element: ' + text);
            }
          } else {
            // For input and textarea elements
            if (clearFirst) {
              element.value = '';
            }
            
            // Set the value
            element.value = text;
            
            // Trigger input events to notify any listeners
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
          }
          
          // Focus the element
          element.focus();
          
          return {
            success: true,
            tagName: element.tagName,
            id: element.id,
            className: element.className,
            value: element.value,
            type: element.type || null
          };
        })()
      `;

      const response = await client.send('Runtime.evaluate', {
        expression: expression,
        returnByValue: true,
        userGesture: true
      }) as { 
        result: { value: unknown }, 
        exceptionDetails?: { 
          exception?: { description?: string }, 
          text: string 
        } 
      };

      // Check for JavaScript execution errors
      if (response.exceptionDetails) {
        return {
          success: false,
          error: response.exceptionDetails.exception?.description || response.exceptionDetails.text
        };
      }

      return {
        success: true,
        data: {
          selector: selector,
          text: text,
          element: response.result.value,
          method: 'eval'
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Eval fill failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Validate command arguments
   */
  validateArgs(args: unknown): boolean {
    if (typeof args !== 'object' || args === null) {
      return false;
    }

    const fillArgs = args as FillArgs;

    // Selector is required and must be a string
    if (!fillArgs.selector || typeof fillArgs.selector !== 'string') {
      return false;
    }

    // Text is required and must be a string
    if (fillArgs.text === undefined || fillArgs.text === null || typeof fillArgs.text !== 'string') {
      return false;
    }

    // Optional parameters type validation
    if (fillArgs.waitForElement !== undefined && typeof fillArgs.waitForElement !== 'boolean') {
      return false;
    }

    if (fillArgs.timeout !== undefined && typeof fillArgs.timeout !== 'number') {
      return false;
    }

    if (fillArgs.clearFirst !== undefined && typeof fillArgs.clearFirst !== 'boolean') {
      return false;
    }

    return true;
  }

  /**
   * Get command help text
   */
  getHelp(): string {
    return `
fill - Fill a form field with text using CSS selector

Usage:
  fill <selector> <text>
  fill "#username" "john@example.com"
  fill "input[name='password']" "secret123" --timeout 10000
  fill "#country" "United States" --no-clear

Arguments:
  <selector>              CSS selector for the form field to fill
  <text>                  Text to input into the field

Options:
  --wait-for-element      Wait for element to be available (default: true)
  --no-wait              Don't wait for element (same as --wait-for-element=false)
  --timeout <ms>         Timeout for waiting for element (default: 5000ms)
  --clear-first          Clear field before filling (default: true)
  --no-clear             Don't clear field before filling

Examples:
  # Fill a text input by ID
  fill "#username" "john@example.com"

  # Fill a password field
  fill "input[type='password']" "secret123"

  # Fill a textarea
  fill "#message" "Hello, this is a test message"

  # Select an option in a dropdown (by value or text)
  fill "#country" "US"
  fill "#country" "United States"

  # Fill without clearing existing content
  fill "#notes" " - Additional note" --no-clear

  # Fill with custom timeout
  fill ".slow-loading-field" "value" --timeout 10000

Note:
  - Works with input, textarea, and select elements
  - For select elements, matches by option value first, then by text content
  - Automatically triggers 'input' and 'change' events
  - Uses CDP DOM.querySelector and Runtime.callFunctionOn for precise control
  - Falls back to JavaScript eval if CDP approach fails
`;
  }
}
import { ICommandHandler } from '../interfaces/CommandHandler';
import { CDPClient, CommandResult } from '../types';

/**
 * Arguments for click command
 */
export interface ClickArgs {
  selector: string;         // CSS selector for the element to click
  waitForElement?: boolean; // Wait for element to be available (default: true)
  timeout?: number;         // Timeout for waiting for element (default: 5000ms)
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
 * Handler for click command
 * Clicks on elements using CSS selectors via CDP DOM.querySelector and Runtime.callFunctionOn
 */
export class ClickHandler implements ICommandHandler {
  readonly name = 'click';

  /**
   * Execute click command on specified element
   */
  async execute(client: CDPClient, args: unknown): Promise<CommandResult> {
    const clickArgs = args as ClickArgs;

    // Validate arguments
    if (!clickArgs.selector) {
      return {
        success: false,
        error: 'CSS selector is required for click command'
      };
    }

    if (typeof clickArgs.selector !== 'string') {
      return {
        success: false,
        error: 'CSS selector must be a string'
      };
    }

    try {
      // Enable DOM domain first
      await client.send('DOM.enable');
      await client.send('Runtime.enable');

      const timeout = clickArgs.timeout || 5000;
      const waitForElement = clickArgs.waitForElement !== false;

      if (waitForElement) {
        // Wait for element to be available
        const elementFound = await this.waitForElement(client, clickArgs.selector, timeout);
        if (!elementFound) {
          return {
            success: false,
            error: `Element with selector "${clickArgs.selector}" not found within ${timeout}ms`
          };
        }
      }

      // Try CDP approach first
      const cdpResult = await this.clickViaCDP(client, clickArgs.selector);
      if (cdpResult.success) {
        return cdpResult;
      }

      // Fallback to eval approach if CDP fails
      const evalResult = await this.clickViaEval(client, clickArgs.selector);
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
   * Click element using CDP DOM.querySelector and Runtime.callFunctionOn
   */
  private async clickViaCDP(client: CDPClient, selector: string): Promise<CommandResult> {
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

      // Call click function on the element
      const clickResponse = await client.send('Runtime.callFunctionOn', {
        objectId: objectResponse.object.objectId,
        functionDeclaration: `
          function() {
            // Scroll element into view if needed
            this.scrollIntoView({ behavior: 'instant', block: 'center' });
            
            // Trigger click event
            this.click();
            
            return {
              success: true,
              tagName: this.tagName,
              id: this.id,
              className: this.className
            };
          }
        `,
        returnByValue: true,
        userGesture: true
      }) as RuntimeCallFunctionResponse;

      // Check for execution errors
      if (clickResponse.exceptionDetails) {
        return {
          success: false,
          error: `Click execution failed: ${clickResponse.exceptionDetails.exception?.description || clickResponse.exceptionDetails.text}`
        };
      }

      return {
        success: true,
        data: {
          selector: selector,
          element: clickResponse.result.value,
          method: 'CDP'
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `CDP click failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Click element using eval as fallback
   */
  private async clickViaEval(client: CDPClient, selector: string): Promise<CommandResult> {
    try {
      // Escape the selector for JavaScript string
      const escapedSelector = selector.replace(/'/g, "\\'").replace(/"/g, '\\"');
      
      const expression = `
        (function() {
          const element = document.querySelector('${escapedSelector}');
          if (!element) {
            throw new Error('Element with selector "${escapedSelector}" not found');
          }
          
          // Scroll element into view if needed
          element.scrollIntoView({ behavior: 'instant', block: 'center' });
          
          // Trigger click event
          element.click();
          
          return {
            success: true,
            tagName: element.tagName,
            id: element.id,
            className: element.className
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
          element: response.result.value,
          method: 'eval'
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Eval click failed: ${error instanceof Error ? error.message : String(error)}`
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

    const clickArgs = args as ClickArgs;

    // Selector is required and must be a string
    if (!clickArgs.selector || typeof clickArgs.selector !== 'string') {
      return false;
    }

    // Optional parameters type validation
    if (clickArgs.waitForElement !== undefined && typeof clickArgs.waitForElement !== 'boolean') {
      return false;
    }

    if (clickArgs.timeout !== undefined && typeof clickArgs.timeout !== 'number') {
      return false;
    }

    return true;
  }

  /**
   * Get command help text
   */
  getHelp(): string {
    return `
click - Click on an element using CSS selector

Usage:
  click <selector>
  click "#submit-button"
  click ".menu-item" --timeout 10000
  click "button[type='submit']" --no-wait

Arguments:
  <selector>              CSS selector for the element to click

Options:
  --wait-for-element      Wait for element to be available (default: true)
  --no-wait              Don't wait for element (same as --wait-for-element=false)
  --timeout <ms>         Timeout for waiting for element (default: 5000ms)

Examples:
  # Click a button by ID
  click "#submit-button"

  # Click a link by text content (using CSS selector)
  click "a[href='/login']"

  # Click with custom timeout
  click ".slow-loading-button" --timeout 10000

  # Click without waiting (fail immediately if not found)
  click "#optional-element" --no-wait

Note:
  - Uses CDP DOM.querySelector and Runtime.callFunctionOn for precise control
  - Falls back to JavaScript eval if CDP approach fails
  - Automatically scrolls element into view before clicking
  - Triggers actual click events that work with event listeners
`;
  }
}
import { ICommandHandler } from '../interfaces/CommandHandler';
import { CDPClient, CommandResult } from '../types';

/**
 * Arguments for hover command
 */
export interface HoverArgs {
  selector: string;         // CSS selector for the element to hover
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
 * Handler for hover command
 * Hovers over elements using CSS selectors via CDP DOM.querySelector and Runtime.callFunctionOn
 */
export class HoverHandler implements ICommandHandler {
  readonly name = 'hover';

  /**
   * Execute hover command on specified element
   */
  async execute(client: CDPClient, args: unknown): Promise<CommandResult> {
    const hoverArgs = args as HoverArgs;

    // Validate arguments
    if (!hoverArgs.selector) {
      return {
        success: false,
        error: 'CSS selector is required for hover command'
      };
    }

    if (typeof hoverArgs.selector !== 'string') {
      return {
        success: false,
        error: 'CSS selector must be a string'
      };
    }

    try {
      // Enable DOM domain first
      await client.send('DOM.enable');
      await client.send('Runtime.enable');

      const timeout = hoverArgs.timeout || 5000;
      const waitForElement = hoverArgs.waitForElement !== false;

      if (waitForElement) {
        // Wait for element to be available
        const elementFound = await this.waitForElement(client, hoverArgs.selector, timeout);
        if (!elementFound) {
          return {
            success: false,
            error: `Element with selector "${hoverArgs.selector}" not found within ${timeout}ms`
          };
        }
      }

      // Try CDP approach first
      const cdpResult = await this.hoverViaCDP(client, hoverArgs.selector);
      if (cdpResult.success) {
        return cdpResult;
      }

      // Fallback to eval approach if CDP fails
      const evalResult = await this.hoverViaEval(client, hoverArgs.selector);
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
   * Hover over element using CDP DOM.querySelector and Runtime.callFunctionOn
   */
  private async hoverViaCDP(client: CDPClient, selector: string): Promise<CommandResult> {
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

      // Call hover function on the element
      const hoverResponse = await client.send('Runtime.callFunctionOn', {
        objectId: objectResponse.object.objectId,
        functionDeclaration: `
          function() {
            // Scroll element into view if needed
            this.scrollIntoView({ behavior: 'instant', block: 'center' });
            
            // Create and dispatch mouseover event
            const mouseOverEvent = new MouseEvent('mouseover', {
              bubbles: true,
              cancelable: true,
              view: window
            });
            this.dispatchEvent(mouseOverEvent);
            
            // Create and dispatch mouseenter event
            const mouseEnterEvent = new MouseEvent('mouseenter', {
              bubbles: false,
              cancelable: false,
              view: window
            });
            this.dispatchEvent(mouseEnterEvent);
            
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
      if (hoverResponse.exceptionDetails) {
        return {
          success: false,
          error: `Hover execution failed: ${hoverResponse.exceptionDetails.exception?.description || hoverResponse.exceptionDetails.text}`
        };
      }

      return {
        success: true,
        data: {
          selector: selector,
          element: hoverResponse.result.value,
          method: 'CDP'
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `CDP hover failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Hover over element using eval as fallback
   */
  private async hoverViaEval(client: CDPClient, selector: string): Promise<CommandResult> {
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
          
          // Create and dispatch mouseover event
          const mouseOverEvent = new MouseEvent('mouseover', {
            bubbles: true,
            cancelable: true,
            view: window
          });
          element.dispatchEvent(mouseOverEvent);
          
          // Create and dispatch mouseenter event
          const mouseEnterEvent = new MouseEvent('mouseenter', {
            bubbles: false,
            cancelable: false,
            view: window
          });
          element.dispatchEvent(mouseEnterEvent);
          
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
        error: `Eval hover failed: ${error instanceof Error ? error.message : String(error)}`
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

    const hoverArgs = args as HoverArgs;

    // Selector is required and must be a string
    if (!hoverArgs.selector || typeof hoverArgs.selector !== 'string') {
      return false;
    }

    // Optional parameters type validation
    if (hoverArgs.waitForElement !== undefined && typeof hoverArgs.waitForElement !== 'boolean') {
      return false;
    }

    if (hoverArgs.timeout !== undefined && typeof hoverArgs.timeout !== 'number') {
      return false;
    }

    return true;
  }

  /**
   * Get command help text
   */
  getHelp(): string {
    return `
hover - Hover over an element using CSS selector

Usage:
  hover <selector>
  hover "#menu-item"
  hover ".dropdown-trigger" --timeout 10000
  hover "button[data-tooltip]" --no-wait

Arguments:
  <selector>              CSS selector for the element to hover over

Options:
  --wait-for-element      Wait for element to be available (default: true)
  --no-wait              Don't wait for element (same as --wait-for-element=false)
  --timeout <ms>         Timeout for waiting for element (default: 5000ms)

Examples:
  # Hover over a menu item by ID
  hover "#menu-item"

  # Hover over a dropdown trigger
  hover ".dropdown-trigger"

  # Hover with custom timeout
  hover ".slow-loading-element" --timeout 10000

  # Hover without waiting (fail immediately if not found)
  hover "#optional-tooltip" --no-wait

Note:
  - Uses CDP DOM.querySelector and Runtime.callFunctionOn for precise control
  - Falls back to JavaScript eval if CDP approach fails
  - Automatically scrolls element into view before hovering
  - Dispatches both 'mouseover' and 'mouseenter' events
  - Works with CSS :hover selectors and JavaScript event listeners
`;
  }
}
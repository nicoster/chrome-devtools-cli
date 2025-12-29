import { ICommandHandler } from '../interfaces/CommandHandler';
import { CDPClient, CommandResult } from '../types';

/**
 * Arguments for drag command
 */
export interface DragArgs {
  sourceSelector: string;   // CSS selector for the element to drag
  targetSelector: string;   // CSS selector for the drop target
  waitForElement?: boolean; // Wait for elements to be available (default: true)
  timeout?: number;         // Timeout for waiting for elements (default: 5000ms)
}

/**
 * Handler for drag command
 * Performs drag and drop operations using JavaScript event simulation
 */
export class DragHandler implements ICommandHandler {
  readonly name = 'drag';

  /**
   * Execute drag command from source to target element
   */
  async execute(client: CDPClient, args: unknown): Promise<CommandResult> {
    const dragArgs = args as DragArgs;

    // Validate arguments
    if (!dragArgs.sourceSelector) {
      return {
        success: false,
        error: 'Source CSS selector is required for drag command'
      };
    }

    if (typeof dragArgs.sourceSelector !== 'string') {
      return {
        success: false,
        error: 'Source CSS selector must be a string'
      };
    }

    if (!dragArgs.targetSelector) {
      return {
        success: false,
        error: 'Target CSS selector is required for drag command'
      };
    }

    if (typeof dragArgs.targetSelector !== 'string') {
      return {
        success: false,
        error: 'Target CSS selector must be a string'
      };
    }

    try {
      await client.send('Runtime.enable');
      await client.send('DOM.enable');
      // Note: Input domain doesn't require explicit enabling

      const timeout = dragArgs.timeout || 5000;
      const waitForElement = dragArgs.waitForElement !== false;

      if (waitForElement) {
        // Wait for both source and target elements to be available
        const sourceFound = await this.waitForElement(client, dragArgs.sourceSelector, timeout);
        if (!sourceFound) {
          return {
            success: false,
            error: `Source element with selector "${dragArgs.sourceSelector}" not found within ${timeout}ms`
          };
        }

        const targetFound = await this.waitForElement(client, dragArgs.targetSelector, timeout);
        if (!targetFound) {
          return {
            success: false,
            error: `Target element with selector "${dragArgs.targetSelector}" not found within ${timeout}ms`
          };
        }
      }

      // Try Input.dispatchMouseEvent approach first (most reliable)
      const inputResult = await this.dragViaInput(client, dragArgs.sourceSelector, dragArgs.targetSelector);
      if (inputResult.success) {
        return inputResult;
      }

      // Fallback to JavaScript event simulation
      const result = await this.dragViaEval(client, dragArgs.sourceSelector, dragArgs.targetSelector);
      return result;

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
        const result = await client.send('Runtime.evaluate', {
          expression: `document.querySelector('${selector.replace(/'/g, "\\'")}') !== null`,
          returnByValue: true
        }) as { result: { value: boolean } };

        if (result.result.value) {
          return true;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return false;
  }

  /**
   * Perform drag and drop using CDP Input.dispatchMouseEvent (most reliable method)
   */
  private async dragViaInput(client: CDPClient, sourceSelector: string, targetSelector: string): Promise<CommandResult> {
    try {
      // Get element coordinates using JavaScript
      const escapedSource = sourceSelector.replace(/'/g, "\\'").replace(/"/g, '\\"');
      const escapedTarget = targetSelector.replace(/'/g, "\\'").replace(/"/g, '\\"');
      
      const getCoordsExpression = `
        (function() {
          const sourceElement = document.querySelector('${escapedSource}');
          if (!sourceElement) {
            return null;
          }
          
          const targetElement = document.querySelector('${escapedTarget}');
          if (!targetElement) {
            return null;
          }
          
          // Scroll elements into view if needed
          sourceElement.scrollIntoView({ behavior: 'instant', block: 'center' });
          targetElement.scrollIntoView({ behavior: 'instant', block: 'center' });
          
          // Get bounding boxes
          const sourceRect = sourceElement.getBoundingClientRect();
          const targetRect = targetElement.getBoundingClientRect();
          
          // Calculate center positions
          const sourceX = Math.round(sourceRect.left + sourceRect.width / 2);
          const sourceY = Math.round(sourceRect.top + sourceRect.height / 2);
          const targetX = Math.round(targetRect.left + targetRect.width / 2);
          const targetY = Math.round(targetRect.top + targetRect.height / 2);
          
          return {
            source: {
              x: sourceX,
              y: sourceY,
              tagName: sourceElement.tagName,
              id: sourceElement.id,
              className: sourceElement.className
            },
            target: {
              x: targetX,
              y: targetY,
              tagName: targetElement.tagName,
              id: targetElement.id,
              className: targetElement.className
            }
          };
        })()
      `;

      const coordsResponse = await client.send('Runtime.evaluate', {
        expression: getCoordsExpression,
        returnByValue: true
      }) as { 
        result: { value: { 
          source: { x: number; y: number; tagName: string; id: string; className: string };
          target: { x: number; y: number; tagName: string; id: string; className: string };
        } | null }, 
        exceptionDetails?: { 
          exception?: { description?: string }, 
          text: string 
        } 
      };

      if (coordsResponse.exceptionDetails) {
        return {
          success: false,
          error: `Failed to get element coordinates: ${coordsResponse.exceptionDetails.exception?.description || coordsResponse.exceptionDetails.text}`
        };
      }

      const coords = coordsResponse.result.value;
      if (!coords) {
        return {
          success: false,
          error: `Source or target element not found`
        };
      }

      // Calculate intermediate steps for smooth dragging
      const steps = 10; // Number of intermediate mouse move steps
      const dx = (coords.target.x - coords.source.x) / steps;
      const dy = (coords.target.y - coords.source.y) / steps;

      // Step 1: Press mouse at source position
      await client.send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: coords.source.x,
        y: coords.source.y,
        button: 'left',
        clickCount: 1
      });

      // Small delay after press
      await new Promise(resolve => setTimeout(resolve, 50));

      // Step 2: Move mouse from source to target in steps
      for (let i = 1; i <= steps; i++) {
        const currentX = Math.round(coords.source.x + dx * i);
        const currentY = Math.round(coords.source.y + dy * i);
        
        await client.send('Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          x: currentX,
          y: currentY,
          button: 'left',
          buttons: 1 // Left button is pressed
        });
        
        // Small delay between moves for smooth animation
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Small delay before release
      await new Promise(resolve => setTimeout(resolve, 50));

      // Step 3: Release mouse at target position
      await client.send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: coords.target.x,
        y: coords.target.y,
        button: 'left',
        clickCount: 1
      });

      return {
        success: true,
        data: {
          sourceSelector: sourceSelector,
          targetSelector: targetSelector,
          result: {
            success: true,
            source: {
              tagName: coords.source.tagName,
              id: coords.source.id,
              className: coords.source.className,
              position: { x: coords.source.x, y: coords.source.y }
            },
            target: {
              tagName: coords.target.tagName,
              id: coords.target.id,
              className: coords.target.className,
              position: { x: coords.target.x, y: coords.target.y }
            }
          },
          method: 'Input.dispatchMouseEvent'
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Input drag failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Perform drag and drop using JavaScript event simulation
   */
  private async dragViaEval(client: CDPClient, sourceSelector: string, targetSelector: string): Promise<CommandResult> {
    try {
      const escapedSource = sourceSelector.replace(/'/g, "\\'").replace(/"/g, '\\"');
      const escapedTarget = targetSelector.replace(/'/g, "\\'").replace(/"/g, '\\"');
      
      const expression = `
        (function() {
          const sourceElement = document.querySelector('${escapedSource}');
          if (!sourceElement) {
            throw new Error('Source element with selector "${escapedSource}" not found');
          }
          
          const targetElement = document.querySelector('${escapedTarget}');
          if (!targetElement) {
            throw new Error('Target element with selector "${escapedTarget}" not found');
          }
          
          // Get element positions
          const sourceRect = sourceElement.getBoundingClientRect();
          const targetRect = targetElement.getBoundingClientRect();
          
          // Calculate center positions
          const sourceX = sourceRect.left + sourceRect.width / 2;
          const sourceY = sourceRect.top + sourceRect.height / 2;
          const targetX = targetRect.left + targetRect.width / 2;
          const targetY = targetRect.top + targetRect.height / 2;
          
          // Create and dispatch dragstart event
          const dragStartEvent = new DragEvent('dragstart', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: sourceX,
            clientY: sourceY,
            dataTransfer: new DataTransfer()
          });
          sourceElement.dispatchEvent(dragStartEvent);
          
          // Create and dispatch dragenter event on target
          const dragEnterEvent = new DragEvent('dragenter', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: targetX,
            clientY: targetY,
            dataTransfer: dragStartEvent.dataTransfer
          });
          targetElement.dispatchEvent(dragEnterEvent);
          
          // Create and dispatch dragover event on target
          const dragOverEvent = new DragEvent('dragover', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: targetX,
            clientY: targetY,
            dataTransfer: dragStartEvent.dataTransfer
          });
          targetElement.dispatchEvent(dragOverEvent);
          
          // Create and dispatch drop event on target
          const dropEvent = new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: targetX,
            clientY: targetY,
            dataTransfer: dragStartEvent.dataTransfer
          });
          targetElement.dispatchEvent(dropEvent);
          
          // Create and dispatch dragend event on source
          const dragEndEvent = new DragEvent('dragend', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: targetX,
            clientY: targetY,
            dataTransfer: dragStartEvent.dataTransfer
          });
          sourceElement.dispatchEvent(dragEndEvent);
          
          return {
            success: true,
            source: {
              tagName: sourceElement.tagName,
              id: sourceElement.id,
              className: sourceElement.className,
              position: { x: sourceX, y: sourceY }
            },
            target: {
              tagName: targetElement.tagName,
              id: targetElement.id,
              className: targetElement.className,
              position: { x: targetX, y: targetY }
            }
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

      if (response.exceptionDetails) {
        return {
          success: false,
          error: response.exceptionDetails.exception?.description || response.exceptionDetails.text
        };
      }

      return {
        success: true,
        data: {
          sourceSelector: sourceSelector,
          targetSelector: targetSelector,
          result: response.result.value
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Drag operation failed: ${error instanceof Error ? error.message : String(error)}`
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

    const dragArgs = args as DragArgs;

    if (!dragArgs.sourceSelector || typeof dragArgs.sourceSelector !== 'string') {
      return false;
    }

    if (!dragArgs.targetSelector || typeof dragArgs.targetSelector !== 'string') {
      return false;
    }

    if (dragArgs.waitForElement !== undefined && typeof dragArgs.waitForElement !== 'boolean') {
      return false;
    }

    if (dragArgs.timeout !== undefined && typeof dragArgs.timeout !== 'number') {
      return false;
    }

    return true;
  }

  /**
   * Get command help text
   */
  getHelp(): string {
    return `
drag - Perform drag and drop operation from source to target element

Usage:
  drag <sourceSelector> <targetSelector>
  drag "#draggable" "#dropzone"
  drag ".item" ".container" --timeout 10000
  drag "#source" "#target" --no-wait

Arguments:
  <sourceSelector>        CSS selector for the element to drag
  <targetSelector>        CSS selector for the drop target

Options:
  --wait-for-element      Wait for elements to be available (default: true)
  --no-wait              Don't wait for elements (same as --wait-for-element=false)
  --timeout <ms>         Timeout for waiting for elements (default: 5000ms)

Examples:
  # Drag an item to a dropzone
  drag "#draggable-item" "#drop-zone"

  # Drag a file to upload area
  drag ".file-item" ".upload-area"

  # Drag with custom timeout
  drag ".slow-loading-item" ".target" --timeout 10000

  # Drag without waiting (fail immediately if not found)
  drag "#source" "#target" --no-wait

Note:
  - Uses CDP Input.dispatchMouseEvent for most reliable drag simulation
  - Falls back to JavaScript DragEvent simulation if Input fails
  - Simulates complete mouse sequence: mousePressed → mouseMoved → mouseReleased
  - Automatically calculates element center positions and smooth movement path
  - Works with all drag and drop implementations including React/Vue libraries
`;
  }
}

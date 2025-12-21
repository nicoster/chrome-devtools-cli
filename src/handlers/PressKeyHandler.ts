import { ICommandHandler } from '../interfaces/CommandHandler';
import { CDPClient, CommandResult } from '../types';

/**
 * Arguments for press_key command
 */
export interface PressKeyArgs {
  key: string;              // Key to press (e.g., 'Enter', 'Escape', 'a', 'ArrowDown')
  selector?: string;        // Optional CSS selector to focus element first
  modifiers?: string[];     // Optional modifiers: 'Ctrl', 'Alt', 'Shift', 'Meta'
  waitForElement?: boolean; // Wait for element to be available if selector provided (default: true)
  timeout?: number;         // Timeout for waiting for element (default: 5000ms)
}

/**
 * Handler for press_key command
 * Simulates keyboard input using JavaScript KeyboardEvent
 */
export class PressKeyHandler implements ICommandHandler {
  readonly name = 'press_key';

  /**
   * Execute press_key command
   */
  async execute(client: CDPClient, args: unknown): Promise<CommandResult> {
    const keyArgs = args as PressKeyArgs;

    // Validate arguments
    if (!keyArgs.key) {
      return {
        success: false,
        error: 'Key is required for press_key command'
      };
    }

    if (typeof keyArgs.key !== 'string') {
      return {
        success: false,
        error: 'Key must be a string'
      };
    }

    try {
      await client.send('Runtime.enable');

      const timeout = keyArgs.timeout || 5000;
      const waitForElement = keyArgs.waitForElement !== false;

      // If selector is provided, wait for and focus the element first
      if (keyArgs.selector) {
        if (waitForElement) {
          const elementFound = await this.waitForElement(client, keyArgs.selector, timeout);
          if (!elementFound) {
            return {
              success: false,
              error: `Element with selector "${keyArgs.selector}" not found within ${timeout}ms`
            };
          }
        }

        // Focus the element first
        const focusResult = await this.focusElement(client, keyArgs.selector);
        if (!focusResult.success) {
          return focusResult;
        }
      }

      // Press the key
      const result = await this.pressKeyViaEval(client, keyArgs.key, keyArgs.modifiers || [], keyArgs.selector);
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
   * Focus an element before pressing keys
   */
  private async focusElement(client: CDPClient, selector: string): Promise<CommandResult> {
    try {
      const escapedSelector = selector.replace(/'/g, "\\'").replace(/"/g, '\\"');
      
      const expression = `
        (function() {
          const element = document.querySelector('${escapedSelector}');
          if (!element) {
            throw new Error('Element with selector "${escapedSelector}" not found');
          }
          
          element.focus();
          
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

      if (response.exceptionDetails) {
        return {
          success: false,
          error: response.exceptionDetails.exception?.description || response.exceptionDetails.text
        };
      }

      return {
        success: true,
        data: response.result.value
      };

    } catch (error) {
      return {
        success: false,
        error: `Focus failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Press key using JavaScript KeyboardEvent simulation
   */
  private async pressKeyViaEval(client: CDPClient, key: string, modifiers: string[], selector?: string): Promise<CommandResult> {
    try {
      const escapedKey = key.replace(/'/g, "\\'").replace(/"/g, '\\"');
      const modifierFlags = {
        ctrlKey: modifiers.includes('Ctrl') || modifiers.includes('Control'),
        altKey: modifiers.includes('Alt'),
        shiftKey: modifiers.includes('Shift'),
        metaKey: modifiers.includes('Meta') || modifiers.includes('Cmd')
      };
      
      const expression = `
        (function() {
          const key = '${escapedKey}';
          const modifiers = ${JSON.stringify(modifierFlags)};
          
          // Determine target element
          let targetElement = document.activeElement;
          ${selector ? `
          const specifiedElement = document.querySelector('${selector.replace(/'/g, "\\'")}');
          if (specifiedElement) {
            targetElement = specifiedElement;
          }
          ` : ''}
          
          if (!targetElement) {
            targetElement = document.body;
          }
          
          // Create keyboard event options
          const eventOptions = {
            key: key,
            code: key.length === 1 ? 'Key' + key.toUpperCase() : key,
            bubbles: true,
            cancelable: true,
            view: window,
            ctrlKey: modifiers.ctrlKey,
            altKey: modifiers.altKey,
            shiftKey: modifiers.shiftKey,
            metaKey: modifiers.metaKey
          };
          
          // Handle special keys
          const specialKeys = {
            'Enter': { code: 'Enter', keyCode: 13 },
            'Escape': { code: 'Escape', keyCode: 27 },
            'Tab': { code: 'Tab', keyCode: 9 },
            'Backspace': { code: 'Backspace', keyCode: 8 },
            'Delete': { code: 'Delete', keyCode: 46 },
            'ArrowUp': { code: 'ArrowUp', keyCode: 38 },
            'ArrowDown': { code: 'ArrowDown', keyCode: 40 },
            'ArrowLeft': { code: 'ArrowLeft', keyCode: 37 },
            'ArrowRight': { code: 'ArrowRight', keyCode: 39 },
            'Home': { code: 'Home', keyCode: 36 },
            'End': { code: 'End', keyCode: 35 },
            'PageUp': { code: 'PageUp', keyCode: 33 },
            'PageDown': { code: 'PageDown', keyCode: 34 },
            'Space': { code: 'Space', keyCode: 32, key: ' ' }
          };
          
          if (specialKeys[key]) {
            eventOptions.code = specialKeys[key].code;
            eventOptions.keyCode = specialKeys[key].keyCode;
            if (specialKeys[key].key) {
              eventOptions.key = specialKeys[key].key;
            }
          }
          
          // Create and dispatch keydown event
          const keydownEvent = new KeyboardEvent('keydown', eventOptions);
          targetElement.dispatchEvent(keydownEvent);
          
          // Create and dispatch keypress event (for printable characters)
          if (key.length === 1 || key === 'Enter' || key === 'Space') {
            const keypressEvent = new KeyboardEvent('keypress', eventOptions);
            targetElement.dispatchEvent(keypressEvent);
          }
          
          // Create and dispatch keyup event
          const keyupEvent = new KeyboardEvent('keyup', eventOptions);
          targetElement.dispatchEvent(keyupEvent);
          
          // For input elements, also trigger input event if it's a printable character
          if ((targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA') && 
              key.length === 1 && !modifiers.ctrlKey && !modifiers.altKey && !modifiers.metaKey) {
            // Add character to input value
            const currentValue = targetElement.value || '';
            const cursorPos = targetElement.selectionStart || currentValue.length;
            const newValue = currentValue.slice(0, cursorPos) + key + currentValue.slice(cursorPos);
            targetElement.value = newValue;
            targetElement.selectionStart = targetElement.selectionEnd = cursorPos + 1;
            
            // Trigger input and change events
            targetElement.dispatchEvent(new Event('input', { bubbles: true }));
            targetElement.dispatchEvent(new Event('change', { bubbles: true }));
          }
          
          return {
            success: true,
            key: key,
            modifiers: modifiers,
            target: {
              tagName: targetElement.tagName,
              id: targetElement.id,
              className: targetElement.className,
              value: targetElement.value || null
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
          key: key,
          modifiers: modifiers,
          selector: selector,
          result: response.result.value
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Key press failed: ${error instanceof Error ? error.message : String(error)}`
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

    const keyArgs = args as PressKeyArgs;

    if (!keyArgs.key || typeof keyArgs.key !== 'string') {
      return false;
    }

    if (keyArgs.selector !== undefined && typeof keyArgs.selector !== 'string') {
      return false;
    }

    if (keyArgs.modifiers !== undefined && !Array.isArray(keyArgs.modifiers)) {
      return false;
    }

    if (keyArgs.modifiers && !keyArgs.modifiers.every(mod => typeof mod === 'string')) {
      return false;
    }

    if (keyArgs.waitForElement !== undefined && typeof keyArgs.waitForElement !== 'boolean') {
      return false;
    }

    if (keyArgs.timeout !== undefined && typeof keyArgs.timeout !== 'number') {
      return false;
    }

    return true;
  }

  /**
   * Get command help text
   */
  getHelp(): string {
    return `
press_key - Simulate keyboard input

Usage:
  press_key <key>
  press_key <key> --selector <selector>
  press_key <key> --modifiers Ctrl,Shift
  press_key "Enter" --selector "#input-field"

Arguments:
  <key>                   Key to press (e.g., 'Enter', 'Escape', 'a', 'ArrowDown')

Options:
  --selector <selector>   CSS selector to focus element first
  --modifiers <list>      Comma-separated modifiers: Ctrl, Alt, Shift, Meta
  --wait-for-element      Wait for element to be available if selector provided (default: true)
  --no-wait              Don't wait for element
  --timeout <ms>         Timeout for waiting for element (default: 5000ms)

Examples:
  # Press Enter key
  press_key "Enter"

  # Press Enter in a specific input field
  press_key "Enter" --selector "#search-input"

  # Press Ctrl+A to select all
  press_key "a" --modifiers Ctrl

  # Press Escape key
  press_key "Escape"

  # Press arrow keys for navigation
  press_key "ArrowDown"
  press_key "ArrowUp"

  # Type a character in focused element
  press_key "a"

  # Press Tab to navigate
  press_key "Tab"

  # Press with multiple modifiers
  press_key "s" --modifiers Ctrl,Shift

Supported Keys:
  - Letters: a-z, A-Z
  - Numbers: 0-9
  - Special: Enter, Escape, Tab, Backspace, Delete, Space
  - Arrows: ArrowUp, ArrowDown, ArrowLeft, ArrowRight
  - Navigation: Home, End, PageUp, PageDown
  - Modifiers: Ctrl, Alt, Shift, Meta

Note:
  - Uses JavaScript KeyboardEvent simulation
  - Dispatches keydown, keypress (for printable chars), and keyup events
  - For input fields, automatically updates value and triggers input/change events
  - If selector is provided, focuses the element first
  - Works with keyboard event listeners and form validation
`;
  }
}
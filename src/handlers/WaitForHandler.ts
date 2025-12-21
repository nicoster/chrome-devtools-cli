import { ICommandHandler } from '../interfaces/CommandHandler';
import { CDPClient, CommandResult } from '../types';

/**
 * Arguments for wait_for command
 */
export interface WaitForArgs {
  selector: string;         // CSS selector for the element to wait for
  timeout?: number;         // Timeout for waiting (default: 10000ms)
  visible?: boolean;        // Wait for element to be visible (default: false)
  condition?: 'exists' | 'visible' | 'hidden' | 'enabled' | 'disabled'; // Wait condition
  pollInterval?: number;    // Polling interval in ms (default: 100ms)
}

/**
 * Handler for wait_for command
 * Waits for elements to appear or meet specific conditions
 */
export class WaitForHandler implements ICommandHandler {
  readonly name = 'wait_for';

  /**
   * Execute wait_for command
   */
  async execute(client: CDPClient, args: unknown): Promise<CommandResult> {
    const waitArgs = args as WaitForArgs;

    // Validate arguments
    if (!waitArgs.selector) {
      return {
        success: false,
        error: 'CSS selector is required for wait_for command'
      };
    }

    if (typeof waitArgs.selector !== 'string') {
      return {
        success: false,
        error: 'CSS selector must be a string'
      };
    }

    try {
      await client.send('Runtime.enable');

      const timeout = waitArgs.timeout || 10000;
      const condition = waitArgs.condition || (waitArgs.visible ? 'visible' : 'exists');
      const pollInterval = waitArgs.pollInterval || 100;

      // Wait for the specified condition
      const result = await this.waitForCondition(
        client, 
        waitArgs.selector, 
        condition, 
        timeout, 
        pollInterval
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
   * Wait for element to meet the specified condition
   */
  private async waitForCondition(
    client: CDPClient,
    selector: string,
    condition: string,
    timeout: number,
    pollInterval: number
  ): Promise<CommandResult> {
    const startTime = Date.now();
    let lastError: string | null = null;

    while (Date.now() - startTime < timeout) {
      try {
        const checkResult = await this.checkCondition(client, selector, condition);
        
        if (checkResult.success && checkResult.data) {
          return {
            success: true,
            data: {
              selector: selector,
              condition: condition,
              waitTime: Date.now() - startTime,
              element: checkResult.data
            }
          };
        }

        lastError = checkResult.error || 'Condition not met';
        await new Promise(resolve => setTimeout(resolve, pollInterval));

      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    return {
      success: false,
      error: `Timeout after ${timeout}ms waiting for element "${selector}" to be ${condition}. Last error: ${lastError}`
    };
  }

  /**
   * Check if element meets the specified condition
   */
  private async checkCondition(client: CDPClient, selector: string, condition: string): Promise<CommandResult> {
    try {
      const escapedSelector = selector.replace(/'/g, "\\'").replace(/"/g, '\\"');
      
      let expression: string;

      switch (condition) {
        case 'exists':
          expression = `
            (function() {
              const element = document.querySelector('${escapedSelector}');
              if (element) {
                return {
                  success: true,
                  tagName: element.tagName,
                  id: element.id,
                  className: element.className,
                  condition: 'exists'
                };
              }
              return { success: false, error: 'Element does not exist' };
            })()
          `;
          break;

        case 'visible':
          expression = `
            (function() {
              const element = document.querySelector('${escapedSelector}');
              if (!element) {
                return { success: false, error: 'Element does not exist' };
              }
              
              // Check if element is visible
              const rect = element.getBoundingClientRect();
              const style = window.getComputedStyle(element);
              
              const isVisible = (
                rect.width > 0 && 
                rect.height > 0 && 
                style.visibility !== 'hidden' && 
                style.display !== 'none' &&
                style.opacity !== '0'
              );
              
              if (isVisible) {
                return {
                  success: true,
                  tagName: element.tagName,
                  id: element.id,
                  className: element.className,
                  condition: 'visible',
                  rect: { width: rect.width, height: rect.height, x: rect.x, y: rect.y }
                };
              }
              
              return { success: false, error: 'Element exists but is not visible' };
            })()
          `;
          break;

        case 'hidden':
          expression = `
            (function() {
              const element = document.querySelector('${escapedSelector}');
              if (!element) {
                return {
                  success: true,
                  condition: 'hidden',
                  reason: 'Element does not exist (considered hidden)'
                };
              }
              
              // Check if element is hidden
              const rect = element.getBoundingClientRect();
              const style = window.getComputedStyle(element);
              
              const isHidden = (
                rect.width === 0 || 
                rect.height === 0 || 
                style.visibility === 'hidden' || 
                style.display === 'none' ||
                style.opacity === '0'
              );
              
              if (isHidden) {
                return {
                  success: true,
                  tagName: element.tagName,
                  id: element.id,
                  className: element.className,
                  condition: 'hidden'
                };
              }
              
              return { success: false, error: 'Element exists and is visible' };
            })()
          `;
          break;

        case 'enabled':
          expression = `
            (function() {
              const element = document.querySelector('${escapedSelector}');
              if (!element) {
                return { success: false, error: 'Element does not exist' };
              }
              
              // Check if element is enabled (not disabled)
              const isEnabled = !element.disabled && !element.hasAttribute('disabled');
              
              if (isEnabled) {
                return {
                  success: true,
                  tagName: element.tagName,
                  id: element.id,
                  className: element.className,
                  condition: 'enabled',
                  disabled: element.disabled
                };
              }
              
              return { success: false, error: 'Element exists but is disabled' };
            })()
          `;
          break;

        case 'disabled':
          expression = `
            (function() {
              const element = document.querySelector('${escapedSelector}');
              if (!element) {
                return { success: false, error: 'Element does not exist' };
              }
              
              // Check if element is disabled
              const isDisabled = element.disabled || element.hasAttribute('disabled');
              
              if (isDisabled) {
                return {
                  success: true,
                  tagName: element.tagName,
                  id: element.id,
                  className: element.className,
                  condition: 'disabled',
                  disabled: element.disabled
                };
              }
              
              return { success: false, error: 'Element exists but is enabled' };
            })()
          `;
          break;

        default:
          return {
            success: false,
            error: `Unknown condition: ${condition}. Supported conditions: exists, visible, hidden, enabled, disabled`
          };
      }

      const response = await client.send('Runtime.evaluate', {
        expression: expression,
        returnByValue: true
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

      const result = response.result.value as { success: boolean; error?: string; [key: string]: unknown };
      
      if (result.success) {
        return {
          success: true,
          data: result
        };
      } else {
        return {
          success: false,
          error: result.error || 'Condition check failed'
        };
      }

    } catch (error) {
      return {
        success: false,
        error: `Condition check failed: ${error instanceof Error ? error.message : String(error)}`
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

    const waitArgs = args as WaitForArgs;

    if (!waitArgs.selector || typeof waitArgs.selector !== 'string') {
      return false;
    }

    if (waitArgs.timeout !== undefined && typeof waitArgs.timeout !== 'number') {
      return false;
    }

    if (waitArgs.visible !== undefined && typeof waitArgs.visible !== 'boolean') {
      return false;
    }

    if (waitArgs.condition !== undefined && 
        !['exists', 'visible', 'hidden', 'enabled', 'disabled'].includes(waitArgs.condition)) {
      return false;
    }

    if (waitArgs.pollInterval !== undefined && typeof waitArgs.pollInterval !== 'number') {
      return false;
    }

    return true;
  }

  /**
   * Get command help text
   */
  getHelp(): string {
    return `
wait_for - Wait for an element to appear or meet specific conditions

Usage:
  wait_for <selector>
  wait_for <selector> --condition visible
  wait_for <selector> --timeout 15000
  wait_for "#button" --condition enabled --timeout 5000

Arguments:
  <selector>              CSS selector for the element to wait for

Options:
  --timeout <ms>         Maximum time to wait (default: 10000ms)
  --condition <type>     Condition to wait for (default: exists)
  --visible              Wait for element to be visible (same as --condition visible)
  --poll-interval <ms>   Polling interval (default: 100ms)

Conditions:
  exists                 Element exists in DOM (default)
  visible                Element exists and is visible (not hidden, has dimensions)
  hidden                 Element is hidden or does not exist
  enabled                Element exists and is not disabled
  disabled               Element exists and is disabled

Examples:
  # Wait for element to exist
  wait_for "#loading-spinner"

  # Wait for element to be visible
  wait_for "#modal" --condition visible

  # Wait for button to be enabled
  wait_for "#submit-btn" --condition enabled

  # Wait for element to be hidden
  wait_for "#loading" --condition hidden

  # Wait with custom timeout
  wait_for ".slow-element" --timeout 30000

  # Wait with custom polling interval
  wait_for "#element" --poll-interval 500

  # Legacy syntax (still supported)
  wait_for "#modal" --visible

Note:
  - Polls the condition at regular intervals until met or timeout
  - Returns immediately when condition is satisfied
  - For 'visible' condition, checks dimensions, display, visibility, and opacity
  - For 'enabled/disabled' conditions, works with form elements
  - Useful for waiting for dynamic content, AJAX responses, or animations
`;
  }
}
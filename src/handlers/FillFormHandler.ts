import { ICommandHandler } from '../interfaces/CommandHandler';
import { CDPClient, CommandResult } from '../types';
import { FillHandler } from './FillHandler';

/**
 * Form field data for batch filling
 */
export interface FormFieldData {
  selector: string;         // CSS selector for the form field
  value: string;           // Value to fill into the field
}

/**
 * Arguments for fill_form command
 */
export interface FillFormArgs {
  fields: FormFieldData[];  // Array of form fields to fill
  waitForElements?: boolean; // Wait for elements to be available (default: true)
  timeout?: number;         // Timeout for waiting for elements (default: 5000ms)
  clearFirst?: boolean;     // Clear fields before filling (default: true)
  continueOnError?: boolean; // Continue filling other fields if one fails (default: true)
}

/**
 * Result for individual field filling
 */
interface FieldResult {
  selector: string;
  value: string;
  success: boolean;
  error?: string;
  data?: unknown;
}

/**
 * Handler for fill_form command
 * Fills multiple form fields in batch using the FillHandler
 */
export class FillFormHandler implements ICommandHandler {
  readonly name = 'fill_form';
  private fillHandler: FillHandler;

  constructor() {
    this.fillHandler = new FillHandler();
  }

  /**
   * Execute fill_form command on multiple form fields
   */
  async execute(client: CDPClient, args: unknown): Promise<CommandResult> {
    const fillFormArgs = args as FillFormArgs;

    // Validate arguments
    if (!fillFormArgs.fields) {
      return {
        success: false,
        error: 'Fields array is required for fill_form command'
      };
    }

    if (!Array.isArray(fillFormArgs.fields)) {
      return {
        success: false,
        error: 'Fields must be an array'
      };
    }

    if (fillFormArgs.fields.length === 0) {
      return {
        success: false,
        error: 'At least one field is required'
      };
    }

    // Validate each field
    for (let i = 0; i < fillFormArgs.fields.length; i++) {
      const field = fillFormArgs.fields[i];
      if (!field.selector || typeof field.selector !== 'string') {
        return {
          success: false,
          error: `Field ${i}: selector is required and must be a string`
        };
      }
      if (field.value === undefined || field.value === null || typeof field.value !== 'string') {
        return {
          success: false,
          error: `Field ${i}: value is required and must be a string`
        };
      }
    }

    try {
      // Enable DOM domain first
      await client.send('DOM.enable');
      await client.send('Runtime.enable');

      const timeout = fillFormArgs.timeout || 5000;
      const waitForElements = fillFormArgs.waitForElements !== false;
      const clearFirst = fillFormArgs.clearFirst !== false;
      const continueOnError = fillFormArgs.continueOnError !== false;

      const results: FieldResult[] = [];
      let successCount = 0;
      let errorCount = 0;

      // Process each field
      for (const field of fillFormArgs.fields) {
        try {
          // Use the FillHandler to fill individual field
          const fillResult = await this.fillHandler.execute(client, {
            selector: field.selector,
            text: field.value,
            waitForElement: waitForElements,
            timeout: timeout,
            clearFirst: clearFirst
          });

          const fieldResult: FieldResult = {
            selector: field.selector,
            value: field.value,
            success: fillResult.success,
            data: fillResult.data
          };

          if (fillResult.success) {
            successCount++;
          } else {
            errorCount++;
            fieldResult.error = fillResult.error;
            
            // If not continuing on error, stop here
            if (!continueOnError) {
              results.push(fieldResult);
              return {
                success: false,
                error: `Failed to fill field "${field.selector}": ${fillResult.error}`,
                data: {
                  results: results,
                  summary: {
                    total: fillFormArgs.fields.length,
                    successful: successCount,
                    failed: errorCount,
                    processed: results.length
                  }
                }
              };
            }
          }

          results.push(fieldResult);

        } catch (error) {
          errorCount++;
          const fieldResult: FieldResult = {
            selector: field.selector,
            value: field.value,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          };

          results.push(fieldResult);

          // If not continuing on error, stop here
          if (!continueOnError) {
            return {
              success: false,
              error: `Failed to fill field "${field.selector}": ${fieldResult.error}`,
              data: {
                results: results,
                summary: {
                  total: fillFormArgs.fields.length,
                  successful: successCount,
                  failed: errorCount,
                  processed: results.length
                }
              }
            };
          }
        }
      }

      // Determine overall success
      const overallSuccess = errorCount === 0;

      return {
        success: overallSuccess,
        error: overallSuccess ? undefined : `${errorCount} out of ${fillFormArgs.fields.length} fields failed to fill`,
        data: {
          results: results,
          summary: {
            total: fillFormArgs.fields.length,
            successful: successCount,
            failed: errorCount,
            processed: results.length
          }
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
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

    const fillFormArgs = args as FillFormArgs;

    // Fields array is required
    if (!fillFormArgs.fields || !Array.isArray(fillFormArgs.fields)) {
      return false;
    }

    if (fillFormArgs.fields.length === 0) {
      return false;
    }

    // Validate each field
    for (const field of fillFormArgs.fields) {
      if (typeof field !== 'object' || field === null) {
        return false;
      }

      // Selector is required and must be a string
      if (!field.selector || typeof field.selector !== 'string') {
        return false;
      }

      // Value is required and must be a string
      if (field.value === undefined || field.value === null || typeof field.value !== 'string') {
        return false;
      }
    }

    // Optional parameters type validation
    if (fillFormArgs.waitForElements !== undefined && typeof fillFormArgs.waitForElements !== 'boolean') {
      return false;
    }

    if (fillFormArgs.timeout !== undefined && typeof fillFormArgs.timeout !== 'number') {
      return false;
    }

    if (fillFormArgs.clearFirst !== undefined && typeof fillFormArgs.clearFirst !== 'boolean') {
      return false;
    }

    if (fillFormArgs.continueOnError !== undefined && typeof fillFormArgs.continueOnError !== 'boolean') {
      return false;
    }

    return true;
  }

  /**
   * Get command help text
   */
  getHelp(): string {
    return `
fill_form - Fill multiple form fields in batch

Usage:
  fill_form --fields '[{"selector":"#username","value":"john"},{"selector":"#email","value":"john@example.com"}]'
  fill_form --fields-file form-data.json
  fill_form --fields '[{"selector":"#name","value":"John Doe"}]' --timeout 10000

Arguments:
  --fields <json>         JSON array of field objects with selector and value
  --fields-file <file>    JSON file containing array of field objects

Options:
  --wait-for-elements     Wait for elements to be available (default: true)
  --no-wait              Don't wait for elements
  --timeout <ms>         Timeout for waiting for elements (default: 5000ms)
  --clear-first          Clear fields before filling (default: true)
  --no-clear             Don't clear fields before filling
  --continue-on-error    Continue filling other fields if one fails (default: true)
  --stop-on-error        Stop filling if any field fails

Field Object Format:
  {
    "selector": "CSS selector for the form field",
    "value": "Text value to fill into the field"
  }

Examples:
  # Fill login form
  fill_form --fields '[
    {"selector":"#username","value":"john@example.com"},
    {"selector":"#password","value":"secret123"}
  ]'

  # Fill registration form from file
  echo '[
    {"selector":"#firstName","value":"John"},
    {"selector":"#lastName","value":"Doe"},
    {"selector":"#email","value":"john.doe@example.com"},
    {"selector":"#country","value":"United States"}
  ]' > form-data.json
  fill_form --fields-file form-data.json

  # Fill form with custom options
  fill_form --fields '[
    {"selector":"#notes","value":"Additional information"}
  ]' --no-clear --timeout 10000 --stop-on-error

  # Fill select dropdowns
  fill_form --fields '[
    {"selector":"#country","value":"US"},
    {"selector":"#state","value":"California"},
    {"selector":"#city","value":"San Francisco"}
  ]'

Note:
  - Uses the same filling logic as the 'fill' command for each field
  - Works with input, textarea, and select elements
  - For select elements, matches by option value first, then by text content
  - Automatically triggers 'input' and 'change' events for each field
  - Returns detailed results for each field including success/failure status
  - By default continues filling other fields even if one fails
`;
  }
}
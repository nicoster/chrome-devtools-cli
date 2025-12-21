import { ICommandHandler } from '../interfaces/CommandHandler';
import { CDPClient, CommandResult } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Arguments for upload_file command
 */
export interface UploadFileArgs {
  selector: string;         // CSS selector for the file input element
  filePath: string;         // Path to the file to upload
  waitForElement?: boolean; // Wait for element to be available (default: true)
  timeout?: number;         // Timeout for waiting for element (default: 5000ms)
}

/**
 * Handler for upload_file command
 * Uploads files to file input elements using CDP DOM.setFileInputFiles
 */
export class UploadFileHandler implements ICommandHandler {
  readonly name = 'upload_file';

  /**
   * Execute upload_file command
   */
  async execute(client: CDPClient, args: unknown): Promise<CommandResult> {
    const uploadArgs = args as UploadFileArgs;

    // Validate arguments
    if (!uploadArgs.selector) {
      return {
        success: false,
        error: 'CSS selector is required for upload_file command'
      };
    }

    if (typeof uploadArgs.selector !== 'string') {
      return {
        success: false,
        error: 'CSS selector must be a string'
      };
    }

    if (!uploadArgs.filePath) {
      return {
        success: false,
        error: 'File path is required for upload_file command'
      };
    }

    if (typeof uploadArgs.filePath !== 'string') {
      return {
        success: false,
        error: 'File path must be a string'
      };
    }

    // Check if file exists
    const absoluteFilePath = path.resolve(uploadArgs.filePath);
    if (!fs.existsSync(absoluteFilePath)) {
      return {
        success: false,
        error: `File not found: ${absoluteFilePath}`
      };
    }

    // Check if it's a file (not a directory)
    const stats = fs.statSync(absoluteFilePath);
    if (!stats.isFile()) {
      return {
        success: false,
        error: `Path is not a file: ${absoluteFilePath}`
      };
    }

    try {
      await client.send('DOM.enable');
      await client.send('Runtime.enable');

      const timeout = uploadArgs.timeout || 5000;
      const waitForElement = uploadArgs.waitForElement !== false;

      if (waitForElement) {
        // Wait for element to be available
        const elementFound = await this.waitForElement(client, uploadArgs.selector, timeout);
        if (!elementFound) {
          return {
            success: false,
            error: `Element with selector "${uploadArgs.selector}" not found within ${timeout}ms`
          };
        }
      }

      // Verify the element is a file input
      const isFileInput = await this.verifyFileInput(client, uploadArgs.selector);
      if (!isFileInput.success) {
        return isFileInput;
      }

      // Try CDP approach first (preferred for file uploads)
      const cdpResult = await this.uploadViaCDP(client, uploadArgs.selector, absoluteFilePath);
      if (cdpResult.success) {
        return cdpResult;
      }

      // If CDP fails, return the error (file upload typically requires CDP)
      return {
        success: false,
        error: `File upload failed: ${cdpResult.error}. File uploads require CDP support.`
      };

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
   * Verify that the element is a file input
   */
  private async verifyFileInput(client: CDPClient, selector: string): Promise<CommandResult> {
    try {
      const escapedSelector = selector.replace(/'/g, "\\'").replace(/"/g, '\\"');
      
      const expression = `
        (function() {
          const element = document.querySelector('${escapedSelector}');
          if (!element) {
            throw new Error('Element with selector "${escapedSelector}" not found');
          }
          
          if (element.tagName.toLowerCase() !== 'input') {
            throw new Error('Element is not an input element');
          }
          
          if (element.type.toLowerCase() !== 'file') {
            throw new Error('Element is not a file input (type="file")');
          }
          
          return {
            success: true,
            tagName: element.tagName,
            type: element.type,
            id: element.id,
            className: element.className,
            multiple: element.multiple,
            accept: element.accept
          };
        })()
      `;

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

      return {
        success: true,
        data: response.result.value
      };

    } catch (error) {
      return {
        success: false,
        error: `File input verification failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Upload file using CDP DOM.setFileInputFiles
   */
  private async uploadViaCDP(client: CDPClient, selector: string, filePath: string): Promise<CommandResult> {
    try {
      // Get the document root
      const documentResponse = await client.send('DOM.getDocument') as { root: { nodeId: number } };
      const rootNodeId = documentResponse.root.nodeId;

      // Query for the file input element
      const queryResponse = await client.send('DOM.querySelector', {
        nodeId: rootNodeId,
        selector: selector
      }) as { nodeId: number };

      if (!queryResponse.nodeId || queryResponse.nodeId === 0) {
        return {
          success: false,
          error: `File input element with selector "${selector}" not found`
        };
      }

      // Set the files on the input element
      await client.send('DOM.setFileInputFiles', {
        nodeId: queryResponse.nodeId,
        files: [filePath]
      });

      // Trigger change event to notify any listeners
      const changeEventResult = await this.triggerChangeEvent(client, selector, filePath);

      return {
        success: true,
        data: {
          selector: selector,
          filePath: filePath,
          fileName: path.basename(filePath),
          fileSize: fs.statSync(filePath).size,
          method: 'CDP',
          changeEvent: changeEventResult
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `CDP file upload failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Trigger change event after file upload
   */
  private async triggerChangeEvent(client: CDPClient, selector: string, filePath: string): Promise<unknown> {
    try {
      const escapedSelector = selector.replace(/'/g, "\\'").replace(/"/g, '\\"');
      const fileName = path.basename(filePath);
      
      const expression = `
        (function() {
          const element = document.querySelector('${escapedSelector}');
          if (element) {
            // Trigger change event
            const changeEvent = new Event('change', { bubbles: true });
            element.dispatchEvent(changeEvent);
            
            // Also trigger input event
            const inputEvent = new Event('input', { bubbles: true });
            element.dispatchEvent(inputEvent);
            
            return {
              success: true,
              fileName: '${fileName}',
              filesLength: element.files ? element.files.length : 0
            };
          }
          return { success: false, error: 'Element not found' };
        })()
      `;

      const response = await client.send('Runtime.evaluate', {
        expression: expression,
        returnByValue: true,
        userGesture: true
      }) as { result: { value: unknown } };

      return response.result.value;

    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Validate command arguments
   */
  validateArgs(args: unknown): boolean {
    if (typeof args !== 'object' || args === null) {
      return false;
    }

    const uploadArgs = args as UploadFileArgs;

    if (!uploadArgs.selector || typeof uploadArgs.selector !== 'string') {
      return false;
    }

    if (!uploadArgs.filePath || typeof uploadArgs.filePath !== 'string') {
      return false;
    }

    if (uploadArgs.waitForElement !== undefined && typeof uploadArgs.waitForElement !== 'boolean') {
      return false;
    }

    if (uploadArgs.timeout !== undefined && typeof uploadArgs.timeout !== 'number') {
      return false;
    }

    return true;
  }

  /**
   * Get command help text
   */
  getHelp(): string {
    return `
upload_file - Upload a file to a file input element

Usage:
  upload_file <selector> <filePath>
  upload_file "#file-input" "./document.pdf"
  upload_file "input[type='file']" "/path/to/image.jpg" --timeout 10000

Arguments:
  <selector>              CSS selector for the file input element
  <filePath>              Path to the file to upload (relative or absolute)

Options:
  --wait-for-element      Wait for element to be available (default: true)
  --no-wait              Don't wait for element (same as --wait-for-element=false)
  --timeout <ms>         Timeout for waiting for element (default: 5000ms)

Examples:
  # Upload a document
  upload_file "#document-upload" "./contract.pdf"

  # Upload an image
  upload_file "input[name='avatar']" "/home/user/photo.jpg"

  # Upload with custom timeout
  upload_file ".file-input" "./large-file.zip" --timeout 15000

  # Upload without waiting (fail immediately if not found)
  upload_file "#upload" "./file.txt" --no-wait

Requirements:
  - Target element must be an <input type="file"> element
  - File must exist and be readable
  - File path can be relative (to current directory) or absolute

Note:
  - Uses CDP DOM.setFileInputFiles for reliable file upload
  - Automatically triggers 'change' and 'input' events after upload
  - Verifies that target element is a valid file input before upload
  - Supports both single and multiple file inputs
  - File path is resolved to absolute path before upload
`;
  }
}
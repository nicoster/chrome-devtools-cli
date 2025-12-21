import { ICommandHandler } from '../interfaces/CommandHandler';
import { CDPClient, CommandResult } from '../types';

/**
 * Arguments for handle_dialog command
 */
export interface HandleDialogArgs {
  action: 'accept' | 'dismiss';  // Action to take on the dialog
  text?: string;                 // Text to enter for prompt dialogs
  waitForDialog?: boolean;       // Wait for dialog to appear (default: true)
  timeout?: number;              // Timeout for waiting for dialog (default: 5000ms)
}

/**
 * Dialog information from CDP
 */
interface DialogInfo {
  type: 'alert' | 'confirm' | 'prompt' | 'beforeunload';
  message: string;
  defaultPrompt?: string;
}

/**
 * Handler for handle_dialog command
 * Handles browser dialogs (alert, confirm, prompt) using CDP Page.javascriptDialogOpening event
 */
export class HandleDialogHandler implements ICommandHandler {
  readonly name = 'handle_dialog';
  private pendingDialog: DialogInfo | null = null;
  private dialogPromise: Promise<DialogInfo> | null = null;
  private dialogResolve: ((dialog: DialogInfo) => void) | null = null;

  /**
   * Execute handle_dialog command
   */
  async execute(client: CDPClient, args: unknown): Promise<CommandResult> {
    const dialogArgs = args as HandleDialogArgs;

    // Validate arguments
    if (!dialogArgs.action) {
      return {
        success: false,
        error: 'Action is required for handle_dialog command (accept or dismiss)'
      };
    }

    if (!['accept', 'dismiss'].includes(dialogArgs.action)) {
      return {
        success: false,
        error: 'Action must be either "accept" or "dismiss"'
      };
    }

    try {
      await client.send('Page.enable');
      await client.send('Runtime.enable');

      const timeout = dialogArgs.timeout || 5000;
      const waitForDialog = dialogArgs.waitForDialog !== false;

      // Set up dialog event listener
      this.setupDialogListener(client);

      let dialog: DialogInfo;

      if (waitForDialog) {
        // Wait for dialog to appear
        dialog = await this.waitForDialog(timeout);
      } else {
        // Check if there's already a pending dialog
        if (!this.pendingDialog) {
          return {
            success: false,
            error: 'No dialog is currently open'
          };
        }
        dialog = this.pendingDialog;
      }

      // Handle the dialog
      const result = await this.handleDialog(client, dialog, dialogArgs.action, dialogArgs.text);
      
      // Clear pending dialog
      this.pendingDialog = null;
      
      return result;

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Set up dialog event listener
   */
  private setupDialogListener(client: CDPClient): void {
    // Remove existing listener if any
    client.off('Page.javascriptDialogOpening', this.onDialogOpening.bind(this));
    
    // Add new listener
    client.on('Page.javascriptDialogOpening', this.onDialogOpening.bind(this));
  }

  /**
   * Handle dialog opening event
   */
  private onDialogOpening(params: unknown): void {
    const dialogParams = params as {
      url: string;
      message: string;
      type: 'alert' | 'confirm' | 'prompt' | 'beforeunload';
      hasBrowserHandler: boolean;
      defaultPrompt?: string;
    };

    const dialog: DialogInfo = {
      type: dialogParams.type,
      message: dialogParams.message,
      defaultPrompt: dialogParams.defaultPrompt
    };

    this.pendingDialog = dialog;

    // Resolve waiting promise if any
    if (this.dialogResolve) {
      this.dialogResolve(dialog);
      this.dialogResolve = null;
      this.dialogPromise = null;
    }
  }

  /**
   * Wait for dialog to appear
   */
  private async waitForDialog(timeout: number): Promise<DialogInfo> {
    // If there's already a pending dialog, return it
    if (this.pendingDialog) {
      return this.pendingDialog;
    }

    // Create a promise to wait for dialog
    this.dialogPromise = new Promise<DialogInfo>((resolve, reject) => {
      this.dialogResolve = resolve;

      // Set timeout
      setTimeout(() => {
        if (this.dialogResolve === resolve) {
          this.dialogResolve = null;
          this.dialogPromise = null;
          reject(new Error(`Timeout after ${timeout}ms waiting for dialog to appear`));
        }
      }, timeout);
    });

    return this.dialogPromise;
  }

  /**
   * Handle the dialog with specified action
   */
  private async handleDialog(
    client: CDPClient, 
    dialog: DialogInfo, 
    action: 'accept' | 'dismiss', 
    text?: string
  ): Promise<CommandResult> {
    try {
      const accept = action === 'accept';
      
      // For prompt dialogs, use provided text or default
      let promptText: string | undefined;
      if (dialog.type === 'prompt' && accept) {
        promptText = text !== undefined ? text : dialog.defaultPrompt || '';
      }

      // Handle the dialog using CDP
      await client.send('Page.handleJavaScriptDialog', {
        accept: accept,
        promptText: promptText
      });

      return {
        success: true,
        data: {
          action: action,
          dialog: {
            type: dialog.type,
            message: dialog.message,
            defaultPrompt: dialog.defaultPrompt
          },
          promptText: promptText
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to handle dialog: ${error instanceof Error ? error.message : String(error)}`
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

    const dialogArgs = args as HandleDialogArgs;

    if (!dialogArgs.action || !['accept', 'dismiss'].includes(dialogArgs.action)) {
      return false;
    }

    if (dialogArgs.text !== undefined && typeof dialogArgs.text !== 'string') {
      return false;
    }

    if (dialogArgs.waitForDialog !== undefined && typeof dialogArgs.waitForDialog !== 'boolean') {
      return false;
    }

    if (dialogArgs.timeout !== undefined && typeof dialogArgs.timeout !== 'number') {
      return false;
    }

    return true;
  }

  /**
   * Get command help text
   */
  getHelp(): string {
    return `
handle_dialog - Handle browser dialogs (alert, confirm, prompt)

Usage:
  handle_dialog <action>
  handle_dialog accept
  handle_dialog dismiss
  handle_dialog accept --text "user input"
  handle_dialog accept --timeout 10000

Arguments:
  <action>                Action to take: "accept" or "dismiss"

Options:
  --text <string>        Text to enter for prompt dialogs (when accepting)
  --wait-for-dialog      Wait for dialog to appear (default: true)
  --no-wait             Don't wait for dialog (handle immediately if present)
  --timeout <ms>        Timeout for waiting for dialog (default: 5000ms)

Examples:
  # Accept an alert dialog
  handle_dialog accept

  # Dismiss a confirm dialog
  handle_dialog dismiss

  # Accept a prompt dialog with text input
  handle_dialog accept --text "John Doe"

  # Accept a prompt dialog with empty text
  handle_dialog accept --text ""

  # Handle dialog with custom timeout
  handle_dialog accept --timeout 10000

  # Handle dialog without waiting (if already present)
  handle_dialog accept --no-wait

Dialog Types:
  alert                  Simple message dialog (only "OK" button)
  confirm                Yes/No dialog ("OK" and "Cancel" buttons)
  prompt                 Input dialog with text field
  beforeunload           Page unload confirmation dialog

Actions:
  accept                 Click "OK" or "Yes" button
  dismiss                Click "Cancel" or "No" button

Note:
  - Uses CDP Page.javascriptDialogOpening event to detect dialogs
  - Automatically waits for dialogs to appear unless --no-wait is specified
  - For prompt dialogs, use --text to provide input (defaults to empty string)
  - Dialog must be triggered by JavaScript (alert(), confirm(), prompt())
  - Command will timeout if no dialog appears within the specified time
`;
  }
}
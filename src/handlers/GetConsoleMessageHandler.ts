import { ICommandHandler } from '../interfaces/CommandHandler';
import { CDPClient, CommandResult } from '../types';
import { ConsoleMonitor, ConsoleMessageFilter } from '../monitors/ConsoleMonitor';

/**
 * Handler for getting the latest console message
 */
export class GetConsoleMessageHandler implements ICommandHandler {
  readonly name = 'get_console_message';
  private consoleMonitor: ConsoleMonitor | null = null;

  async execute(client: CDPClient, args: unknown): Promise<CommandResult> {
    try {
      const params = args as {
        type?: 'log' | 'info' | 'warn' | 'error' | 'debug';
        textPattern?: string;
        startMonitoring?: boolean;
      };

      // Initialize console monitor if not already done
      if (!this.consoleMonitor) {
        this.consoleMonitor = new ConsoleMonitor(client);
      }

      // Start monitoring if requested or if not already monitoring
      if (params.startMonitoring || !this.consoleMonitor.isActive()) {
        await this.consoleMonitor.startMonitoring();
      }

      // Build filter
      const filter: ConsoleMessageFilter = {};
      if (params.type) {
        filter.types = [params.type];
      }
      if (params.textPattern) {
        filter.textPattern = params.textPattern;
      }

      // Get the latest message
      const latestMessage = this.consoleMonitor.getLatestMessage(filter);

      if (!latestMessage) {
        return {
          success: true,
          data: null
        };
      }

      return {
        success: true,
        data: {
          type: latestMessage.type,
          text: latestMessage.text,
          args: latestMessage.args,
          timestamp: latestMessage.timestamp,
          stackTrace: latestMessage.stackTrace
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  validateArgs(args: unknown): boolean {
    if (!args || typeof args !== 'object') {
      return true; // No args is valid
    }

    const params = args as Record<string, unknown>;
    
    // Validate type if provided
    if (params.type !== undefined) {
      if (typeof params.type !== 'string') {
        return false;
      }
      const validTypes = ['log', 'info', 'warn', 'error', 'debug'];
      if (!validTypes.includes(params.type)) {
        return false;
      }
    }

    // Validate textPattern if provided
    if (params.textPattern !== undefined && typeof params.textPattern !== 'string') {
      return false;
    }

    // Validate startMonitoring if provided
    if (params.startMonitoring !== undefined && typeof params.startMonitoring !== 'boolean') {
      return false;
    }

    return true;
  }

  getHelp(): string {
    return `get_console_message - Get the latest console message
    
Usage:
  get_console_message [options]
  
Options:
  --type <type>           Filter by message type (log, info, warn, error, debug)
  --textPattern <pattern> Filter by text pattern (regex)
  --startMonitoring       Start monitoring if not already active
  
Examples:
  get_console_message
  get_console_message --type error
  get_console_message --textPattern "API"
  get_console_message --startMonitoring`;
  }
}
import { ICommandHandler } from '../interfaces/CommandHandler';
import { CDPClient, CommandResult } from '../types';
import { ConsoleMonitor, ConsoleMessageFilter } from '../monitors/ConsoleMonitor';

/**
 * Handler for listing all console messages
 */
export class ListConsoleMessagesHandler implements ICommandHandler {
  readonly name = 'list_console_messages';
  private consoleMonitor: ConsoleMonitor | null = null;

  async execute(client: CDPClient, args: unknown): Promise<CommandResult> {
    try {
      const params = args as {
        types?: Array<'log' | 'info' | 'warn' | 'error' | 'debug'>;
        textPattern?: string;
        maxMessages?: number;
        startTime?: number;
        endTime?: number;
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
      if (params.types && params.types.length > 0) {
        filter.types = params.types;
      }
      if (params.textPattern) {
        filter.textPattern = params.textPattern;
      }
      if (params.maxMessages && params.maxMessages > 0) {
        filter.maxMessages = params.maxMessages;
      }
      if (params.startTime) {
        filter.startTime = params.startTime;
      }
      if (params.endTime) {
        filter.endTime = params.endTime;
      }

      // Get filtered messages
      const messages = this.consoleMonitor.getMessages(filter);

      return {
        success: true,
        data: {
          messages: messages.map(msg => ({
            type: msg.type,
            text: msg.text,
            args: msg.args,
            timestamp: msg.timestamp,
            stackTrace: msg.stackTrace
          })),
          totalCount: messages.length,
          isMonitoring: this.consoleMonitor.isActive()
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
    
    // Validate types if provided
    if (params.types !== undefined) {
      if (!Array.isArray(params.types)) {
        return false;
      }
      const validTypes = ['log', 'info', 'warn', 'error', 'debug'];
      for (const type of params.types) {
        if (typeof type !== 'string' || !validTypes.includes(type)) {
          return false;
        }
      }
    }

    // Validate textPattern if provided
    if (params.textPattern !== undefined && typeof params.textPattern !== 'string') {
      return false;
    }

    // Validate maxMessages if provided
    if (params.maxMessages !== undefined) {
      if (typeof params.maxMessages !== 'number' || params.maxMessages <= 0) {
        return false;
      }
    }

    // Validate timestamps if provided
    if (params.startTime !== undefined && typeof params.startTime !== 'number') {
      return false;
    }
    if (params.endTime !== undefined && typeof params.endTime !== 'number') {
      return false;
    }

    // Validate startMonitoring if provided
    if (params.startMonitoring !== undefined && typeof params.startMonitoring !== 'boolean') {
      return false;
    }

    return true;
  }

  getHelp(): string {
    return `list_console_messages - List all captured console messages
    
Usage:
  list_console_messages [options]
  
Options:
  --types <types>         Filter by message types (comma-separated: log,info,warn,error,debug)
  --textPattern <pattern> Filter by text pattern (regex)
  --maxMessages <count>   Maximum number of messages to return
  --startTime <timestamp> Filter messages after this timestamp
  --endTime <timestamp>   Filter messages before this timestamp
  --startMonitoring       Start monitoring if not already active
  
Examples:
  list_console_messages
  list_console_messages --types error,warn
  list_console_messages --textPattern "API" --maxMessages 10
  list_console_messages --startTime 1640995200000`;
  }
}
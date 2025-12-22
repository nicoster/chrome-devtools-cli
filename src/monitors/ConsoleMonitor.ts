import { CDPClient, ConsoleMessage, StackFrame } from '../types';

/**
 * Console message filter options
 */
export interface ConsoleMessageFilter {
  types?: Array<'log' | 'info' | 'warn' | 'error' | 'debug'>;
  textPattern?: string;
  maxMessages?: number;
  startTime?: number;
  endTime?: number;
}

/**
 * Console monitoring functionality
 */
export class ConsoleMonitor {
  private client: CDPClient;
  private messages: ConsoleMessage[] = [];
  private isMonitoring = false;
  private messageHandler: ((params: unknown) => void) | null = null;

  constructor(client: CDPClient) {
    this.client = client;
  }

  /**
   * Start monitoring console messages
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    // Enable Runtime domain to receive console events
    await this.client.send('Runtime.enable');
    
    // Also enable Log domain to capture more message types
    try {
      await this.client.send('Log.enable');
    } catch (error) {
      // Log domain might not be available in all contexts, continue without it
      console.warn('Log domain not available:', error);
    }

    // Set up event listener for console API calls
    this.messageHandler = (params: unknown) => {
      this.handleConsoleMessage(params);
    };

    this.client.on('Runtime.consoleAPICalled', this.messageHandler);
    
    // Also listen for Log domain events if available
    this.client.on('Log.entryAdded', (params: unknown) => {
      this.handleLogEntry(params);
    });
    
    this.isMonitoring = true;
  }

  /**
   * Stop monitoring console messages
   */
  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring || !this.messageHandler) {
      return;
    }

    this.client.off('Runtime.consoleAPICalled', this.messageHandler);
    this.messageHandler = null;
    this.isMonitoring = false;
  }

  /**
   * Get all captured console messages
   */
  getMessages(filter?: ConsoleMessageFilter): ConsoleMessage[] {
    let filteredMessages = [...this.messages];

    if (filter) {
      // Filter by message types
      if (filter.types && filter.types.length > 0) {
        filteredMessages = filteredMessages.filter(msg => 
          filter.types!.includes(msg.type)
        );
      }

      // Filter by text pattern
      if (filter.textPattern) {
        const pattern = new RegExp(filter.textPattern, 'i');
        filteredMessages = filteredMessages.filter(msg => 
          pattern.test(msg.text)
        );
      }

      // Filter by time range
      if (filter.startTime) {
        filteredMessages = filteredMessages.filter(msg => 
          msg.timestamp >= filter.startTime!
        );
      }

      if (filter.endTime) {
        filteredMessages = filteredMessages.filter(msg => 
          msg.timestamp <= filter.endTime!
        );
      }

      // Limit number of messages
      if (filter.maxMessages && filter.maxMessages > 0) {
        filteredMessages = filteredMessages.slice(-filter.maxMessages);
      }
    }

    return filteredMessages;
  }

  /**
   * Get the most recent console message
   */
  getLatestMessage(filter?: ConsoleMessageFilter): ConsoleMessage | null {
    const messages = this.getMessages(filter);
    return messages.length > 0 ? messages[messages.length - 1] : null;
  }

  /**
   * Clear all stored console messages
   */
  clearMessages(): void {
    this.messages = [];
  }

  /**
   * Get the number of stored messages
   */
  getMessageCount(filter?: ConsoleMessageFilter): number {
    return this.getMessages(filter).length;
  }

  /**
   * Check if monitoring is active
   */
  isActive(): boolean {
    return this.isMonitoring;
  }

  /**
   * Handle incoming console message events from CDP
   */
  private handleConsoleMessage(params: unknown): void {
    try {
      const consoleParams = params as {
        type: string;
        args: Array<{
          type: string;
          value?: unknown;
          description?: string;
        }>;
        executionContextId: number;
        timestamp: number;
        stackTrace?: {
          callFrames: Array<{
            functionName: string;
            url: string;
            lineNumber: number;
            columnNumber: number;
          }>;
        };
      };

      // Convert CDP console message to our format
      const message: ConsoleMessage = {
        type: this.mapConsoleType(consoleParams.type),
        text: this.formatConsoleArgs(consoleParams.args),
        args: consoleParams.args.map(arg => arg.value || arg.description || ''),
        timestamp: consoleParams.timestamp,
        stackTrace: consoleParams.stackTrace ? 
          this.convertStackTrace(consoleParams.stackTrace.callFrames) : undefined
      };

      this.messages.push(message);

      // Limit stored messages to prevent memory issues (keep last 1000)
      if (this.messages.length > 1000) {
        this.messages = this.messages.slice(-1000);
      }
    } catch (error) {
      console.error('Error handling console message:', error);
    }
  }

  /**
   * Handle incoming log entries from Log domain
   */
  private handleLogEntry(params: unknown): void {
    try {
      const logParams = params as {
        entry: {
          source: string;
          level: string;
          text: string;
          timestamp: number;
          url?: string;
          lineNumber?: number;
        };
      };

      const entry = logParams.entry;
      
      // Convert Log entry to our console message format
      const message: ConsoleMessage = {
        type: this.mapLogLevel(entry.level),
        text: entry.text,
        args: [entry.text],
        timestamp: entry.timestamp,
        stackTrace: entry.url && entry.lineNumber ? [{
          functionName: '<unknown>',
          url: entry.url,
          lineNumber: entry.lineNumber,
          columnNumber: 0
        }] : undefined
      };

      this.messages.push(message);

      // Limit stored messages to prevent memory issues (keep last 1000)
      if (this.messages.length > 1000) {
        this.messages = this.messages.slice(-1000);
      }
    } catch (error) {
      console.error('Error handling log entry:', error);
    }
  }

  /**
   * Map CDP console type to our console message type
   */
  private mapConsoleType(cdpType: string): 'log' | 'info' | 'warn' | 'error' | 'debug' {
    switch (cdpType) {
      case 'log':
        return 'log';
      case 'info':
        return 'info';
      case 'warning':
        return 'warn';
      case 'error':
        return 'error';
      case 'debug':
        return 'debug';
      default:
        return 'log';
    }
  }

  /**
   * Map Log domain level to our console message type
   */
  private mapLogLevel(logLevel: string): 'log' | 'info' | 'warn' | 'error' | 'debug' {
    switch (logLevel.toLowerCase()) {
      case 'verbose':
      case 'info':
        return 'info';
      case 'warning':
        return 'warn';
      case 'error':
        return 'error';
      default:
        return 'log';
    }
  }

  /**
   * Format console arguments into a readable string
   */
  private formatConsoleArgs(args: Array<{
    type: string;
    value?: unknown;
    description?: string;
  }>): string {
    return args.map(arg => {
      if (arg.value !== undefined) {
        if (typeof arg.value === 'string') {
          return arg.value;
        }
        return JSON.stringify(arg.value);
      }
      return arg.description || '';
    }).join(' ');
  }

  /**
   * Convert CDP stack trace to our format
   */
  private convertStackTrace(callFrames: Array<{
    functionName: string;
    url: string;
    lineNumber: number;
    columnNumber: number;
  }>): StackFrame[] {
    return callFrames.map(frame => ({
      functionName: frame.functionName || '<anonymous>',
      url: frame.url,
      lineNumber: frame.lineNumber,
      columnNumber: frame.columnNumber
    }));
  }
}
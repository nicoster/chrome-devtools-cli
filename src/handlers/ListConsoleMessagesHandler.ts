import { ICommandHandler } from '../interfaces/CommandHandler';
import { CDPClient, CommandResult } from '../types';
import { ConsoleMonitor, ConsoleMessageFilter } from '../monitors/ConsoleMonitor';
import { ProxyClient } from '../client/ProxyClient';
import { ConsoleMessageFilter as ProxyConsoleMessageFilter } from '../proxy/types/ProxyTypes';

/**
 * Handler for listing console messages
 */
export class ListConsoleMessagesHandler implements ICommandHandler {
  readonly name = 'console';
  private consoleMonitor: ConsoleMonitor | null = null;
  private proxyClient: ProxyClient | null = null;

  async execute(client: CDPClient, args: unknown): Promise<CommandResult> {
    try {
      const params = args as {
        types?: Array<'log' | 'info' | 'warn' | 'error' | 'debug'>;
        textPattern?: string;
        maxMessages?: number;
        startTime?: number;
        endTime?: number;
        startMonitoring?: boolean;
        latest?: boolean;
        host?: string;
        port?: number;
        targetId?: string;
      };

      // Try to use proxy first
      const proxyResult = await this.tryProxyExecution(params);
      if (proxyResult) {
        return proxyResult;
      }

      // Fallback to direct CDP connection
      return await this.executeDirectCDP(client, params);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Try to execute using proxy server
   */
  private async tryProxyExecution(params: any): Promise<CommandResult | null> {
    try {
      // Initialize proxy client if not already done
      if (!this.proxyClient) {
        this.proxyClient = new ProxyClient();
      }

      // Proxy should already be ready thanks to ProxyManager in CLIApplication
      // Just check if it's available and try to use it
      const isProxyAvailable = await this.proxyClient.isProxyAvailable();
      
      if (!isProxyAvailable) {
        console.warn('⚠️  Proxy server unavailable. Falling back to direct CDP connection.');
        console.warn('⚠️  Note: Direct connection only captures NEW console messages, not historical data.');
        return null; // Fallback to direct CDP
      }

      // Connect through proxy if not already connected
      if (!this.proxyClient.getConnectionId()) {
        const host = params.host || 'localhost';
        const port = params.port || 9222;
        await this.proxyClient.connect(host, port, params.targetId);
      }

      // Build filter for proxy
      const filter: ProxyConsoleMessageFilter = {};
      if (params.types && params.types.length > 0) {
        filter.types = params.types;
      }
      if (params.textPattern) {
        filter.textPattern = params.textPattern;
      }
      if (params.latest) {
        filter.maxMessages = 1;
      } else if (params.maxMessages && params.maxMessages > 0) {
        filter.maxMessages = params.maxMessages;
      }
      if (params.startTime) {
        filter.startTime = params.startTime;
      }
      if (params.endTime) {
        filter.endTime = params.endTime;
      }

      // Get messages from proxy
      const messages = await this.proxyClient.getConsoleMessages(filter);

      // If latest is requested, return single message object instead of array
      if (params.latest) {
        const latestMessage = messages.length > 0 ? messages[messages.length - 1] : null;
        if (!latestMessage) {
          return {
            success: true,
            data: null,
            dataSource: 'proxy',
            hasHistoricalData: true
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
          },
          dataSource: 'proxy',
          hasHistoricalData: true
        };
      }

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
          isMonitoring: true
        },
        dataSource: 'proxy',
        hasHistoricalData: true
      };
    } catch (error) {
      console.warn('⚠️  Proxy execution failed, falling back to direct CDP:', error instanceof Error ? error.message : error);
      console.warn('⚠️  Note: Direct connection only captures NEW console messages, not historical data.');
      return null;
    }
  }

  /**
   * Execute using direct CDP connection (fallback)
   */
  private async executeDirectCDP(client: CDPClient, params: any): Promise<CommandResult> {
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

    // If latest is requested, get single message
    if (params.latest) {
      const latestMessage = this.consoleMonitor.getLatestMessage(filter);
      if (!latestMessage) {
        return {
          success: true,
          data: null,
          dataSource: 'direct',
          hasHistoricalData: false
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
        },
        dataSource: 'direct',
        hasHistoricalData: false
      };
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
      },
      dataSource: 'direct',
      hasHistoricalData: false
    };
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

    // Validate latest if provided
    if (params.latest !== undefined && typeof params.latest !== 'boolean') {
      return false;
    }

    return true;
  }

  getHelp(): string {
    return `console - List console messages
    
Usage:
  console [options]
  
Options:
  --latest                Get only the latest console message
  --types <types>         Filter by message types (comma-separated: log,info,warn,error,debug)
  --textPattern <pattern> Filter by text pattern (regex)
  --maxMessages <count>   Maximum number of messages to return
  --startTime <timestamp> Filter messages after this timestamp
  --endTime <timestamp>   Filter messages before this timestamp
  --startMonitoring       Start monitoring if not already active
  
Examples:
  console
  console --latest
  console --types error,warn
  console --latest --type error
  console --textPattern "API" --maxMessages 10
  console --startTime 1640995200000

Note: This command now uses the proxy server when available, providing access to
historical console messages from connection establishment. When proxy is unavailable,
falls back to direct CDP connection (captures only new messages).`;
  }
}
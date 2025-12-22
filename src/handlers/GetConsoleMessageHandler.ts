import { ICommandHandler } from '../interfaces/CommandHandler';
import { CDPClient, CommandResult } from '../types';
import { ConsoleMonitor, ConsoleMessageFilter } from '../monitors/ConsoleMonitor';
import { ProxyClient } from '../client/ProxyClient';
import { ConsoleMessageFilter as ProxyConsoleMessageFilter } from '../proxy/types/ProxyTypes';

/**
 * Handler for getting the latest console message
 */
export class GetConsoleMessageHandler implements ICommandHandler {
  readonly name = 'get_console_message';
  private consoleMonitor: ConsoleMonitor | null = null;
  private proxyClient: ProxyClient | null = null;

  async execute(client: CDPClient, args: unknown): Promise<CommandResult> {
    try {
      const params = args as {
        type?: 'log' | 'info' | 'warn' | 'error' | 'debug';
        textPattern?: string;
        startMonitoring?: boolean;
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

      // Check if proxy is available
      const isProxyAvailable = await this.proxyClient.isProxyAvailable();
      if (!isProxyAvailable) {
        // Try to start proxy if needed
        const proxyStarted = await this.proxyClient.ensureProxyRunning();
        if (!proxyStarted) {
          console.warn('⚠️  Proxy server unavailable. Falling back to direct CDP connection.');
          console.warn('⚠️  Note: Direct connection only captures NEW console messages, not historical data.');
          return null; // Fallback to direct CDP
        }
      }

      // Connect through proxy if not already connected
      if (!this.proxyClient.getConnectionId()) {
        const host = params.host || 'localhost';
        const port = params.port || 9222;
        await this.proxyClient.connect(host, port, params.targetId);
      }

      // Build filter for proxy
      const filter: ProxyConsoleMessageFilter = {};
      if (params.type) {
        filter.types = [params.type];
      }
      if (params.textPattern) {
        filter.textPattern = params.textPattern;
      }
      // Get only the latest message
      filter.maxMessages = 1;

      // Get messages from proxy
      const messages = await this.proxyClient.getConsoleMessages(filter);
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
  get_console_message --startMonitoring

Note: This command now uses the proxy server when available, providing access to
historical console messages from connection establishment. When proxy is unavailable,
falls back to direct CDP connection (captures only new messages).`;
  }
}
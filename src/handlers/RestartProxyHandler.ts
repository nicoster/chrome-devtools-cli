import { ICommandHandler } from '../interfaces/CommandHandler';
import { CDPClient, CommandResult } from '../types';
import { ProxyManager } from '../proxy/ProxyManager';

/**
 * Handler for restarting the proxy server
 */
export class RestartProxyHandler implements ICommandHandler {
  readonly name = 'restart';

  async execute(_client: CDPClient, args: unknown): Promise<CommandResult> {
    try {
      const params = args as {
        force?: boolean;
      };

      const proxyManager = ProxyManager.getInstance();
      
      // Get current status
      const status = await proxyManager.getStatus();
      
      // If proxy is healthy and not forcing, inform user
      if (status.isHealthy && !params.force) {
        return {
          success: true,
          data: {
            message: 'Proxy server is already running and healthy',
            status: status
          }
        };
      }

      // Restart the proxy
      const success = await proxyManager.restart();

      if (success) {
        // Wait a moment for the server to fully start
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify the restart was successful
        const newStatus = await proxyManager.getStatus();
        
        return {
          success: true,
          data: {
            message: 'Proxy server restarted successfully',
            status: newStatus
          }
        };
      } else {
        return {
          success: false,
          error: 'Failed to restart proxy server. Check logs for details.'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred while restarting proxy'
      };
    }
  }

  validateArgs(args: unknown): boolean {
    if (typeof args !== 'object' || args === null) {
      return false;
    }

    const params = args as Record<string, unknown>;
    
    // Validate force option
    if ('force' in params && typeof params.force !== 'boolean') {
      return false;
    }

    return true;
  }

  getHelp(): string {
    return `
restart - Restart the proxy server process

Usage:
  chrome-cdp-cli restart
  chrome-cdp-cli restart --force

Description:
  Restarts the proxy server process. This will:
  - Stop the current proxy server process
  - Clear all stored console messages and network requests
  - Start a new proxy server process

When to use:
  Use this command when console or network command output becomes stale:
  - Console messages are not refreshing or showing old data
  - Network requests are not updating or displaying outdated information
  - Logs appear to be stuck or not reflecting current browser state
  Restarting the proxy will clear the message store and start fresh monitoring.

Options:
  --force              Force restart even if proxy is healthy

Examples:
  # Restart the proxy server
  chrome-cdp-cli restart

  # Force restart even if proxy is healthy
  chrome-cdp-cli restart --force

Note:
  - Restarting the proxy will clear all stored console messages and network requests
  - The proxy server must be restarted if logs are not refreshing properly
  - After restart, you may need to reconnect to Chrome DevTools
`;
  }
}


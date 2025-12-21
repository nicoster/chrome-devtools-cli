import { BrowserTarget } from '../types';
import { ICDPClient } from '../interfaces/CDPClient';
import { IConnectionManager } from '../interfaces/ConnectionManager';
import { Logger } from '../utils/logger';

/**
 * Connection Manager for discovering and managing Chrome DevTools connections
 * Implements target discovery, connection management, and auto-reconnection with exponential backoff
 */
export class ConnectionManager implements IConnectionManager {
  private activeConnections: ICDPClient[] = [];
  private logger: Logger;
  private readonly DEFAULT_RETRY_DELAY = 1000; // 1 second
  private readonly MAX_RETRY_DELAY = 30000; // 30 seconds
  private readonly RETRY_MULTIPLIER = 2;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
  }

  /**
   * Discover available browser targets by querying the /json/list endpoint
   * @param host Chrome host address
   * @param port DevTools port
   * @returns Promise resolving to array of browser targets
   */
  async discoverTargets(host: string, port: number): Promise<BrowserTarget[]> {
    const url = `http://${host}:${port}/json/list`;
    
    try {
      this.logger.debug(`Discovering targets at ${url}`);
      
      // Use dynamic import for node:http to avoid bundling issues
      const http = await import('http');
      
      return new Promise((resolve, reject) => {
        const request = http.get(url, (response) => {
          let data = '';
          
          response.on('data', (chunk) => {
            data += chunk;
          });
          
          response.on('end', () => {
            try {
              if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}: Failed to discover targets`));
                return;
              }
              
              const targets: BrowserTarget[] = JSON.parse(data);
              this.logger.debug(`Discovered ${targets.length} targets`);
              
              // Filter and validate targets
              const validTargets = targets.filter(target => 
                target.webSocketDebuggerUrl && 
                target.id && 
                target.type
              );
              
              resolve(validTargets);
            } catch (error) {
              reject(new Error(`Failed to parse targets response: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
          });
        });
        
        request.on('error', (error) => {
          reject(new Error(`Failed to connect to Chrome DevTools at ${url}: ${error.message}`));
        });
        
        // Set timeout for the request
        request.setTimeout(5000, () => {
          request.destroy();
          reject(new Error(`Timeout connecting to Chrome DevTools at ${url}`));
        });
      });
    } catch (error) {
      throw new Error(`Target discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Connect to a specific browser target
   * @param target Browser target to connect to
   * @returns Promise resolving to CDP client instance
   */
  async connectToTarget(target: BrowserTarget): Promise<ICDPClient> {
    try {
      this.logger.debug(`Connecting to target: ${target.id} (${target.title})`);
      
      // For now, we'll create a placeholder CDPClient
      // This will be implemented in task 2.1
      const client = await this.createCDPClient(target);
      
      // Track the connection
      this.activeConnections.push(client);
      
      this.logger.info(`Successfully connected to target: ${target.id}`);
      return client;
    } catch (error) {
      throw new Error(`Failed to connect to target ${target.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Reconnect to a target with exponential backoff retry logic
   * @param client CDP client to reconnect
   * @param maxRetries Maximum number of retry attempts
   */
  async reconnect(client: ICDPClient, maxRetries: number): Promise<void> {
    let retryCount = 0;
    let delay = this.DEFAULT_RETRY_DELAY;

    while (retryCount < maxRetries) {
      try {
        this.logger.debug(`Reconnection attempt ${retryCount + 1}/${maxRetries}`);
        
        // Attempt to reconnect
        await this.attemptReconnection(client);
        
        this.logger.info(`Successfully reconnected after ${retryCount + 1} attempts`);
        return;
      } catch (error) {
        retryCount++;
        
        if (retryCount >= maxRetries) {
          throw new Error(`Failed to reconnect after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        this.logger.warn(`Reconnection attempt ${retryCount} failed, retrying in ${delay}ms: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        // Wait with exponential backoff
        await this.sleep(delay);
        
        // Increase delay for next attempt, capped at MAX_RETRY_DELAY
        delay = Math.min(delay * this.RETRY_MULTIPLIER, this.MAX_RETRY_DELAY);
      }
    }
  }

  /**
   * Get list of active connections
   * @returns Array of active CDP clients
   */
  getActiveConnections(): ICDPClient[] {
    return [...this.activeConnections];
  }

  /**
   * Close all active connections
   */
  async closeAllConnections(): Promise<void> {
    this.logger.debug(`Closing ${this.activeConnections.length} active connections`);
    
    const closePromises = this.activeConnections.map(async (client) => {
      try {
        await client.disconnect();
      } catch (error) {
        this.logger.warn(`Error closing connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
    
    await Promise.allSettled(closePromises);
    this.activeConnections = [];
    
    this.logger.info('All connections closed');
  }

  /**
   * Create a CDP client instance for the given target
   * This is a placeholder implementation that will be replaced when CDPClient is implemented
   * @param target Browser target
   * @returns Promise resolving to CDP client
   */
  private async createCDPClient(target: BrowserTarget): Promise<ICDPClient> {
    // This is a placeholder implementation
    // The actual CDPClient will be implemented in task 2.1
    const mockClient: ICDPClient = {
      connect: async () => {
        // Placeholder implementation
      },
      disconnect: async () => {
        // Placeholder implementation
      },
      send: async () => {
        // Placeholder implementation
        return {};
      },
      on: () => {
        // Placeholder implementation
      },
      off: () => {
        // Placeholder implementation
      },
      isConnected: () => false,
      getConnectionStatus: () => 'disconnected' as const
    };
    
    return mockClient;
  }

  /**
   * Attempt to reconnect a client
   * @param client CDP client to reconnect
   */
  private async attemptReconnection(client: ICDPClient): Promise<void> {
    // Check current connection status
    if (client.isConnected()) {
      return; // Already connected
    }
    
    // Attempt to reconnect
    // This will depend on the actual CDPClient implementation
    // For now, we'll simulate a reconnection attempt
    throw new Error('Reconnection not yet implemented - depends on CDPClient');
  }

  /**
   * Sleep for specified milliseconds
   * @param ms Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Remove a client from active connections
   * @param client CDP client to remove
   */
  private removeConnection(client: ICDPClient): void {
    const index = this.activeConnections.indexOf(client);
    if (index > -1) {
      this.activeConnections.splice(index, 1);
    }
  }
}
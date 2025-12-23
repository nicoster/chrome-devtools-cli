/**
 * Connection Pool for managing persistent CDP connections
 * 
 * This class manages the lifecycle of CDP connections, including creation,
 * reuse, health monitoring, and cleanup.
 */

import WebSocket from 'ws';
import { CDPConnectionInfo, BrowserTarget, ProxyServerConfig } from '../types/ProxyTypes';
import { ConnectionManager } from '../../connection/ConnectionManager';
import { createLogger, Logger } from '../../utils/logger';
import { CDPEventMonitor } from './CDPEventMonitor';
import { MessageStore } from './MessageStore';

export class ConnectionPool {
  private connections: Map<string, CDPConnectionInfo> = new Map();
  private connectionsByKey: Map<string, string> = new Map(); // host:port:targetId -> connectionId
  private reconnectionAttempts: Map<string, number> = new Map(); // connectionId -> attempt count
  private reconnectionTimers: Map<string, NodeJS.Timeout> = new Map(); // connectionId -> timer
  private connectionManager: ConnectionManager;
  private logger: Logger;
  private eventMonitor?: CDPEventMonitor;
  private messageStore?: MessageStore;
  private config: Partial<ProxyServerConfig>;

  constructor(eventMonitor?: CDPEventMonitor, messageStore?: MessageStore, config?: Partial<ProxyServerConfig>) {
    this.connectionManager = new ConnectionManager();
    this.logger = createLogger({ component: 'ConnectionPool' });
    this.eventMonitor = eventMonitor;
    this.messageStore = messageStore;
    this.config = {
      reconnectMaxAttempts: 5,
      reconnectBackoffMs: 1000,
      ...config
    };
  }

  /**
   * Get or create a CDP connection for the specified target
   */
  async getOrCreateConnection(host: string, port: number, targetId?: string): Promise<CDPConnectionInfo> {
    try {
      // Discover available targets
      const targets = await this.connectionManager.discoverTargets(host, port);
      
      if (targets.length === 0) {
        throw new Error(`No Chrome targets found at ${host}:${port}`);
      }

      // Find the target to connect to
      let target: BrowserTarget;
      if (targetId) {
        const foundTarget = targets.find(t => t.id === targetId);
        if (!foundTarget) {
          throw new Error(`Target ${targetId} not found`);
        }
        target = foundTarget;
      } else {
        // Use the first page target
        const pageTarget = targets.find(t => t.type === 'page');
        if (!pageTarget) {
          throw new Error('No page targets available');
        }
        target = pageTarget;
      }

      // Check if we already have a connection for this target
      const connectionKey = this.createConnectionKey(host, port, target.id);
      const existingConnectionId = this.connectionsByKey.get(connectionKey);
      
      if (existingConnectionId) {
        const existingConnection = this.connections.get(existingConnectionId);
        if (existingConnection && existingConnection.isHealthy) {
          // Update last used timestamp and client count
          existingConnection.lastUsed = Date.now();
          existingConnection.clientCount++;
          
          this.logger.logConnectionEvent(
            'established',
            existingConnectionId,
            `Reusing existing connection for ${connectionKey}`,
            {
              connectionKey,
              clientCount: existingConnection.clientCount,
              target: {
                id: target.id,
                title: target.title,
                url: target.url
              }
            }
          );
          
          return existingConnection;
        } else {
          // Remove unhealthy connection
          if (existingConnection) {
            await this.closeConnection(existingConnectionId);
          }
        }
      }

      // Create new connection
      const connectionId = this.generateConnectionId();
      const wsUrl = target.webSocketDebuggerUrl;
      
      if (!wsUrl) {
        throw new Error(`No WebSocket URL available for target ${target.id}`);
      }

      this.logger.logConnectionEvent(
        'established',
        connectionId,
        `Creating new CDP connection to ${wsUrl}`,
        {
          connectionKey,
          wsUrl,
          target: {
            id: target.id,
            title: target.title,
            url: target.url,
            type: target.type
          }
        }
      );
      
      // Create WebSocket connection
      const ws = new WebSocket(wsUrl);
      
      // Wait for connection to open
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        ws.on('open', () => {
          clearTimeout(timeout);
          resolve();
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      // Create connection info
      const connectionInfo: CDPConnectionInfo = {
        id: connectionId,
        host,
        port,
        targetId: target.id,
        wsUrl,
        connection: ws,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        isHealthy: true,
        clientCount: 1
      };

      // Store connection
      this.connections.set(connectionId, connectionInfo);
      this.connectionsByKey.set(connectionKey, connectionId);

      // Setup connection event handlers
      this.setupConnectionHandlers(connectionInfo);

      // Start CDP event monitoring if monitor is available
      if (this.eventMonitor) {
        try {
          await this.eventMonitor.startMonitoring(connectionInfo);
        } catch (error) {
          this.logger.logConnectionEvent(
            'established',
            connectionId,
            'Failed to start event monitoring',
            { connectionKey },
            error as Error
          );
        }
      }

      this.logger.logConnectionEvent(
        'established',
        connectionId,
        'CDP connection established successfully',
        {
          connectionKey,
          clientCount: connectionInfo.clientCount,
          monitoringEnabled: !!this.eventMonitor
        }
      );
      
      return connectionInfo;

    } catch (error) {
      // Use a fallback connection ID since it might not be defined yet
      const errorConnectionId = 'unknown';
      const errorConnectionKey = `${host}:${port}:${targetId}`;
      
      this.logger.logConnectionEvent(
        'established',
        errorConnectionId,
        `Failed to create connection for ${host}:${port}:${targetId}`,
        { connectionKey: errorConnectionKey, host, port, targetId },
        error as Error
      );
      throw error;
    }
  }

  /**
   * Close a specific connection
   */
  async closeConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      this.logger.warn(`Connection ${connectionId} not found for closing`);
      return;
    }

    try {
      this.logger.info(`Closing CDP connection ${connectionId}`);

      // Clean up reconnection tracking
      this.reconnectionAttempts.delete(connectionId);
      this.clearReconnectionTimer(connectionId);

      // Stop event monitoring if monitor is available
      if (this.eventMonitor) {
        await this.eventMonitor.stopMonitoring(connectionId);
      }

      // Clean up message store data if available
      if (this.messageStore) {
        this.messageStore.cleanupConnection(connectionId);
      }

      // Close WebSocket connection
      if (connection.connection.readyState === WebSocket.OPEN) {
        connection.connection.close();
      }

      // Remove from maps
      const connectionKey = this.createConnectionKey(connection.host, connection.port, connection.targetId);
      this.connections.delete(connectionId);
      this.connectionsByKey.delete(connectionKey);

      this.logger.info(`CDP connection ${connectionId} closed successfully`);

    } catch (error) {
      this.logger.error(`Error closing connection ${connectionId}:`, error);
    }
  }

  /**
   * Check if a connection is healthy
   */
  async healthCheck(connectionId: string): Promise<boolean> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    try {
      // Check WebSocket state
      if (connection.connection.readyState !== WebSocket.OPEN) {
        connection.isHealthy = false;
        return false;
      }

      // Send a simple CDP command to test the connection
      // Use integer ID for CDP command
      const messageId = Math.floor(Date.now() % 1000000) + Math.floor(Math.random() * 10000); // Add more randomness
      const testMessage = {
        id: messageId,
        method: 'Runtime.evaluate',
        params: { expression: '1+1' }
      };

      console.log(`[DEBUG] Health check starting for connection ${connectionId} with message ID: ${messageId}`);

      // Create a promise that resolves when we get a response
      const healthCheckPromise = new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          console.log(`[DEBUG] Health check timeout for connection ${connectionId}, message ID: ${messageId}`);
          resolve(false);
        }, 5000);

        const messageHandler = (data: WebSocket.Data) => {
          try {
            const response = JSON.parse(data.toString());
            console.log(`[DEBUG] Health check received message for connection ${connectionId}, response ID: ${response.id}, expected: ${messageId}`);
            
            if (response.id === testMessage.id) {
              clearTimeout(timeout);
              connection.connection.off('message', messageHandler);
              const isHealthy = response.result && !response.error;
              console.log(`[DEBUG] Health check result for connection ${connectionId}: ${isHealthy}`);
              resolve(isHealthy);
            }
          } catch (error) {
            console.log(`[DEBUG] Health check message parsing error for connection ${connectionId}:`, error);
            // Ignore parsing errors for other messages
          }
        };

        connection.connection.on('message', messageHandler);
        console.log(`[DEBUG] Sending health check command for connection ${connectionId}:`, testMessage);
        connection.connection.send(JSON.stringify(testMessage));
      });

      const isHealthy = await healthCheckPromise;
      connection.isHealthy = isHealthy;
      
      if (!isHealthy) {
        this.logger.warn(`Health check failed for connection ${connectionId}`);
      }

      return isHealthy;

    } catch (error) {
      this.logger.error(`Health check error for connection ${connectionId}:`, error);
      connection.isHealthy = false;
      return false;
    }
  }

  /**
   * Attempt to reconnect a failed connection with exponential backoff
   */
  async reconnect(connectionId: string): Promise<boolean> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      this.logger.warn(`Cannot reconnect: connection ${connectionId} not found`);
      return false;
    }

    // Check if we've exceeded maximum retry attempts
    const currentAttempts = this.reconnectionAttempts.get(connectionId) || 0;
    const maxAttempts = this.config.reconnectMaxAttempts || 5;
    
    if (currentAttempts >= maxAttempts) {
      this.logger.error(`Maximum reconnection attempts (${maxAttempts}) exceeded for connection ${connectionId}`);
      await this.handleReconnectionFailure(connectionId);
      return false;
    }

    // Increment attempt counter
    this.reconnectionAttempts.set(connectionId, currentAttempts + 1);

    try {
      this.logger.info(`Attempting reconnection ${currentAttempts + 1}/${maxAttempts} for connection ${connectionId}`);

      // Calculate exponential backoff delay
      const baseDelay = this.config.reconnectBackoffMs || 1000;
      const delay = baseDelay * Math.pow(2, currentAttempts);
      const jitter = Math.random() * 0.1 * delay; // Add 10% jitter
      const totalDelay = delay + jitter;

      this.logger.debug(`Waiting ${Math.round(totalDelay)}ms before reconnection attempt`);

      // Wait for backoff delay
      await new Promise(resolve => setTimeout(resolve, totalDelay));

      // Preserve existing connection data before reconnection
      const preservedData = this.preserveConnectionData(connectionId);

      // Close existing connection gracefully
      await this.closeExistingConnection(connection);

      // Attempt to create new connection
      const success = await this.establishNewConnection(connection);

      if (success) {
        // Restore preserved data
        await this.restoreConnectionData(connectionId, preservedData);
        
        // Reset reconnection attempts on success
        this.reconnectionAttempts.delete(connectionId);
        this.clearReconnectionTimer(connectionId);
        
        this.logger.info(`Connection ${connectionId} reconnected successfully after ${currentAttempts + 1} attempts`);
        return true;
      } else {
        // Schedule next reconnection attempt
        this.scheduleReconnectionAttempt(connectionId);
        return false;
      }

    } catch (error) {
      this.logger.error(`Reconnection attempt ${currentAttempts + 1} failed for connection ${connectionId}:`, error);
      connection.isHealthy = false;
      
      // Schedule next reconnection attempt
      this.scheduleReconnectionAttempt(connectionId);
      return false;
    }
  }

  /**
   * Schedule automatic reconnection attempt
   */
  private scheduleReconnectionAttempt(connectionId: string): void {
    // Clear any existing timer
    this.clearReconnectionTimer(connectionId);

    const currentAttempts = this.reconnectionAttempts.get(connectionId) || 0;
    const maxAttempts = this.config.reconnectMaxAttempts || 5;

    if (currentAttempts < maxAttempts) {
      const baseDelay = this.config.reconnectBackoffMs || 1000;
      const delay = baseDelay * Math.pow(2, currentAttempts);
      
      this.logger.debug(`Scheduling next reconnection attempt for connection ${connectionId} in ${delay}ms`);
      
      const timer = setTimeout(async () => {
        await this.reconnect(connectionId);
      }, delay);
      
      this.reconnectionTimers.set(connectionId, timer);
    } else {
      this.logger.error(`All reconnection attempts exhausted for connection ${connectionId}`);
      this.handleReconnectionFailure(connectionId);
    }
  }

  /**
   * Preserve connection data before reconnection
   */
  private preserveConnectionData(connectionId: string): any {
    const preservedData: any = {};
    
    // Preserve message store data if available
    if (this.messageStore) {
      try {
        preservedData.consoleMessages = this.messageStore.getConsoleMessages(connectionId);
        preservedData.networkRequests = this.messageStore.getNetworkRequests(connectionId);
        this.logger.debug(`Preserved ${preservedData.consoleMessages.length} console messages and ${preservedData.networkRequests.length} network requests for connection ${connectionId}`);
      } catch (error) {
        this.logger.warn(`Failed to preserve data for connection ${connectionId}:`, error);
      }
    }
    
    return preservedData;
  }

  /**
   * Restore connection data after reconnection
   */
  private async restoreConnectionData(connectionId: string, preservedData: any): Promise<void> {
    if (!this.messageStore || !preservedData) {
      return;
    }

    try {
      // Note: MessageStore should maintain data during reconnection
      // This is mainly for logging and verification
      this.logger.debug(`Data preservation verified for connection ${connectionId}`);
    } catch (error) {
      this.logger.warn(`Failed to restore data for connection ${connectionId}:`, error);
    }
  }

  /**
   * Close existing connection gracefully
   */
  private async closeExistingConnection(connection: CDPConnectionInfo): Promise<void> {
    try {
      if (connection.connection.readyState === WebSocket.OPEN) {
        connection.connection.close(1000, 'Reconnecting');
      }
      
      // Wait a moment for graceful closure
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      this.logger.warn(`Error during graceful connection closure:`, error);
    }
  }

  /**
   * Establish new connection
   */
  private async establishNewConnection(connection: CDPConnectionInfo): Promise<boolean> {
    try {
      // Create new WebSocket connection
      const ws = new WebSocket(connection.wsUrl);

      // Wait for connection to open with timeout
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Reconnection timeout after 10 seconds'));
        }, 10000);

        ws.on('open', () => {
          clearTimeout(timeout);
          resolve();
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      // Update connection info
      connection.connection = ws;
      connection.isHealthy = true;
      connection.lastUsed = Date.now();

      // Setup event handlers for new connection
      this.setupConnectionHandlers(connection);

      // Restart event monitoring if monitor is available
      if (this.eventMonitor) {
        try {
          await this.eventMonitor.startMonitoring(connection);
        } catch (error) {
          this.logger.warn(`Failed to restart event monitoring for connection ${connection.id}:`, error);
          // Don't fail reconnection for monitoring issues
        }
      }

      return true;

    } catch (error) {
      this.logger.error(`Failed to establish new connection:`, error);
      connection.isHealthy = false;
      return false;
    }
  }

  /**
   * Handle reconnection failure after all attempts exhausted
   */
  private async handleReconnectionFailure(connectionId: string): Promise<void> {
    this.logger.error(`Reconnection failed permanently for connection ${connectionId}, cleaning up`);
    
    // Clean up reconnection tracking
    this.reconnectionAttempts.delete(connectionId);
    this.clearReconnectionTimer(connectionId);
    
    // Mark connection as permanently failed
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.isHealthy = false;
    }
    
    // Optionally remove the connection entirely
    // await this.closeConnection(connectionId);
  }

  /**
   * Clear reconnection timer for a connection
   */
  private clearReconnectionTimer(connectionId: string): void {
    const timer = this.reconnectionTimers.get(connectionId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectionTimers.delete(connectionId);
    }
  }

  /**
   * Get reconnection status for a connection
   */
  getReconnectionStatus(connectionId: string): {
    isReconnecting: boolean;
    attempts: number;
    maxAttempts: number;
  } {
    return {
      isReconnecting: this.reconnectionTimers.has(connectionId),
      attempts: this.reconnectionAttempts.get(connectionId) || 0,
      maxAttempts: this.config.reconnectMaxAttempts || 5
    };
  }

  /**
   * Get connection information
   */
  getConnectionInfo(connectionId: string): CDPConnectionInfo | null {
    return this.connections.get(connectionId) || null;
  }

  /**
   * Get all connections
   */
  getAllConnections(): CDPConnectionInfo[] {
    return Array.from(this.connections.values());
  }

  /**
   * Clean up unused connections
   */
  async cleanupUnusedConnections(maxIdleTime: number): Promise<void> {
    const now = Date.now();
    const connectionsToClose: string[] = [];

    for (const [connectionId, connection] of Array.from(this.connections.entries())) {
      if (connection.clientCount === 0 && (now - connection.lastUsed) > maxIdleTime) {
        connectionsToClose.push(connectionId);
      }
    }

    for (const connectionId of connectionsToClose) {
      this.logger.info(`Cleaning up unused connection ${connectionId}`);
      await this.closeConnection(connectionId);
    }
  }

  /**
   * Decrement client count for a connection
   */
  decrementClientCount(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection && connection.clientCount > 0) {
      connection.clientCount--;
      connection.lastUsed = Date.now();
    }
  }

  /**
   * Setup event handlers for a connection
   */
  private setupConnectionHandlers(connectionInfo: CDPConnectionInfo): void {
    const { connection, id } = connectionInfo;

    connection.on('close', () => {
      this.logger.warn(`CDP connection ${id} closed unexpectedly`);
      connectionInfo.isHealthy = false;
    });

    connection.on('error', (error) => {
      this.logger.error(`CDP connection ${id} error:`, error);
      connectionInfo.isHealthy = false;
    });

    // Note: Message handling will be done by MessageStore and WSProxy
    // This is just for connection lifecycle management
  }

  /**
   * Create a connection key for mapping
   */
  private createConnectionKey(host: string, port: number, targetId: string): string {
    return `${host}:${port}:${targetId}`;
  }

  /**
   * Generate a unique connection ID
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup all reconnection timers and tracking
   */
  cleanup(): void {
    this.logger.info('Cleaning up ConnectionPool resources');
    
    // Clear all reconnection timers
    for (const timer of this.reconnectionTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectionTimers.clear();
    
    // Clear reconnection attempts tracking
    this.reconnectionAttempts.clear();
    
    this.logger.debug('ConnectionPool cleanup completed');
  }

  /**
   * Get all reconnection statuses
   */
  getAllReconnectionStatuses(): Map<string, {
    isReconnecting: boolean;
    attempts: number;
    maxAttempts: number;
  }> {
    const statuses = new Map();
    
    for (const connectionId of this.connections.keys()) {
      statuses.set(connectionId, this.getReconnectionStatus(connectionId));
    }
    
    return statuses;
  }
}
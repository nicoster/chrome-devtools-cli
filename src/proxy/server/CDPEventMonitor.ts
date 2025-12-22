/**
 * CDP Event Monitor for the Proxy Server
 * 
 * This class monitors CDP events from persistent connections and feeds
 * console messages and network requests into the MessageStore.
 */

import WebSocket from 'ws';
import { CDPConnectionInfo, StoredNetworkRequest } from '../types/ProxyTypes';
import { MessageStore } from './MessageStore';
import { Logger } from '../../utils/logger';

export class CDPEventMonitor {
  private messageStore: MessageStore;
  private logger: Logger;
  private monitoredConnections: Map<string, CDPConnectionInfo> = new Map();
  private eventHandlers: Map<string, Map<string, (data: any) => void>> = new Map();

  constructor(messageStore: MessageStore) {
    this.messageStore = messageStore;
    this.logger = new Logger();
  }

  /**
   * Start monitoring a CDP connection for events
   */
  async startMonitoring(connectionInfo: CDPConnectionInfo): Promise<void> {
    const { id: connectionId, connection } = connectionInfo;

    if (this.monitoredConnections.has(connectionId)) {
      this.logger.debug(`Already monitoring connection ${connectionId}`);
      return;
    }

    try {
      this.logger.info(`[DEBUG] Starting CDP event monitoring for connection ${connectionId}`);
      this.logger.info(`[DEBUG] Connection WebSocket state: ${connection.readyState} (OPEN=1)`);

      // IMPORTANT: Set up event handlers FIRST, before sending commands
      // This ensures event handlers are ready to process events
      this.logger.info(`[DEBUG] Setting up event handlers for connection ${connectionId}`);
      this.setupEventHandlers(connectionId, connection);
      this.logger.info(`[DEBUG] Event handlers set up for connection ${connectionId}`);

      // Enable required CDP domains AFTER event handlers are set up
      this.logger.info(`[DEBUG] Enabling CDP domains for connection ${connectionId}`);
      await this.enableCDPDomains(connection);
      this.logger.info(`[DEBUG] CDP domains enabled for connection ${connectionId}`);

      // Store connection reference
      this.monitoredConnections.set(connectionId, connectionInfo);

      this.logger.info(`[DEBUG] CDP event monitoring started for connection ${connectionId}`);

    } catch (error) {
      this.logger.error(`[DEBUG] Failed to start monitoring for connection ${connectionId}:`, error);
      throw error;
    }
  }

  /**
   * Stop monitoring a CDP connection
   */
  async stopMonitoring(connectionId: string): Promise<void> {
    const connectionInfo = this.monitoredConnections.get(connectionId);
    if (!connectionInfo) {
      this.logger.debug(`Connection ${connectionId} not being monitored`);
      return;
    }

    try {
      this.logger.info(`Stopping CDP event monitoring for connection ${connectionId}`);

      // Remove event handlers
      this.removeEventHandlers(connectionId, connectionInfo.connection);

      // Remove connection reference
      this.monitoredConnections.delete(connectionId);

      this.logger.info(`CDP event monitoring stopped for connection ${connectionId}`);

    } catch (error) {
      this.logger.error(`Error stopping monitoring for connection ${connectionId}:`, error);
    }
  }

  /**
   * Stop monitoring all connections
   */
  async stopAllMonitoring(): Promise<void> {
    const connectionIds = Array.from(this.monitoredConnections.keys());
    
    for (const connectionId of connectionIds) {
      await this.stopMonitoring(connectionId);
    }
  }

  /**
   * Get list of monitored connection IDs
   */
  getMonitoredConnections(): string[] {
    return Array.from(this.monitoredConnections.keys());
  }

  /**
   * Check if a connection is being monitored
   */
  isMonitoring(connectionId: string): boolean {
    return this.monitoredConnections.has(connectionId);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Enable required CDP domains for monitoring
   */
  private async enableCDPDomains(connection: WebSocket): Promise<void> {
    const commands = [
      { method: 'Runtime.enable', params: {} },
      { method: 'Log.enable', params: {} },
      { method: 'Network.enable', params: {} }
    ];

    for (const command of commands) {
      try {
        this.logger.info(`[DEBUG] Sending CDP command: ${command.method}`);
        const result = await this.sendCDPCommand(connection, command.method, command.params);
        this.logger.info(`[DEBUG] Successfully enabled CDP domain: ${command.method}, result: ${JSON.stringify(result)}`);
      } catch (error) {
        // Some domains might not be available in all contexts
        this.logger.warn(`[DEBUG] Failed to enable ${command.method}:`, error);
      }
    }
  }

  /**
   * Send a CDP command and wait for response
   */
  private messageIdCounter = 1;
  
  private async sendCDPCommand(connection: WebSocket, method: string, params: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      // CDP requires integer IDs, use a simple counter
      const id = this.messageIdCounter++;
      const command = { id, method, params };

      this.logger.info(`[DEBUG] sendCDPCommand: sending command id=${id}, method=${method}`);

      const timeout = setTimeout(() => {
        this.logger.warn(`[DEBUG] sendCDPCommand: timeout for command id=${id}, method=${method}`);
        connection.off('message', messageHandler);
        reject(new Error(`CDP command timeout: ${method}`));
      }, 5000);

      const messageHandler = (data: WebSocket.Data) => {
        try {
          const rawMessage = data.toString();
          const response = JSON.parse(rawMessage);
          this.logger.info(`[DEBUG] sendCDPCommand: received raw message: ${rawMessage.substring(0, 200)}`);
          this.logger.info(`[DEBUG] sendCDPCommand: parsed response, id=${response.id}, method=${response.method}, waiting for id=${id}`);
          
          // Check if this is a response to our command (has id and matches)
          if (response.id !== undefined && response.id === id) {
            this.logger.info(`[DEBUG] sendCDPCommand: matched response id=${id} for method=${method}`);
            clearTimeout(timeout);
            connection.off('message', messageHandler);
            
            if (response.error) {
              this.logger.error(`[DEBUG] sendCDPCommand: command error for method=${method}: ${response.error.message}`);
              reject(new Error(`CDP command error: ${response.error.message}`));
            } else {
              this.logger.info(`[DEBUG] sendCDPCommand: command success for method=${method}`);
              resolve(response.result);
            }
          } else {
            // Not our response, ignore it (other handlers will process it)
            this.logger.debug(`[DEBUG] sendCDPCommand: ignoring message with id=${response.id}, waiting for id=${id}`);
          }
        } catch (error) {
          // Ignore parsing errors for other messages
          this.logger.debug(`[DEBUG] sendCDPCommand: error parsing message:`, error);
        }
      };

      // Register handler BEFORE sending command to ensure we catch the response
      connection.on('message', messageHandler);
      this.logger.info(`[DEBUG] sendCDPCommand: handler registered, sending command`);
      connection.send(JSON.stringify(command));
      this.logger.info(`[DEBUG] sendCDPCommand: command sent`);
    });
  }

  /**
   * Set up event handlers for a connection
   */
  private setupEventHandlers(connectionId: string, connection: WebSocket): void {
    const handlers = new Map<string, (data: any) => void>();

    // Create event handler function
    const eventHandler = (data: WebSocket.Data) => {
      try {
        const rawMessage = data.toString();
        const message = JSON.parse(rawMessage);
        
        // Log all incoming messages for debugging
        this.logger.info(`[DEBUG] setupEventHandlers: received raw message: ${rawMessage.substring(0, 200)}`);
        this.logger.info(`[DEBUG] setupEventHandlers: parsed message, id=${message.id}, method=${message.method || 'none'}, hasParams=${!!message.params}`);
        
        // Only process CDP events (not command responses)
        // Events have method and params, responses have id and result/error
        if (message.method && message.params && message.id === undefined) {
          this.logger.info(`[DEBUG] setupEventHandlers: processing CDP event: ${message.method} for connection ${connectionId}`);
          this.handleCDPEvent(connectionId, message.method, message.params);
        } else if (message.id !== undefined) {
          // This is a command response, let other handlers process it
          this.logger.debug(`[DEBUG] setupEventHandlers: ignoring command response with id=${message.id}`);
        } else {
          this.logger.warn(`[DEBUG] setupEventHandlers: received unexpected message format: ${rawMessage.substring(0, 200)}`);
        }
      } catch (error) {
        // Ignore parsing errors
        this.logger.debug(`[DEBUG] Error parsing message for connection ${connectionId}:`, error);
      }
    };

    // Store handler reference for cleanup
    handlers.set('message', eventHandler);
    this.eventHandlers.set(connectionId, handlers);

    // Attach event handler
    connection.on('message', eventHandler);
    this.logger.info(`[DEBUG] Event handler attached to connection ${connectionId}`);
  }

  /**
   * Remove event handlers for a connection
   */
  private removeEventHandlers(connectionId: string, connection: WebSocket): void {
    const handlers = this.eventHandlers.get(connectionId);
    if (!handlers) {
      return;
    }

    // Remove all event handlers
    for (const [event, handler] of handlers) {
      connection.off(event as any, handler);
    }

    // Clean up handler references
    this.eventHandlers.delete(connectionId);
  }

  /**
   * Handle incoming CDP events
   */
  private handleCDPEvent(connectionId: string, method: string, params: any): void {
    try {
      this.logger.info(`[DEBUG] handleCDPEvent called: method=${method}, connectionId=${connectionId}`);
      
      switch (method) {
        case 'Runtime.consoleAPICalled':
          this.logger.info(`[DEBUG] Processing Runtime.consoleAPICalled event for connection ${connectionId}`);
          this.handleConsoleAPIEvent(connectionId, params);
          break;

        case 'Log.entryAdded':
          this.logger.info(`[DEBUG] Processing Log.entryAdded event for connection ${connectionId}`);
          this.handleLogEntryEvent(connectionId, params);
          break;

        case 'Network.requestWillBeSent':
          this.logger.info(`[DEBUG] Processing Network.requestWillBeSent event for connection ${connectionId}`);
          this.handleNetworkRequestWillBeSent(connectionId, params);
          break;

        case 'Network.responseReceived':
          this.logger.info(`[DEBUG] Processing Network.responseReceived event for connection ${connectionId}`);
          this.handleNetworkResponseReceived(connectionId, params);
          break;

        case 'Network.loadingFinished':
          this.logger.info(`[DEBUG] Processing Network.loadingFinished event for connection ${connectionId}`);
          this.handleNetworkLoadingFinished(connectionId, params);
          break;

        case 'Network.loadingFailed':
          this.logger.info(`[DEBUG] Processing Network.loadingFailed event for connection ${connectionId}`);
          this.handleNetworkLoadingFailed(connectionId, params);
          break;

        default:
          // Ignore other events
          this.logger.debug(`[DEBUG] Ignoring CDP event: ${method}`);
          break;
      }
    } catch (error) {
      this.logger.error(`[DEBUG] Error handling CDP event ${method} for connection ${connectionId}:`, error);
    }
  }

  /**
   * Handle Runtime.consoleAPICalled events
   */
  private handleConsoleAPIEvent(connectionId: string, params: any): void {
    this.logger.info(`[DEBUG] handleConsoleAPIEvent called for connection ${connectionId}, params: ${JSON.stringify(params).substring(0, 200)}`);
    this.messageStore.processConsoleAPIEvent(connectionId, params);
    this.logger.info(`[DEBUG] handleConsoleAPIEvent completed for connection ${connectionId}`);
  }

  /**
   * Handle Log.entryAdded events
   */
  private handleLogEntryEvent(connectionId: string, params: any): void {
    this.messageStore.processLogEntryEvent(connectionId, params);
  }

  /**
   * Handle Network.requestWillBeSent events
   */
  private handleNetworkRequestWillBeSent(connectionId: string, params: any): void {
    try {
      this.logger.info(`[DEBUG] handleNetworkRequestWillBeSent called for connection ${connectionId}, url: ${params.request?.url}, method: ${params.request?.method}`);
      
      const networkRequest: StoredNetworkRequest = {
        connectionId,
        requestId: params.requestId,
        url: params.request.url,
        method: params.request.method,
        headers: params.request.headers || {},
        timestamp: params.wallTime ? params.wallTime * 1000 : Date.now(),
        loadingFinished: false
      };

      this.logger.info(`[DEBUG] Created network request: ${JSON.stringify(networkRequest).substring(0, 200)}`);
      this.messageStore.addNetworkRequest(connectionId, networkRequest);
      this.logger.info(`[DEBUG] Network request added to store for connection ${connectionId}`);
    } catch (error) {
      this.logger.error('[DEBUG] Error processing Network.requestWillBeSent:', error);
    }
  }

  /**
   * Handle Network.responseReceived events
   */
  private handleNetworkResponseReceived(connectionId: string, params: any): void {
    try {
      const update: Partial<StoredNetworkRequest> = {
        status: params.response.status,
        responseHeaders: params.response.headers || {}
      };

      this.messageStore.updateNetworkRequest(connectionId, params.requestId, update);
    } catch (error) {
      this.logger.error('Error processing Network.responseReceived:', error);
    }
  }

  /**
   * Handle Network.loadingFinished events
   */
  private handleNetworkLoadingFinished(connectionId: string, params: any): void {
    try {
      const update: Partial<StoredNetworkRequest> = {
        loadingFinished: true
      };

      this.messageStore.updateNetworkRequest(connectionId, params.requestId, update);
    } catch (error) {
      this.logger.error('Error processing Network.loadingFinished:', error);
    }
  }

  /**
   * Handle Network.loadingFailed events
   */
  private handleNetworkLoadingFailed(connectionId: string, params: any): void {
    try {
      const update: Partial<StoredNetworkRequest> = {
        status: 0, // Indicate network error
        loadingFinished: true
      };

      this.messageStore.updateNetworkRequest(connectionId, params.requestId, update);
    } catch (error) {
      this.logger.error('Error processing Network.loadingFailed:', error);
    }
  }
}
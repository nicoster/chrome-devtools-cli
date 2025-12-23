/**
 * Command Execution Service for HTTP-based CDP commands
 * 
 * This service handles HTTP-based command execution using Long Polling approach
 * to avoid WebSocket message routing complexity. It manages command queuing,
 * response matching, and concurrent command execution from multiple clients.
 */

import { CommandExecutionRequest, CommandExecutionResponse, PendingCommand, CommandExecutionMetrics } from '../types/ProxyTypes';
import { ConnectionPool } from './ConnectionPool';
import { CDPMessage, CDPResponse } from '../../types';
import { createLogger, Logger } from '../../utils/logger';
import WebSocket from 'ws';

export class CommandExecutionService {
  private connectionPool: ConnectionPool;
  private pendingCommands: Map<string, PendingCommand> = new Map();
  private commandMetrics: CommandExecutionMetrics = {
    totalCommands: 0,
    successfulCommands: 0,
    failedCommands: 0,
    averageExecutionTime: 0,
    timeoutCount: 0
  };
  private logger: Logger;
  private messageHandlers: Map<string, (data: WebSocket.Data) => void> = new Map();
  private activeCLIClient: string | null = null; // Track single active CLI client

  constructor(connectionPool: ConnectionPool) {
    this.connectionPool = connectionPool;
    this.logger = createLogger({ component: 'CommandExecutionService' });
  }

  /**
   * Execute a CDP command through HTTP API
   * Only allows one CLI client at a time for simplicity
   */
  async executeCommand(request: CommandExecutionRequest, clientId?: string): Promise<CommandExecutionResponse> {
    const startTime = Date.now();
    const commandId = this.generateCommandId();
    const timeout = request.timeout || 30000; // Default 30 second timeout

    try {
      // Check if another CLI client is already active
      if (this.activeCLIClient && clientId && this.activeCLIClient !== clientId) {
        throw new Error('Another CLI client is already connected. Only one CLI client can use the proxy at a time.');
      }

      // Set this client as active if not already set
      if (clientId && !this.activeCLIClient) {
        this.activeCLIClient = clientId;
        this.logger.info(`CLI client ${clientId} is now the active client`);
      }

      // Validate connection exists
      const connection = this.connectionPool.getConnectionInfo(request.connectionId);
      if (!connection) {
        throw new Error(`Connection ${request.connectionId} not found`);
      }

      if (!connection.isHealthy) {
        throw new Error(`Connection ${request.connectionId} is not healthy`);
      }

      this.logger.debug(`Executing CDP command: ${request.command.method}`, {
        connectionId: request.connectionId,
        commandId,
        method: request.command.method,
        timeout,
        clientId: clientId || 'unknown'
      });

      // Create CDP message with the provided ID or generate one
      const cdpMessage: CDPMessage = {
        id: typeof request.command.id === 'number' ? request.command.id : this.generateCDPMessageId(),
        method: request.command.method,
        params: request.command.params
      };

      // Send command and wait for response
      const result = await this.sendCDPCommand(request.connectionId, cdpMessage, timeout);

      const executionTime = Date.now() - startTime;
      this.updateMetrics(true, executionTime);

      this.logger.debug(`CDP command executed successfully: ${request.command.method}`, {
        connectionId: request.connectionId,
        commandId,
        executionTime,
        clientId: clientId || 'unknown'
      });

      return {
        success: true,
        result,
        executionTime
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updateMetrics(false, executionTime);

      this.logger.error(`CDP command execution failed: ${request.command.method}`, {
        connectionId: request.connectionId,
        commandId,
        executionTime,
        clientId: clientId || 'unknown',
        error: error instanceof Error ? error.message : String(error)
      });

      // Determine error type and code
      let errorCode = 500;
      let errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('Another CLI client')) {
        errorCode = 409; // Conflict
      } else if (errorMessage.includes('timeout')) {
        errorCode = 408;
        this.commandMetrics.timeoutCount++;
      } else if (errorMessage.includes('not found')) {
        errorCode = 404;
      } else if (errorMessage.includes('not healthy')) {
        errorCode = 503;
      }

      return {
        success: false,
        error: {
          code: errorCode,
          message: errorMessage
        },
        executionTime
      };
    }
  }

  /**
   * Send CDP command to Chrome and wait for response
   */
  private async sendCDPCommand(connectionId: string, command: CDPMessage, timeout: number): Promise<any> {
    const connection = this.connectionPool.getConnectionInfo(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    return new Promise((resolve, reject) => {
      const commandKey = `${connectionId}:${command.id}`;
      
      // Store pending command
      const pendingCommand: PendingCommand = {
        id: commandKey,
        connectionId,
        command,
        timestamp: Date.now(),
        timeout,
        resolve,
        reject
      };

      this.pendingCommands.set(commandKey, pendingCommand);

      // Set up message handler for this connection if not already done
      this.setupMessageHandler(connectionId);

      // Set timeout
      const timeoutHandle = setTimeout(() => {
        if (this.pendingCommands.has(commandKey)) {
          this.pendingCommands.delete(commandKey);
          reject(new Error(`Command timeout after ${timeout}ms: ${command.method}`));
        }
      }, timeout);

      // Update pending command with timeout handle for cleanup
      pendingCommand.resolve = (value: any) => {
        clearTimeout(timeoutHandle);
        resolve(value);
      };

      pendingCommand.reject = (error: Error) => {
        clearTimeout(timeoutHandle);
        reject(error);
      };

      // Send command to Chrome
      try {
        const messageStr = JSON.stringify(command);
        connection.connection.send(messageStr);
        
        this.logger.debug(`Sent CDP command to Chrome: ${command.method}`, {
          connectionId,
          commandId: command.id,
          messageLength: messageStr.length
        });
      } catch (error) {
        clearTimeout(timeoutHandle);
        this.pendingCommands.delete(commandKey);
        reject(new Error(`Failed to send command: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
  }

  /**
   * Set up message handler for a connection to handle CDP responses
   */
  private setupMessageHandler(connectionId: string): void {
    if (this.messageHandlers.has(connectionId)) {
      return; // Handler already set up
    }

    const connection = this.connectionPool.getConnectionInfo(connectionId);
    if (!connection) {
      return;
    }

    const messageHandler = (data: WebSocket.Data) => {
      try {
        const message = data.toString();
        let cdpResponse: CDPResponse;

        try {
          cdpResponse = JSON.parse(message);
        } catch (parseError) {
          this.logger.warn(`Invalid JSON from CDP connection ${connectionId}: ${message.substring(0, 100)}`);
          return;
        }

        // Only handle responses (messages with 'id' field), not events
        if (typeof cdpResponse.id === 'undefined') {
          return; // This is an event, not a response
        }

        const commandKey = `${connectionId}:${cdpResponse.id}`;
        const pendingCommand = this.pendingCommands.get(commandKey);

        if (pendingCommand) {
          this.pendingCommands.delete(commandKey);

          this.logger.debug(`Received CDP response for command: ${pendingCommand.command.method}`, {
            connectionId,
            commandId: cdpResponse.id,
            hasResult: !!cdpResponse.result,
            hasError: !!cdpResponse.error
          });

          if (cdpResponse.error) {
            pendingCommand.reject(new Error(`CDP Error: ${cdpResponse.error.message} (Code: ${cdpResponse.error.code})`));
          } else {
            pendingCommand.resolve(cdpResponse.result);
          }
        } else {
          this.logger.debug(`Received CDP response for unknown command ID: ${cdpResponse.id}`, {
            connectionId
          });
        }
      } catch (error) {
        this.logger.error(`Error handling CDP message for connection ${connectionId}:`, error);
      }
    };

    // Add message handler to the WebSocket connection
    connection.connection.on('message', messageHandler);
    this.messageHandlers.set(connectionId, messageHandler);

    this.logger.debug(`Set up message handler for connection: ${connectionId}`);

    // Clean up handler when connection closes
    connection.connection.on('close', () => {
      this.cleanupMessageHandler(connectionId);
    });
  }

  /**
   * Clean up message handler for a connection
   */
  private cleanupMessageHandler(connectionId: string): void {
    const handler = this.messageHandlers.get(connectionId);
    if (handler) {
      const connection = this.connectionPool.getConnectionInfo(connectionId);
      if (connection) {
        connection.connection.off('message', handler);
      }
      this.messageHandlers.delete(connectionId);

      this.logger.debug(`Cleaned up message handler for connection: ${connectionId}`);
    }

    // Clean up any pending commands for this connection
    const commandsToCleanup: string[] = [];
    for (const [, pendingCommand] of this.pendingCommands.entries()) {
      if (pendingCommand.connectionId === connectionId) {
        commandsToCleanup.push(pendingCommand.id);
        pendingCommand.reject(new Error('Connection closed'));
      }
    }

    for (const commandKey of commandsToCleanup) {
      this.pendingCommands.delete(commandKey);
    }

    if (commandsToCleanup.length > 0) {
      this.logger.debug(`Cleaned up ${commandsToCleanup.length} pending commands for connection: ${connectionId}`);
    }
  }

  /**
   * Get current command execution metrics
   */
  getMetrics(): CommandExecutionMetrics {
    return { ...this.commandMetrics };
  }

  /**
   * Get pending commands count
   */
  getPendingCommandsCount(): number {
    return this.pendingCommands.size;
  }

  /**
   * Get pending commands for a specific connection
   */
  getPendingCommandsForConnection(connectionId: string): number {
    let count = 0;
    for (const pendingCommand of this.pendingCommands.values()) {
      if (pendingCommand.connectionId === connectionId) {
        count++;
      }
    }
    return count;
  }

  /**
   * Set the active CLI client
   */
  setActiveCLIClient(clientId: string): void {
    if (this.activeCLIClient && this.activeCLIClient !== clientId) {
      this.logger.warn(`Replacing active CLI client ${this.activeCLIClient} with ${clientId}`);
    }
    this.activeCLIClient = clientId;
    this.logger.info(`CLI client ${clientId} is now the active client`);
  }

  /**
   * Release the active CLI client
   */
  releaseActiveCLIClient(clientId?: string): void {
    if (clientId && this.activeCLIClient !== clientId) {
      this.logger.warn(`Attempted to release CLI client ${clientId}, but active client is ${this.activeCLIClient}`);
      return;
    }
    
    const previousClient = this.activeCLIClient;
    this.activeCLIClient = null;
    
    if (previousClient) {
      this.logger.info(`Released active CLI client: ${previousClient}`);
    }
  }

  /**
   * Get the current active CLI client
   */
  getActiveCLIClient(): string | null {
    return this.activeCLIClient;
  }

  /**
   * Check if a CLI client is currently active
   */
  hasActiveCLIClient(): boolean {
    return this.activeCLIClient !== null;
  }

  /**
   * Cleanup all resources
   */
  cleanup(): void {
    // Reject all pending commands
    for (const [, pendingCommand] of this.pendingCommands.entries()) {
      pendingCommand.reject(new Error('Service shutting down'));
    }
    this.pendingCommands.clear();

    // Clean up all message handlers
    for (const connectionId of this.messageHandlers.keys()) {
      this.cleanupMessageHandler(connectionId);
    }

    // Reset active CLI client
    this.activeCLIClient = null;

    this.logger.info('CommandExecutionService cleanup completed');
  }

  /**
   * Generate unique command ID
   */
  private generateCommandId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate CDP message ID
   */
  private generateCDPMessageId(): number {
    return Math.floor(Date.now() % 1000000) + Math.floor(Math.random() * 10000);
  }

  /**
   * Update command execution metrics
   */
  private updateMetrics(success: boolean, executionTime: number): void {
    this.commandMetrics.totalCommands++;
    
    if (success) {
      this.commandMetrics.successfulCommands++;
    } else {
      this.commandMetrics.failedCommands++;
    }

    // Update average execution time
    const totalTime = this.commandMetrics.averageExecutionTime * (this.commandMetrics.totalCommands - 1) + executionTime;
    this.commandMetrics.averageExecutionTime = totalTime / this.commandMetrics.totalCommands;
  }
}
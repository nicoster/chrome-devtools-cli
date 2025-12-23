/**
 * WebSocket Proxy for bidirectional CDP command forwarding
 * 
 * Handles WebSocket connections from CLI clients and forwards
 * CDP commands/responses between clients and Chrome.
 */

import * as WebSocket from 'ws';
import { WebSocketServer } from 'ws';
import * as http from 'http';
import { ProxyWebSocketConnection, CDPConnectionInfo } from '../types/ProxyTypes';
import { ConnectionPool } from './ConnectionPool';
import { createLogger, Logger } from '../../utils/logger';

export class WSProxy {
  private connections: Map<string, ProxyWebSocketConnection> = new Map();
  private wsServer?: WebSocketServer;
  private connectionPool: ConnectionPool;
  private logger: Logger;
  private eventSubscriptions: Map<string, Set<string>> = new Map(); // connectionId -> Set of proxyIds
  private clientEventFilters: Map<string, Set<string>> = new Map(); // proxyId -> Set of event methods

  constructor(connectionPool: ConnectionPool) {
    this.connectionPool = connectionPool;
    this.logger = createLogger({ component: 'WSProxy' });
  }

  /**
   * Start the WebSocket proxy server
   */
  start(wsServer: WebSocketServer): void {
    this.wsServer = wsServer;
    
    this.wsServer.on('connection', (ws: WebSocket, request: http.IncomingMessage) => {
      this.handleConnection(ws, request);
    });

    this.logger.info('WebSocket proxy started');
  }

  /**
   * Stop the WebSocket proxy server
   */
  stop(): void {
    if (this.wsServer) {
      // Close all proxy connections
      for (const [proxyId] of Array.from(this.connections)) {
        this.closeProxyConnection(proxyId);
      }

      this.wsServer.close();
      this.wsServer = undefined;
      this.logger.info('WebSocket proxy stopped');
    }
  }

  /**
   * Handle new WebSocket connection from CLI client
   */
  handleConnection(ws: WebSocket, request: http.IncomingMessage): void {
    try {
      // Extract connection ID from URL path or query parameters
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      let connectionId = url.searchParams.get('connectionId');
      
      // If not in query params, try to extract from path (e.g., /ws/connectionId)
      if (!connectionId) {
        const pathParts = url.pathname.split('/');
        if (pathParts.length >= 3 && pathParts[1] === 'ws') {
          connectionId = pathParts[2];
        }
      }

      // Authentication: Verify connection ID is provided
      if (!connectionId) {
        this.logger.logClientEvent(
          'error',
          'unknown',
          'WebSocket connection rejected: Connection ID required',
          { 
            clientIP: request.socket.remoteAddress,
            userAgent: request.headers['user-agent']
          }
        );
        ws.close(1008, 'Connection ID required');
        return;
      }

      // Routing: Verify the connection exists in the pool
      const cdpConnection = this.connectionPool.getConnectionInfo(connectionId);
      if (!cdpConnection) {
        this.logger.logClientEvent(
          'error',
          'unknown',
          `WebSocket connection rejected: Invalid connection ID ${connectionId}`,
          { 
            connectionId,
            clientIP: request.socket.remoteAddress
          }
        );
        ws.close(1008, 'Invalid connection ID');
        return;
      }

      // Verify CDP connection is healthy
      if (!cdpConnection.isHealthy) {
        this.logger.logClientEvent(
          'error',
          'unknown',
          `WebSocket connection rejected: CDP connection ${connectionId} is not healthy`,
          { 
            connectionId,
            clientIP: request.socket.remoteAddress
          }
        );
        ws.close(1011, 'CDP connection unavailable');
        return;
      }

      // Create proxy connection
      const proxyId = this.generateProxyId();
      const proxyConnection: ProxyWebSocketConnection = {
        id: proxyId,
        clientWs: ws,
        connectionId,
        createdAt: Date.now(),
        messageCount: 0
      };

      this.connections.set(proxyId, proxyConnection);
      
      // Increment client count for the CDP connection
      this.incrementClientCount(connectionId);
      
      // Add to event subscriptions for this CDP connection
      if (!this.eventSubscriptions.has(connectionId)) {
        this.eventSubscriptions.set(connectionId, new Set());
      }
      this.eventSubscriptions.get(connectionId)!.add(proxyId);
      
      // Initialize event filters for this client (empty = all events)
      this.clientEventFilters.set(proxyId, new Set());
      
      this.logger.logClientEvent(
        'connected',
        proxyId,
        `WebSocket proxy connection established for CDP connection ${connectionId}`,
        {
          connectionId,
          clientCount: cdpConnection.clientCount,
          clientIP: request.socket.remoteAddress,
          userAgent: request.headers['user-agent']
        }
      );

      // Setup message forwarding
      this.setupMessageForwarding(proxyConnection, cdpConnection);

      // Lifecycle management: Handle client disconnection
      ws.on('close', (code, reason) => {
        this.logger.logClientEvent(
          'disconnected',
          proxyId,
          `WebSocket client disconnected`,
          { 
            connectionId,
            code,
            reason: reason?.toString(),
            messageCount: proxyConnection.messageCount,
            sessionDuration: Date.now() - proxyConnection.createdAt
          }
        );
        this.handleClientDisconnection(proxyId);
      });

      ws.on('error', (error) => {
        this.logger.error(`WebSocket proxy error for ${proxyId}:`, error);
        this.closeProxyConnection(proxyId);
      });

      // Send connection acknowledgment
      ws.send(JSON.stringify({
        type: 'proxy-connected',
        proxyId,
        connectionId,
        timestamp: Date.now()
      }));

    } catch (error) {
      this.logger.error('Error handling WebSocket connection:', error);
      ws.close(1011, 'Internal server error');
    }
  }

  /**
   * Forward a message to a specific proxy connection
   */
  forwardMessage(proxyId: string, message: string): void {
    const proxyConnection = this.connections.get(proxyId);
    if (proxyConnection && proxyConnection.clientWs.readyState === WebSocket.OPEN) {
      proxyConnection.clientWs.send(message);
      proxyConnection.messageCount++;
    }
  }

  /**
   * Close a proxy connection
   */
  closeProxyConnection(proxyId: string): void {
    const proxyConnection = this.connections.get(proxyId);
    if (proxyConnection) {
      if (proxyConnection.clientWs.readyState === WebSocket.OPEN) {
        proxyConnection.clientWs.close(1000, 'Proxy connection closed');
      }

      // Remove from event subscriptions
      const connectionId = proxyConnection.connectionId;
      const subscriptions = this.eventSubscriptions.get(connectionId);
      if (subscriptions) {
        subscriptions.delete(proxyId);
        if (subscriptions.size === 0) {
          this.eventSubscriptions.delete(connectionId);
        }
      }

      // Remove client event filters
      this.clientEventFilters.delete(proxyId);

      // Decrement client count for the CDP connection
      this.connectionPool.decrementClientCount(proxyConnection.connectionId);

      this.connections.delete(proxyId);
      this.logger.info(`WebSocket proxy connection ${proxyId} closed`);
    }
  }

  /**
   * Get active proxy connections
   */
  getActiveProxyConnections(): ProxyWebSocketConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get proxy connections for a specific CDP connection
   */
  getProxyConnectionsForCDP(connectionId: string): ProxyWebSocketConnection[] {
    return Array.from(this.connections.values()).filter(
      proxy => proxy.connectionId === connectionId
    );
  }

  /**
   * Broadcast a message to all proxy connections for a specific CDP connection
   */
  broadcastToCDPClients(connectionId: string, message: string): void {
    const proxyConnections = this.getProxyConnectionsForCDP(connectionId);
    let sentCount = 0;

    for (const proxyConnection of proxyConnections) {
      if (proxyConnection.clientWs.readyState === WebSocket.OPEN) {
        try {
          proxyConnection.clientWs.send(message);
          proxyConnection.messageCount++;
          sentCount++;
        } catch (error) {
          this.logger.error(`Error broadcasting to proxy ${proxyConnection.id}:`, error);
          this.closeProxyConnection(proxyConnection.id);
        }
      }
    }

    if (sentCount > 0) {
      this.logger.debug(`Broadcasted message to ${sentCount} clients for CDP connection ${connectionId}`);
    }
  }

  /**
   * Increment client count for a CDP connection
   */
  private incrementClientCount(connectionId: string): void {
    const cdpConnection = this.connectionPool.getConnectionInfo(connectionId);
    if (cdpConnection) {
      cdpConnection.clientCount++;
      cdpConnection.lastUsed = Date.now();
    }
  }

  /**
   * Setup bidirectional message forwarding
   */
  private setupMessageForwarding(
    proxyConnection: ProxyWebSocketConnection,
    cdpConnection: CDPConnectionInfo
  ): void {
    const { clientWs, connectionId } = proxyConnection;

    // Forward messages from CLI client to Chrome
    clientWs.on('message', (data: WebSocket.Data) => {
      try {
        const message = data.toString();
        
        // Parse and validate CDP command
        let cdpCommand;
        try {
          cdpCommand = JSON.parse(message);
        } catch (parseError) {
          this.logger.warn(`Invalid JSON from client ${proxyConnection.id}: ${message.substring(0, 100)}`);
          clientWs.send(JSON.stringify({
            error: { code: -32700, message: 'Parse error' },
            id: null
          }));
          return;
        }

        // Handle proxy-specific commands
        if (this.isProxyCommand(cdpCommand)) {
          this.handleProxyCommand(proxyConnection, cdpCommand);
          return;
        }

        // Validate CDP command structure
        if (!this.isValidCDPCommand(cdpCommand)) {
          this.logger.warn(`Invalid CDP command from client ${proxyConnection.id}:`, cdpCommand);
          clientWs.send(JSON.stringify({
            error: { code: -32600, message: 'Invalid Request' },
            id: cdpCommand.id || null
          }));
          return;
        }

        // Forward to CDP connection if available
        if (cdpConnection.connection.readyState === WebSocket.OPEN) {
          cdpConnection.connection.send(message);
          proxyConnection.messageCount++;
          console.log(`[DEBUG] Forwarded CDP command from client ${proxyConnection.id}: ${cdpCommand.method} (id: ${cdpCommand.id})`);
          this.logger.debug(`Forwarded CDP command from client ${proxyConnection.id}: ${cdpCommand.method} (id: ${cdpCommand.id})`);
        } else {
          console.log(`[DEBUG] CDP connection ${connectionId} is not open, readyState: ${cdpConnection.connection.readyState}`);
          this.logger.warn(`CDP connection ${connectionId} is not open, cannot forward command`);
          clientWs.send(JSON.stringify({
            error: { code: -32001, message: 'CDP connection unavailable' },
            id: cdpCommand.id || null
          }));
        }
      } catch (error) {
        this.logger.error(`Error forwarding message to CDP from client ${proxyConnection.id}:`, error);
        clientWs.send(JSON.stringify({
          error: { code: -32603, message: 'Internal error' },
          id: null
        }));
      }
    });

    // Forward messages from Chrome to CLI client
    const cdpMessageHandler = (data: WebSocket.Data) => {
      try {
        const message = data.toString();
        
        // Parse CDP response/event
        let cdpMessage;
        try {
          cdpMessage = JSON.parse(message);
        } catch (parseError) {
          this.logger.warn(`Invalid JSON from CDP connection ${connectionId}: ${message.substring(0, 100)}`);
          return;
        }

        // Handle CDP responses (have an 'id' field) vs events (no 'id' field)
        if (this.isCDPResponse(cdpMessage)) {
          // This is a response to a command - forward to the specific client
          console.log(`[DEBUG] Received CDP response for client ${proxyConnection.id}: id ${cdpMessage.id}`);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(message);
            proxyConnection.messageCount++;
            console.log(`[DEBUG] Forwarded CDP response to client ${proxyConnection.id}: id ${cdpMessage.id}`);
            this.logger.debug(`Forwarded CDP response to client ${proxyConnection.id}: id ${cdpMessage.id}`);
          } else {
            console.log(`[DEBUG] Client WebSocket is not open for ${proxyConnection.id}, readyState: ${clientWs.readyState}`);
          }
        } else if (this.isCDPEvent(cdpMessage)) {
          // This is an event - handle via event forwarding system
          console.log(`[DEBUG] Received CDP event: ${cdpMessage.method}`);
          this.forwardEventToSubscribedClients(connectionId, cdpMessage, message);
        } else {
          console.log(`[DEBUG] Received unknown CDP message type:`, cdpMessage);
        }
      } catch (error) {
        this.logger.error(`Error forwarding message to client ${proxyConnection.id}:`, error);
      }
    };

    // Add message handler to CDP connection
    console.log(`[DEBUG] Adding message handler to CDP connection ${connectionId} for proxy ${proxyConnection.id}`);
    cdpConnection.connection.on('message', cdpMessageHandler);

    // Clean up handler when proxy connection closes
    clientWs.on('close', () => {
      cdpConnection.connection.off('message', cdpMessageHandler);
      this.logger.debug(`Cleaned up CDP message handler for proxy ${proxyConnection.id}`);
    });
  }

  /**
   * Forward CDP events to all subscribed clients with filtering
   */
  private forwardEventToSubscribedClients(connectionId: string, cdpEvent: any, rawMessage: string): void {
    const subscribedProxies = this.eventSubscriptions.get(connectionId);
    if (!subscribedProxies || subscribedProxies.size === 0) {
      return;
    }

    let forwardedCount = 0;

    for (const proxyId of Array.from(subscribedProxies)) {
      const proxyConnection = this.connections.get(proxyId);
      if (!proxyConnection || proxyConnection.clientWs.readyState !== WebSocket.OPEN) {
        continue;
      }

      // Check if client has event filters
      const clientFilters = this.clientEventFilters.get(proxyId);
      if (clientFilters && clientFilters.size > 0) {
        // Client has specific filters - only forward if event matches
        if (!clientFilters.has(cdpEvent.method)) {
          continue;
        }
      }
      // If no filters (empty set), forward all events

      try {
        proxyConnection.clientWs.send(rawMessage);
        proxyConnection.messageCount++;
        forwardedCount++;
      } catch (error) {
        this.logger.error(`Error forwarding event to proxy ${proxyId}:`, error);
        this.closeProxyConnection(proxyId);
      }
    }

    if (forwardedCount > 0) {
      this.logger.debug(`Forwarded CDP event ${cdpEvent.method} to ${forwardedCount} clients for connection ${connectionId}`);
    }
  }

  /**
   * Set event filters for a specific client
   */
  setClientEventFilters(proxyId: string, eventMethods: string[]): boolean {
    if (!this.connections.has(proxyId)) {
      return false;
    }

    const filters = this.clientEventFilters.get(proxyId);
    if (filters) {
      filters.clear();
      eventMethods.forEach(method => filters.add(method));
      this.logger.debug(`Updated event filters for proxy ${proxyId}: ${eventMethods.join(', ')}`);
      return true;
    }

    return false;
  }

  /**
   * Clear event filters for a specific client (receive all events)
   */
  clearClientEventFilters(proxyId: string): boolean {
    if (!this.connections.has(proxyId)) {
      return false;
    }

    const filters = this.clientEventFilters.get(proxyId);
    if (filters) {
      filters.clear();
      this.logger.debug(`Cleared event filters for proxy ${proxyId} - will receive all events`);
      return true;
    }

    return false;
  }

  /**
   * Get current event filters for a client
   */
  getClientEventFilters(proxyId: string): string[] {
    const filters = this.clientEventFilters.get(proxyId);
    return filters ? Array.from(filters) : [];
  }

  /**
   * Validate if a message is a valid CDP command
   */
  private isValidCDPCommand(message: any): boolean {
    return (
      typeof message === 'object' &&
      message !== null &&
      typeof message.method === 'string' &&
      (message.id === undefined || typeof message.id === 'number' || typeof message.id === 'string') &&
      (message.params === undefined || typeof message.params === 'object')
    );
  }

  /**
   * Check if a CDP message is a response (has id and result/error)
   */
  private isCDPResponse(message: any): boolean {
    return (
      typeof message === 'object' &&
      message !== null &&
      (message.id !== undefined) &&
      (message.result !== undefined || message.error !== undefined)
    );
  }

  /**
   * Check if a CDP message is an event (has method but no id)
   */
  private isCDPEvent(message: any): boolean {
    return (
      typeof message === 'object' &&
      message !== null &&
      typeof message.method === 'string' &&
      message.id === undefined
    );
  }

  /**
   * Check if a message is a proxy-specific command
   */
  private isProxyCommand(message: any): boolean {
    return (
      typeof message === 'object' &&
      message !== null &&
      typeof message.method === 'string' &&
      message.method.startsWith('Proxy.')
    );
  }

  /**
   * Handle proxy-specific commands
   */
  private handleProxyCommand(proxyConnection: ProxyWebSocketConnection, command: any): void {
    const { method, params, id } = command;

    try {
      switch (method) {
        case 'Proxy.setEventFilters':
          {
            const eventMethods = params?.eventMethods || [];
            if (Array.isArray(eventMethods) && eventMethods.every(m => typeof m === 'string')) {
              this.setClientEventFilters(proxyConnection.id, eventMethods);
              proxyConnection.clientWs.send(JSON.stringify({
                id,
                result: { success: true, filters: eventMethods }
              }));
            } else {
              proxyConnection.clientWs.send(JSON.stringify({
                id,
                error: { code: -32602, message: 'Invalid eventMethods parameter' }
              }));
            }
          }
          break;

        case 'Proxy.clearEventFilters':
          {
            this.clearClientEventFilters(proxyConnection.id);
            proxyConnection.clientWs.send(JSON.stringify({
              id,
              result: { success: true, filters: [] }
            }));
          }
          break;

        case 'Proxy.getEventFilters':
          {
            const filters = this.getClientEventFilters(proxyConnection.id);
            proxyConnection.clientWs.send(JSON.stringify({
              id,
              result: { filters }
            }));
          }
          break;

        case 'Proxy.getStatus':
          {
            const cdpConnection = this.connectionPool.getConnectionInfo(proxyConnection.connectionId);
            proxyConnection.clientWs.send(JSON.stringify({
              id,
              result: {
                proxyId: proxyConnection.id,
                connectionId: proxyConnection.connectionId,
                messageCount: proxyConnection.messageCount,
                createdAt: proxyConnection.createdAt,
                cdpConnectionHealthy: cdpConnection?.isHealthy || false,
                totalClients: cdpConnection?.clientCount || 0
              }
            }));
          }
          break;

        default:
          proxyConnection.clientWs.send(JSON.stringify({
            id,
            error: { code: -32601, message: `Unknown proxy method: ${method}` }
          }));
      }
    } catch (error) {
      this.logger.error(`Error handling proxy command ${method}:`, error);
      proxyConnection.clientWs.send(JSON.stringify({
        id,
        error: { code: -32603, message: 'Internal error' }
      }));
    }
  }

  /**
   * Handle client disconnection
   */
  private handleClientDisconnection(proxyId: string): void {
    const proxyConnection = this.connections.get(proxyId);
    if (proxyConnection) {
      this.logger.info(`Client disconnected from proxy ${proxyId}`);
      this.closeProxyConnection(proxyId);
    }
  }

  /**
   * Generate a unique proxy connection ID
   */
  private generateProxyId(): string {
    return `proxy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
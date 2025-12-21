import WebSocket from 'ws';
import { ICDPClient } from '../interfaces/CDPClient';
import { CDPMessage, CDPResponse, CDPEvent } from '../types';
import fetch from 'node-fetch';

/**
 * Chrome DevTools Protocol Client implementation
 */
export class CDPClient implements ICDPClient {
  private ws: WebSocket | null = null;
  private messageId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>();
  private eventListeners = new Map<string, Array<(params: unknown) => void>>();
  private connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';

  /**
   * Connect to Chrome DevTools Protocol endpoint
   */
  async connect(host: string, port: number, targetId?: string): Promise<void> {
    this.connectionStatus = 'connecting';
    
    try {
      // If no targetId provided, discover the first available page target
      if (!targetId) {
        const targets = await this.discoverTargets(host, port);
        const pageTarget = targets.find(t => t.type === 'page');
        if (!pageTarget) {
          throw new Error('No page targets found');
        }
        targetId = pageTarget.id;
      }

      // Get WebSocket URL for the target
      const wsUrl = await this.getWebSocketUrl(host, port, targetId);
      
      // Create WebSocket connection
      this.ws = new WebSocket(wsUrl);
      
      return new Promise((resolve, reject) => {
        if (!this.ws) {
          reject(new Error('WebSocket not initialized'));
          return;
        }

        this.ws.on('open', () => {
          this.connectionStatus = 'connected';
          console.log('Connected to Chrome DevTools Protocol');
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleMessage(data.toString());
        });

        this.ws.on('error', (error) => {
          this.connectionStatus = 'error';
          console.error('WebSocket error:', error);
          reject(error);
        });

        this.ws.on('close', () => {
          this.connectionStatus = 'disconnected';
          console.log('WebSocket connection closed');
        });
      });
    } catch (error) {
      this.connectionStatus = 'error';
      throw error;
    }
  }

  /**
   * Disconnect from CDP endpoint
   */
  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectionStatus = 'disconnected';
    this.pendingRequests.clear();
  }

  /**
   * Send a CDP command and wait for response
   */
  async send(method: string, params?: unknown): Promise<unknown> {
    if (!this.ws || this.connectionStatus !== 'connected') {
      throw new Error('Not connected to CDP endpoint');
    }

    const id = ++this.messageId;
    const message: CDPMessage = { id, method, params };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      
      if (this.ws) {
        this.ws.send(JSON.stringify(message));
      } else {
        reject(new Error('WebSocket connection lost'));
      }

      // Set timeout for request
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout for method: ${method}`));
        }
      }, 30000);
    });
  }

  /**
   * Register event listener for CDP events
   */
  on(event: string, callback: (params: unknown) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: (params: unknown) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.connectionStatus === 'connected';
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): 'disconnected' | 'connecting' | 'connected' | 'error' {
    return this.connectionStatus;
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      // Handle response to a request
      if (message.id !== undefined) {
        const response = message as CDPResponse;
        const pending = this.pendingRequests.get(response.id);
        
        if (pending) {
          this.pendingRequests.delete(response.id);
          
          if (response.error) {
            pending.reject(new Error(`CDP Error: ${response.error.message}`));
          } else {
            pending.resolve(response.result);
          }
        }
      }
      // Handle event
      else if (message.method) {
        const event = message as CDPEvent;
        const listeners = this.eventListeners.get(event.method);
        
        if (listeners) {
          listeners.forEach(callback => callback(event.params));
        }
      }
    } catch (error) {
      console.error('Error parsing CDP message:', error);
    }
  }

  /**
   * Discover available targets
   */
  private async discoverTargets(host: string, port: number): Promise<Array<{
    id: string;
    type: string;
    title: string;
    url: string;
    webSocketDebuggerUrl: string;
  }>> {
    const response = await fetch(`http://${host}:${port}/json/list`);
    if (!response.ok) {
      throw new Error(`Failed to discover targets: ${response.statusText}`);
    }
    return (await response.json()) as Array<{
      id: string;
      type: string;
      title: string;
      url: string;
      webSocketDebuggerUrl: string;
    }>;
  }

  /**
   * Get WebSocket URL for a specific target
   */
  private async getWebSocketUrl(host: string, port: number, targetId: string): Promise<string> {
    const targets = await this.discoverTargets(host, port);
    const target = targets.find(t => t.id === targetId);
    
    if (!target) {
      throw new Error(`Target not found: ${targetId}`);
    }
    
    return target.webSocketDebuggerUrl;
  }
}
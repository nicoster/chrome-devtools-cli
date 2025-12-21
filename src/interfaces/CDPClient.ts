/**
 * Chrome DevTools Protocol Client Interface
 */
export interface ICDPClient {
  /**
   * Connect to Chrome DevTools Protocol endpoint
   */
  connect(host: string, port: number, targetId?: string): Promise<void>;
  
  /**
   * Disconnect from CDP endpoint
   */
  disconnect(): Promise<void>;
  
  /**
   * Send a CDP command and wait for response
   */
  send(method: string, params?: unknown): Promise<unknown>;
  
  /**
   * Register event listener for CDP events
   */
  on(event: string, callback: (params: unknown) => void): void;
  
  /**
   * Remove event listener
   */
  off(event: string, callback: (params: unknown) => void): void;
  
  /**
   * Check if client is connected
   */
  isConnected(): boolean;
  
  /**
   * Get current connection status
   */
  getConnectionStatus(): 'disconnected' | 'connecting' | 'connected' | 'error';
}
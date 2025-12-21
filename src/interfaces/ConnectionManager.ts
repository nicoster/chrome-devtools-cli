import { BrowserTarget } from '../types';
import { ICDPClient } from './CDPClient';

/**
 * Connection Manager Interface for discovering and managing Chrome connections
 */
export interface IConnectionManager {
  /**
   * Discover available browser targets
   */
  discoverTargets(host: string, port: number): Promise<BrowserTarget[]>;
  
  /**
   * Connect to a specific browser target
   */
  connectToTarget(target: BrowserTarget): Promise<ICDPClient>;
  
  /**
   * Reconnect to a target with retry logic
   */
  reconnect(client: ICDPClient, maxRetries: number): Promise<void>;
  
  /**
   * Get list of active connections
   */
  getActiveConnections(): ICDPClient[];
  
  /**
   * Close all active connections
   */
  closeAllConnections(): Promise<void>;
}
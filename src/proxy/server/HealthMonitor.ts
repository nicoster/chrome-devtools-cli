/**
 * Health Monitor for CDP connections
 * 
 * This class monitors the health of CDP connections and handles
 * automatic reconnection with exponential backoff.
 */

import { HealthCheckResult, ConnectionMetrics } from '../types/ProxyTypes';
import { ConnectionPool } from './ConnectionPool';
import { Logger } from '../../utils/logger';

export class HealthMonitor {
  private healthChecks: Map<string, HealthCheckResult> = new Map();
  private connectionMetrics: Map<string, ConnectionMetrics> = new Map();
  private checkInterval?: NodeJS.Timeout;
  private connectionPool: ConnectionPool;
  private logger: Logger;
  private isRunning: boolean = false;
  private healthCheckTimeout: number = 5000; // 5 seconds timeout for health checks
  private maxConsecutiveFailures: number = 3; // Max failures before attempting reconnection

  constructor(connectionPool: ConnectionPool) {
    this.connectionPool = connectionPool;
    this.logger = new Logger();
  }

  /**
   * Start health monitoring
   */
  start(intervalMs: number = 30000): void {
    if (this.checkInterval) {
      this.logger.warn('Health monitoring already running, stopping previous instance');
      this.stop();
    }

    this.logger.info(`Starting health monitoring with ${intervalMs}ms interval`);
    this.isRunning = true;
    
    // Perform initial health check immediately
    this.performHealthChecks().catch(error => {
      this.logger.error('Initial health check failed:', error);
    });

    // Schedule periodic health checks
    this.checkInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, intervalMs);
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
      this.isRunning = false;
      this.logger.info('Health monitoring stopped');
    }
  }

  /**
   * Check if health monitoring is running
   */
  isMonitoring(): boolean {
    return this.isRunning;
  }

  /**
   * Check health of a specific connection
   */
  async checkConnection(connectionId: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Get connection info first
      const connectionInfo = this.connectionPool.getConnectionInfo(connectionId);
      if (!connectionInfo) {
        const result: HealthCheckResult = {
          connectionId,
          isHealthy: false,
          lastCheck: Date.now(),
          errorCount: 0,
          lastError: 'Connection not found'
        };
        this.healthChecks.set(connectionId, result);
        return result;
      }

      // Perform health check with timeout
      const isHealthy = await Promise.race([
        this.connectionPool.healthCheck(connectionId),
        new Promise<boolean>((_, reject) => {
          setTimeout(() => reject(new Error('Health check timeout')), this.healthCheckTimeout);
        })
      ]);

      const now = Date.now();
      const existingResult = this.healthChecks.get(connectionId);
      
      const result: HealthCheckResult = {
        connectionId,
        isHealthy,
        lastCheck: now,
        errorCount: isHealthy ? 0 : (existingResult?.errorCount || 0) + 1,
        lastError: isHealthy ? undefined : existingResult?.lastError || 'Health check failed'
      };

      this.healthChecks.set(connectionId, result);

      // Update connection metrics
      this.updateConnectionMetrics(connectionId, connectionInfo, now - startTime);

      // Log health check results
      if (!isHealthy) {
        this.logger.warn(`Health check failed for connection ${connectionId} (${result.errorCount} consecutive failures)`);
      } else if (existingResult && !existingResult.isHealthy) {
        this.logger.info(`Connection ${connectionId} recovered and is now healthy`);
      }

      return result;

    } catch (error) {
      const now = Date.now();
      const existingResult = this.healthChecks.get(connectionId);
      const errorMessage = error instanceof Error ? error.message : 'Unknown health check error';
      
      const result: HealthCheckResult = {
        connectionId,
        isHealthy: false,
        lastCheck: now,
        errorCount: (existingResult?.errorCount || 0) + 1,
        lastError: errorMessage
      };

      this.healthChecks.set(connectionId, result);
      this.logger.error(`Health check error for connection ${connectionId}:`, error);

      return result;
    }
  }

  /**
   * Attempt to reconnect a failed connection
   */
  async attemptReconnection(connectionId: string): Promise<boolean> {
    this.logger.info(`Attempting reconnection for connection ${connectionId}`);
    
    try {
      // Increment reconnection count
      this.incrementReconnectionCount(connectionId);
      
      const success = await this.connectionPool.reconnect(connectionId);
      
      if (success) {
        // Reset health status on successful reconnection
        const result: HealthCheckResult = {
          connectionId,
          isHealthy: true,
          lastCheck: Date.now(),
          errorCount: 0
        };
        this.healthChecks.set(connectionId, result);
        this.logger.info(`Reconnection successful for connection ${connectionId}`);
      } else {
        // Update health status with reconnection failure
        const existingResult = this.healthChecks.get(connectionId);
        const result: HealthCheckResult = {
          connectionId,
          isHealthy: false,
          lastCheck: Date.now(),
          errorCount: (existingResult?.errorCount || 0) + 1,
          lastError: 'Reconnection failed'
        };
        this.healthChecks.set(connectionId, result);
        this.logger.warn(`Reconnection failed for connection ${connectionId}`);
      }
      
      return success;
    } catch (error) {
      // Update health status with reconnection error
      const existingResult = this.healthChecks.get(connectionId);
      const errorMessage = error instanceof Error ? error.message : 'Unknown reconnection error';
      
      const result: HealthCheckResult = {
        connectionId,
        isHealthy: false,
        lastCheck: Date.now(),
        errorCount: (existingResult?.errorCount || 0) + 1,
        lastError: `Reconnection error: ${errorMessage}`
      };
      this.healthChecks.set(connectionId, result);
      
      this.logger.error(`Reconnection error for connection ${connectionId}:`, error);
      return false;
    }
  }

  /**
   * Get health status for a connection
   */
  getHealthStatus(connectionId: string): HealthCheckResult | null {
    return this.healthChecks.get(connectionId) || null;
  }

  /**
   * Get all health statuses
   */
  getAllHealthStatuses(): HealthCheckResult[] {
    return Array.from(this.healthChecks.values());
  }

  /**
   * Get connection metrics
   */
  getConnectionMetrics(connectionId: string): ConnectionMetrics | null {
    return this.connectionMetrics.get(connectionId) || null;
  }

  /**
   * Get all connection metrics
   */
  getAllConnectionMetrics(): ConnectionMetrics[] {
    return Array.from(this.connectionMetrics.values());
  }

  /**
   * Get health monitoring statistics
   */
  getHealthStatistics(): {
    totalConnections: number;
    healthyConnections: number;
    unhealthyConnections: number;
    averageResponseTime: number;
    totalHealthChecks: number;
  } {
    const healthStatuses = this.getAllHealthStatuses();
    const metrics = this.getAllConnectionMetrics();
    
    const totalConnections = healthStatuses.length;
    const healthyConnections = healthStatuses.filter(h => h.isHealthy).length;
    const unhealthyConnections = totalConnections - healthyConnections;
    
    // Calculate average response time from recent health checks
    const recentMetrics = metrics.filter(m => m.lastActivity > Date.now() - 300000); // Last 5 minutes
    const averageResponseTime = recentMetrics.length > 0 
      ? recentMetrics.reduce((sum, m) => sum + (m.lastActivity || 0), 0) / recentMetrics.length 
      : 0;
    
    const totalHealthChecks = healthStatuses.reduce((sum, h) => sum + (h.errorCount || 0), 0) + healthyConnections;

    return {
      totalConnections,
      healthyConnections,
      unhealthyConnections,
      averageResponseTime,
      totalHealthChecks
    };
  }

  /**
   * Force health check for all connections
   */
  async forceHealthCheckAll(): Promise<HealthCheckResult[]> {
    const connections = this.connectionPool.getAllConnections();
    const results: HealthCheckResult[] = [];

    for (const connection of connections) {
      try {
        const result = await this.checkConnection(connection.id);
        results.push(result);
      } catch (error) {
        this.logger.error(`Force health check failed for connection ${connection.id}:`, error);
      }
    }

    return results;
  }

  /**
   * Clean up health data for removed connections
   */
  cleanupHealthData(connectionId: string): void {
    this.healthChecks.delete(connectionId);
    this.connectionMetrics.delete(connectionId);
    this.logger.debug(`Cleaned up health data for connection ${connectionId}`);
  }

  /**
   * Perform health checks for all connections
   */
  private async performHealthChecks(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    const connections = this.connectionPool.getAllConnections();
    this.logger.debug(`Performing health checks for ${connections.length} connections`);
    
    const healthCheckPromises = connections.map(async (connection) => {
      try {
        const result = await this.checkConnection(connection.id);
        
        // Check if connection needs reconnection
        if (!result.isHealthy && result.errorCount >= this.maxConsecutiveFailures) {
          this.logger.warn(`Connection ${connection.id} has ${result.errorCount} consecutive failures, attempting reconnection`);
          await this.attemptReconnection(connection.id);
        }
      } catch (error) {
        this.logger.error(`Health check error for connection ${connection.id}:`, error);
      }
    });

    // Wait for all health checks to complete
    await Promise.allSettled(healthCheckPromises);

    // Clean up health checks for non-existent connections
    const activeConnectionIds = new Set(connections.map(c => c.id));
    for (const connectionId of this.healthChecks.keys()) {
      if (!activeConnectionIds.has(connectionId)) {
        this.cleanupHealthData(connectionId);
      }
    }

    // Log summary statistics periodically
    const stats = this.getHealthStatistics();
    if (stats.totalConnections > 0) {
      this.logger.debug(`Health check summary: ${stats.healthyConnections}/${stats.totalConnections} healthy connections`);
    }
  }

  /**
   * Update connection metrics
   */
  private updateConnectionMetrics(connectionId: string, connectionInfo: any, _responseTime: number): void {
    const existing = this.connectionMetrics.get(connectionId);
    const now = Date.now();
    
    const metrics: ConnectionMetrics = {
      connectionId,
      uptime: now - connectionInfo.createdAt,
      messageCount: existing?.messageCount || 0,
      requestCount: existing?.requestCount || 0,
      clientCount: connectionInfo.clientCount,
      lastActivity: now,
      reconnectionCount: existing?.reconnectionCount || 0
    };

    this.connectionMetrics.set(connectionId, metrics);
  }

  /**
   * Increment reconnection count for a connection
   */
  private incrementReconnectionCount(connectionId: string): void {
    const existing = this.connectionMetrics.get(connectionId);
    if (existing) {
      existing.reconnectionCount++;
      this.connectionMetrics.set(connectionId, existing);
    }
  }
}
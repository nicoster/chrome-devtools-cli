/**
 * Performance Monitor for tracking proxy server metrics
 * 
 * Monitors and logs performance metrics including memory usage,
 * connection counts, message volumes, and system performance.
 */

import { createLogger, Logger } from '../../utils/logger';
import { ConnectionPool } from './ConnectionPool';
import { MessageStore } from './MessageStore';
import * as os from 'os';

export interface PerformanceMetrics {
  timestamp: number;
  uptime: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    heapUtilization: number; // percentage
  };
  system: {
    loadAverage: number[];
    freeMemory: number;
    totalMemory: number;
    memoryUtilization: number; // percentage
    cpuCount: number;
  };
  connections: {
    total: number;
    healthy: number;
    unhealthy: number;
    averageClientCount: number;
    totalClientConnections: number;
  };
  messages: {
    totalConsoleMessages: number;
    totalNetworkRequests: number;
    averageMessagesPerConnection: number;
    averageRequestsPerConnection: number;
  };
  performance: {
    eventLoopDelay?: number;
    gcStats?: {
      totalGCTime: number;
      gcCount: number;
    };
  };
}

export interface PerformanceThresholds {
  memoryUtilizationWarning: number; // percentage
  memoryUtilizationCritical: number; // percentage
  heapUtilizationWarning: number; // percentage
  heapUtilizationCritical: number; // percentage
  connectionCountWarning: number;
  connectionCountCritical: number;
  messageCountWarning: number;
  messageCountCritical: number;
}

export class PerformanceMonitor {
  private logger: Logger;
  private connectionPool: ConnectionPool;
  private messageStore: MessageStore;
  private monitoringInterval?: NodeJS.Timeout;
  private startTime: number;
  private metricsHistory: PerformanceMetrics[] = [];
  private maxHistorySize: number = 100; // Keep last 100 metrics snapshots
  private thresholds: PerformanceThresholds;
  private lastAlertTimes: Map<string, number> = new Map();
  private alertCooldownMs: number = 300000; // 5 minutes between same alerts

  constructor(
    connectionPool: ConnectionPool,
    messageStore: MessageStore,
    thresholds?: Partial<PerformanceThresholds>
  ) {
    this.logger = createLogger({ component: 'PerformanceMonitor' });
    this.connectionPool = connectionPool;
    this.messageStore = messageStore;
    this.startTime = Date.now();
    
    this.thresholds = {
      memoryUtilizationWarning: 80,
      memoryUtilizationCritical: 95,
      heapUtilizationWarning: 80,
      heapUtilizationCritical: 95,
      connectionCountWarning: 50,
      connectionCountCritical: 100,
      messageCountWarning: 10000,
      messageCountCritical: 50000,
      ...thresholds
    };
  }

  /**
   * Start performance monitoring
   */
  start(intervalMs: number = 60000): void {
    if (this.monitoringInterval) {
      this.logger.warn('Performance monitoring is already running');
      return;
    }

    this.logger.info('Starting performance monitoring', {
      intervalMs,
      thresholds: this.thresholds
    });

    // Take initial snapshot
    this.collectMetrics();

    // Start periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);
  }

  /**
   * Stop performance monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      
      this.logger.info('Performance monitoring stopped');
    }
  }

  /**
   * Collect current performance metrics
   */
  collectMetrics(): PerformanceMetrics {
    const now = Date.now();
    const memoryUsage = process.memoryUsage();
    const connections = this.connectionPool.getAllConnections();
    const storageStats = this.messageStore.getStorageStats();
    
    // Calculate system metrics
    const loadAvg = os.loadavg();
    const freeMemory = os.freemem();
    const totalMemory = os.totalmem();
    const memoryUtilization = ((totalMemory - freeMemory) / totalMemory) * 100;
    const heapUtilization = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

    // Calculate connection metrics
    const healthyConnections = connections.filter(c => c.isHealthy).length;
    const totalClientConnections = connections.reduce((sum, c) => sum + c.clientCount, 0);
    const averageClientCount = connections.length > 0 ? totalClientConnections / connections.length : 0;

    // Calculate message metrics
    const averageMessagesPerConnection = connections.length > 0 
      ? storageStats.totalConsoleMessages / connections.length 
      : 0;
    const averageRequestsPerConnection = connections.length > 0 
      ? storageStats.totalNetworkRequests / connections.length 
      : 0;

    const metrics: PerformanceMetrics = {
      timestamp: now,
      uptime: now - this.startTime,
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss,
        heapUtilization
      },
      system: {
        loadAverage: loadAvg,
        freeMemory,
        totalMemory,
        memoryUtilization,
        cpuCount: os.cpus().length
      },
      connections: {
        total: connections.length,
        healthy: healthyConnections,
        unhealthy: connections.length - healthyConnections,
        averageClientCount,
        totalClientConnections
      },
      messages: {
        totalConsoleMessages: storageStats.totalConsoleMessages,
        totalNetworkRequests: storageStats.totalNetworkRequests,
        averageMessagesPerConnection,
        averageRequestsPerConnection
      },
      performance: {}
    };

    // Store metrics in history
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }

    // Log performance metrics
    this.logger.logPerformanceMetrics('PerformanceMonitor', {
      uptime: metrics.uptime,
      memoryUtilization: metrics.system.memoryUtilization,
      heapUtilization: metrics.memory.heapUtilization,
      connectionCount: metrics.connections.total,
      messageCount: metrics.messages.totalConsoleMessages,
      requestCount: metrics.messages.totalNetworkRequests,
      loadAverage: metrics.system.loadAverage[0]
    });

    // Check thresholds and generate alerts
    this.checkThresholds(metrics);

    return metrics;
  }

  /**
   * Check performance thresholds and generate alerts
   */
  private checkThresholds(metrics: PerformanceMetrics): void {

    // Memory utilization alerts
    if (metrics.system.memoryUtilization >= this.thresholds.memoryUtilizationCritical) {
      this.sendAlert('memory-critical', 'Critical system memory utilization', {
        utilization: metrics.system.memoryUtilization,
        threshold: this.thresholds.memoryUtilizationCritical,
        freeMemory: metrics.system.freeMemory,
        totalMemory: metrics.system.totalMemory
      });
    } else if (metrics.system.memoryUtilization >= this.thresholds.memoryUtilizationWarning) {
      this.sendAlert('memory-warning', 'High system memory utilization', {
        utilization: metrics.system.memoryUtilization,
        threshold: this.thresholds.memoryUtilizationWarning,
        freeMemory: metrics.system.freeMemory,
        totalMemory: metrics.system.totalMemory
      });
    }

    // Heap utilization alerts
    if (metrics.memory.heapUtilization >= this.thresholds.heapUtilizationCritical) {
      this.sendAlert('heap-critical', 'Critical heap memory utilization', {
        utilization: metrics.memory.heapUtilization,
        threshold: this.thresholds.heapUtilizationCritical,
        heapUsed: metrics.memory.heapUsed,
        heapTotal: metrics.memory.heapTotal
      });
    } else if (metrics.memory.heapUtilization >= this.thresholds.heapUtilizationWarning) {
      this.sendAlert('heap-warning', 'High heap memory utilization', {
        utilization: metrics.memory.heapUtilization,
        threshold: this.thresholds.heapUtilizationWarning,
        heapUsed: metrics.memory.heapUsed,
        heapTotal: metrics.memory.heapTotal
      });
    }

    // Connection count alerts
    if (metrics.connections.total >= this.thresholds.connectionCountCritical) {
      this.sendAlert('connections-critical', 'Critical number of connections', {
        connectionCount: metrics.connections.total,
        threshold: this.thresholds.connectionCountCritical,
        healthyConnections: metrics.connections.healthy,
        totalClientConnections: metrics.connections.totalClientConnections
      });
    } else if (metrics.connections.total >= this.thresholds.connectionCountWarning) {
      this.sendAlert('connections-warning', 'High number of connections', {
        connectionCount: metrics.connections.total,
        threshold: this.thresholds.connectionCountWarning,
        healthyConnections: metrics.connections.healthy,
        totalClientConnections: metrics.connections.totalClientConnections
      });
    }

    // Message count alerts
    const totalMessages = metrics.messages.totalConsoleMessages + metrics.messages.totalNetworkRequests;
    if (totalMessages >= this.thresholds.messageCountCritical) {
      this.sendAlert('messages-critical', 'Critical number of stored messages', {
        totalMessages,
        threshold: this.thresholds.messageCountCritical,
        consoleMessages: metrics.messages.totalConsoleMessages,
        networkRequests: metrics.messages.totalNetworkRequests
      });
    } else if (totalMessages >= this.thresholds.messageCountWarning) {
      this.sendAlert('messages-warning', 'High number of stored messages', {
        totalMessages,
        threshold: this.thresholds.messageCountWarning,
        consoleMessages: metrics.messages.totalConsoleMessages,
        networkRequests: metrics.messages.totalNetworkRequests
      });
    }
  }

  /**
   * Send alert with cooldown to prevent spam
   */
  private sendAlert(alertType: string, message: string, data: any): void {
    const now = Date.now();
    const lastAlert = this.lastAlertTimes.get(alertType);
    
    if (!lastAlert || (now - lastAlert) >= this.alertCooldownMs) {
      this.logger.warn(`[PERFORMANCE ALERT] ${message}`, data);
      this.lastAlertTimes.set(alertType, now);
    }
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metricsHistory.length > 0 
      ? this.metricsHistory[this.metricsHistory.length - 1] 
      : null;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(count?: number): PerformanceMetrics[] {
    if (count && count < this.metricsHistory.length) {
      return this.metricsHistory.slice(-count);
    }
    return [...this.metricsHistory];
  }

  /**
   * Get performance summary over time period
   */
  getPerformanceSummary(periodMs: number = 3600000): {
    averageMemoryUtilization: number;
    averageHeapUtilization: number;
    averageConnectionCount: number;
    averageMessageCount: number;
    peakMemoryUtilization: number;
    peakConnectionCount: number;
    alertCount: number;
  } {
    const now = Date.now();
    const cutoff = now - periodMs;
    const recentMetrics = this.metricsHistory.filter(m => m.timestamp >= cutoff);
    
    if (recentMetrics.length === 0) {
      return {
        averageMemoryUtilization: 0,
        averageHeapUtilization: 0,
        averageConnectionCount: 0,
        averageMessageCount: 0,
        peakMemoryUtilization: 0,
        peakConnectionCount: 0,
        alertCount: 0
      };
    }

    const avgMemoryUtilization = recentMetrics.reduce((sum, m) => sum + m.system.memoryUtilization, 0) / recentMetrics.length;
    const avgHeapUtilization = recentMetrics.reduce((sum, m) => sum + m.memory.heapUtilization, 0) / recentMetrics.length;
    const avgConnectionCount = recentMetrics.reduce((sum, m) => sum + m.connections.total, 0) / recentMetrics.length;
    const avgMessageCount = recentMetrics.reduce((sum, m) => sum + m.messages.totalConsoleMessages + m.messages.totalNetworkRequests, 0) / recentMetrics.length;
    
    const peakMemoryUtilization = Math.max(...recentMetrics.map(m => m.system.memoryUtilization));
    const peakConnectionCount = Math.max(...recentMetrics.map(m => m.connections.total));
    
    // Count alerts in the period (approximate based on cooldown)
    const alertCount = Math.floor(periodMs / this.alertCooldownMs) * this.lastAlertTimes.size;

    return {
      averageMemoryUtilization: avgMemoryUtilization,
      averageHeapUtilization: avgHeapUtilization,
      averageConnectionCount: avgConnectionCount,
      averageMessageCount: avgMessageCount,
      peakMemoryUtilization,
      peakConnectionCount,
      alertCount
    };
  }

  /**
   * Update performance thresholds
   */
  updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    this.logger.info('Performance thresholds updated', { thresholds: this.thresholds });
  }

  /**
   * Clear metrics history
   */
  clearHistory(): void {
    this.metricsHistory = [];
    this.lastAlertTimes.clear();
    this.logger.info('Performance metrics history cleared');
  }
}
/**
 * Message Store for accumulating console messages and network requests
 * 
 * This class stores and manages console messages and network requests
 * captured from CDP connections, with memory management and filtering.
 */

import { 
  StoredConsoleMessage, 
  StoredNetworkRequest, 
  ConsoleMessageFilter, 
  NetworkRequestFilter,
  StackFrame
} from '../types/ProxyTypes';
import { Logger } from '../../utils/logger';

export class MessageStore {
  private consoleMessages: Map<string, StoredConsoleMessage[]> = new Map();
  private networkRequests: Map<string, StoredNetworkRequest[]> = new Map();
  private maxConsoleMessages: number;
  private maxNetworkRequests: number;
  private logger: Logger;

  constructor(maxConsoleMessages: number = 1000, maxNetworkRequests: number = 500) {
    this.maxConsoleMessages = maxConsoleMessages;
    this.maxNetworkRequests = maxNetworkRequests;
    this.logger = new Logger();
  }

  // ============================================================================
  // Console Message Methods
  // ============================================================================

  /**
   * Add a console message to storage
   */
  addConsoleMessage(connectionId: string, message: StoredConsoleMessage): void {
    if (!this.consoleMessages.has(connectionId)) {
      this.consoleMessages.set(connectionId, []);
    }

    const messages = this.consoleMessages.get(connectionId)!;
    messages.push(message);

    // Enforce memory limits using FIFO
    if (messages.length > this.maxConsoleMessages) {
      const removed = messages.splice(0, messages.length - this.maxConsoleMessages);
      this.logger.debug(`Removed ${removed.length} old console messages for connection ${connectionId}`);
    }

    this.logger.debug(`Added console message (${message.type}) for connection ${connectionId}: ${message.text.substring(0, 100)}`);
  }

  /**
   * Get console messages with optional filtering
   */
  getConsoleMessages(connectionId: string, filter?: ConsoleMessageFilter): StoredConsoleMessage[] {
    const messages = this.consoleMessages.get(connectionId) || [];
    
    if (!filter) {
      return [...messages];
    }

    let filteredMessages = [...messages];

    // Filter by message types
    if (filter.types && filter.types.length > 0) {
      filteredMessages = filteredMessages.filter(msg => 
        filter.types!.includes(msg.type)
      );
    }

    // Filter by text pattern
    if (filter.textPattern) {
      const pattern = new RegExp(filter.textPattern, 'i');
      filteredMessages = filteredMessages.filter(msg => 
        pattern.test(msg.text)
      );
    }

    // Filter by source
    if (filter.source) {
      filteredMessages = filteredMessages.filter(msg => 
        msg.source === filter.source
      );
    }

    // Filter by time range
    if (filter.startTime) {
      filteredMessages = filteredMessages.filter(msg => 
        msg.timestamp >= filter.startTime!
      );
    }

    if (filter.endTime) {
      filteredMessages = filteredMessages.filter(msg => 
        msg.timestamp <= filter.endTime!
      );
    }

    // Limit number of messages (take most recent)
    if (filter.maxMessages && filter.maxMessages > 0) {
      filteredMessages = filteredMessages.slice(-filter.maxMessages);
    }

    return filteredMessages;
  }

  /**
   * Get the latest console message with optional filtering
   */
  getLatestConsoleMessage(connectionId: string, filter?: ConsoleMessageFilter): StoredConsoleMessage | null {
    const messages = this.getConsoleMessages(connectionId, filter);
    return messages.length > 0 ? messages[messages.length - 1] : null;
  }

  /**
   * Clear all console messages for a connection
   */
  clearConsoleMessages(connectionId: string): void {
    this.consoleMessages.delete(connectionId);
    this.logger.debug(`Cleared console messages for connection ${connectionId}`);
  }

  /**
   * Get console message count for a connection
   */
  getConsoleMessageCount(connectionId: string, filter?: ConsoleMessageFilter): number {
    return this.getConsoleMessages(connectionId, filter).length;
  }

  // ============================================================================
  // Network Request Methods
  // ============================================================================

  /**
   * Add a network request to storage
   */
  addNetworkRequest(connectionId: string, request: StoredNetworkRequest): void {
    if (!this.networkRequests.has(connectionId)) {
      this.networkRequests.set(connectionId, []);
    }

    const requests = this.networkRequests.get(connectionId)!;
    requests.push(request);

    // Enforce memory limits using FIFO
    if (requests.length > this.maxNetworkRequests) {
      const removed = requests.splice(0, requests.length - this.maxNetworkRequests);
      this.logger.debug(`Removed ${removed.length} old network requests for connection ${connectionId}`);
    }

    this.logger.debug(`Added network request for connection ${connectionId}: ${request.method} ${request.url}`);
  }

  /**
   * Update an existing network request (for response data)
   */
  updateNetworkRequest(connectionId: string, requestId: string, update: Partial<StoredNetworkRequest>): void {
    const requests = this.networkRequests.get(connectionId);
    if (!requests) {
      return;
    }

    const request = requests.find(r => r.requestId === requestId);
    if (request) {
      Object.assign(request, update);
      this.logger.debug(`Updated network request ${requestId} for connection ${connectionId}`);
    }
  }

  /**
   * Get network requests with optional filtering
   */
  getNetworkRequests(connectionId: string, filter?: NetworkRequestFilter): StoredNetworkRequest[] {
    const requests = this.networkRequests.get(connectionId) || [];
    
    if (!filter) {
      return [...requests];
    }

    let filteredRequests = [...requests];

    // Filter by HTTP methods
    if (filter.methods && filter.methods.length > 0) {
      filteredRequests = filteredRequests.filter(req => 
        filter.methods!.includes(req.method.toUpperCase())
      );
    }

    // Filter by status codes
    if (filter.statusCodes && filter.statusCodes.length > 0) {
      filteredRequests = filteredRequests.filter(req => 
        req.status && filter.statusCodes!.includes(req.status)
      );
    }

    // Filter by URL pattern
    if (filter.urlPattern) {
      const pattern = new RegExp(filter.urlPattern, 'i');
      filteredRequests = filteredRequests.filter(req => 
        pattern.test(req.url)
      );
    }

    // Filter by time range
    if (filter.startTime) {
      filteredRequests = filteredRequests.filter(req => 
        req.timestamp >= filter.startTime!
      );
    }

    if (filter.endTime) {
      filteredRequests = filteredRequests.filter(req => 
        req.timestamp <= filter.endTime!
      );
    }

    // Exclude response body if not requested
    if (!filter.includeResponseBody) {
      filteredRequests = filteredRequests.map(req => ({
        ...req,
        responseBody: undefined
      }));
    }

    // Limit number of requests (take most recent)
    if (filter.maxRequests && filter.maxRequests > 0) {
      filteredRequests = filteredRequests.slice(-filter.maxRequests);
    }

    return filteredRequests;
  }

  /**
   * Get the latest network request with optional filtering
   */
  getLatestNetworkRequest(connectionId: string, filter?: NetworkRequestFilter): StoredNetworkRequest | null {
    const requests = this.getNetworkRequests(connectionId, filter);
    return requests.length > 0 ? requests[requests.length - 1] : null;
  }

  /**
   * Clear all network requests for a connection
   */
  clearNetworkRequests(connectionId: string): void {
    this.networkRequests.delete(connectionId);
    this.logger.debug(`Cleared network requests for connection ${connectionId}`);
  }

  /**
   * Get network request count for a connection
   */
  getNetworkRequestCount(connectionId: string, filter?: NetworkRequestFilter): number {
    return this.getNetworkRequests(connectionId, filter).length;
  }

  // ============================================================================
  // General Methods
  // ============================================================================

  /**
   * Clear all data for a specific connection
   */
  cleanupConnection(connectionId: string): void {
    this.clearConsoleMessages(connectionId);
    this.clearNetworkRequests(connectionId);
    this.logger.info(`Cleaned up all data for connection ${connectionId}`);
  }

  /**
   * Clear all stored data
   */
  clearAll(): void {
    this.consoleMessages.clear();
    this.networkRequests.clear();
    this.logger.info('Cleared all stored messages and requests');
  }

  /**
   * Enforce memory limits across all connections
   */
  enforceMemoryLimits(): void {
    let totalConsoleMessages = 0;
    let totalNetworkRequests = 0;

    // Count total messages
    for (const messages of this.consoleMessages.values()) {
      totalConsoleMessages += messages.length;
    }

    for (const requests of this.networkRequests.values()) {
      totalNetworkRequests += requests.length;
    }

    this.logger.debug(`Memory usage: ${totalConsoleMessages} console messages, ${totalNetworkRequests} network requests`);

    // If we're over global limits, clean up oldest data across all connections
    if (totalConsoleMessages > this.maxConsoleMessages * 2) {
      this.cleanupOldestConsoleMessages();
    }

    if (totalNetworkRequests > this.maxNetworkRequests * 2) {
      this.cleanupOldestNetworkRequests();
    }
  }

  /**
   * Get storage statistics
   */
  getStorageStats() {
    const stats = {
      connections: 0,
      totalConsoleMessages: 0,
      totalNetworkRequests: 0,
      consoleMessagesByConnection: {} as Record<string, number>,
      networkRequestsByConnection: {} as Record<string, number>
    };

    const connectionIds = new Set([
      ...this.consoleMessages.keys(),
      ...this.networkRequests.keys()
    ]);

    stats.connections = connectionIds.size;

    for (const connectionId of connectionIds) {
      const consoleCount = this.consoleMessages.get(connectionId)?.length || 0;
      const networkCount = this.networkRequests.get(connectionId)?.length || 0;

      stats.consoleMessagesByConnection[connectionId] = consoleCount;
      stats.networkRequestsByConnection[connectionId] = networkCount;
      stats.totalConsoleMessages += consoleCount;
      stats.totalNetworkRequests += networkCount;
    }

    return stats;
  }

  // ============================================================================
  // Helper Methods for CDP Event Processing
  // ============================================================================

  /**
   * Process Runtime.consoleAPICalled event
   */
  processConsoleAPIEvent(connectionId: string, params: any): void {
    try {
      const message: StoredConsoleMessage = {
        connectionId,
        type: this.mapConsoleType(params.type),
        text: this.formatConsoleArgs(params.args || []),
        args: (params.args || []).map((arg: any) => arg.value || arg.description || ''),
        timestamp: params.timestamp || Date.now(),
        stackTrace: params.stackTrace ? this.convertStackTrace(params.stackTrace.callFrames) : undefined,
        source: 'Runtime.consoleAPICalled'
      };

      this.addConsoleMessage(connectionId, message);
    } catch (error) {
      this.logger.error('Error processing console API event:', error);
    }
  }

  /**
   * Process Log.entryAdded event
   */
  processLogEntryEvent(connectionId: string, params: any): void {
    try {
      const entry = params.entry;
      const message: StoredConsoleMessage = {
        connectionId,
        type: this.mapLogLevel(entry.level),
        text: entry.text || '',
        args: [entry.text || ''],
        timestamp: entry.timestamp || Date.now(),
        stackTrace: entry.url && entry.lineNumber ? [{
          functionName: '<unknown>',
          url: entry.url,
          lineNumber: entry.lineNumber,
          columnNumber: 0
        }] : undefined,
        source: 'Log.entryAdded'
      };

      this.addConsoleMessage(connectionId, message);
    } catch (error) {
      this.logger.error('Error processing log entry event:', error);
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Map CDP console type to our console message type
   */
  private mapConsoleType(cdpType: string): 'log' | 'info' | 'warn' | 'error' | 'debug' {
    switch (cdpType) {
      case 'log': return 'log';
      case 'info': return 'info';
      case 'warning': return 'warn';
      case 'error': return 'error';
      case 'debug': return 'debug';
      default: return 'log';
    }
  }

  /**
   * Map Log domain level to our console message type
   */
  private mapLogLevel(logLevel: string): 'log' | 'info' | 'warn' | 'error' | 'debug' {
    switch (logLevel.toLowerCase()) {
      case 'verbose':
      case 'info': return 'info';
      case 'warning': return 'warn';
      case 'error': return 'error';
      default: return 'log';
    }
  }

  /**
   * Format console arguments into a readable string
   */
  private formatConsoleArgs(args: any[]): string {
    return args.map(arg => {
      if (arg.value !== undefined) {
        if (typeof arg.value === 'string') {
          return arg.value;
        }
        return JSON.stringify(arg.value);
      }
      return arg.description || '';
    }).join(' ');
  }

  /**
   * Convert CDP stack trace to our format
   */
  private convertStackTrace(callFrames: any[]): StackFrame[] {
    return callFrames.map(frame => ({
      functionName: frame.functionName || '<anonymous>',
      url: frame.url,
      lineNumber: frame.lineNumber,
      columnNumber: frame.columnNumber
    }));
  }

  /**
   * Clean up oldest console messages across all connections
   */
  private cleanupOldestConsoleMessages(): void {
    // Find the connection with the most messages and remove some
    let maxMessages = 0;
    let connectionToCleanup = '';

    for (const [connectionId, messages] of this.consoleMessages) {
      if (messages.length > maxMessages) {
        maxMessages = messages.length;
        connectionToCleanup = connectionId;
      }
    }

    if (connectionToCleanup) {
      const messages = this.consoleMessages.get(connectionToCleanup)!;
      const toRemove = Math.floor(messages.length * 0.2); // Remove 20%
      messages.splice(0, toRemove);
      this.logger.info(`Cleaned up ${toRemove} old console messages from connection ${connectionToCleanup}`);
    }
  }

  /**
   * Clean up oldest network requests across all connections
   */
  private cleanupOldestNetworkRequests(): void {
    // Find the connection with the most requests and remove some
    let maxRequests = 0;
    let connectionToCleanup = '';

    for (const [connectionId, requests] of this.networkRequests) {
      if (requests.length > maxRequests) {
        maxRequests = requests.length;
        connectionToCleanup = connectionId;
      }
    }

    if (connectionToCleanup) {
      const requests = this.networkRequests.get(connectionToCleanup)!;
      const toRemove = Math.floor(requests.length * 0.2); // Remove 20%
      requests.splice(0, toRemove);
      this.logger.info(`Cleaned up ${toRemove} old network requests from connection ${connectionToCleanup}`);
    }
  }
}
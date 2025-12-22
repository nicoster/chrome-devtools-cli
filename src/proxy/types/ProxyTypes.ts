/**
 * Type definitions for the Persistent Connection Proxy Server
 */

import { WebSocket } from 'ws';

// ============================================================================
// Configuration Types
// ============================================================================

export interface ProxyServerConfig {
  port: number;                    // Server port (default: 9223)
  host: string;                    // Bind host (default: localhost)
  maxConsoleMessages: number;      // Max console messages per connection (default: 1000)
  maxNetworkRequests: number;      // Max network requests per connection (default: 500)
  autoShutdownTimeout: number;     // Auto shutdown timeout in ms (default: 300000)
  reconnectMaxAttempts: number;    // Max reconnection attempts (default: 5)
  reconnectBackoffMs: number;      // Initial reconnection backoff (default: 1000)
  healthCheckInterval: number;     // Health check interval in ms (default: 30000)
}

export interface ProxyClientConfig {
  proxyUrl: string;               // Proxy server URL (default: http://localhost:9223)
  fallbackToDirect: boolean;      // Fall back to direct CDP if proxy unavailable
  startProxyIfNeeded: boolean;    // Auto-start proxy server if not running
}

// ============================================================================
// Connection Management Types
// ============================================================================

export interface CDPConnectionInfo {
  id: string;                      // Unique connection ID
  host: string;                    // Chrome host
  port: number;                    // Chrome port
  targetId: string;                // Chrome target ID
  wsUrl: string;                   // WebSocket URL
  connection: WebSocket;           // Actual CDP connection
  createdAt: number;               // Creation timestamp
  lastUsed: number;                // Last usage timestamp
  isHealthy: boolean;              // Connection health status
  clientCount: number;             // Number of connected CLI clients
}

export interface ProxyConnectionKey {
  host: string;
  port: number;
  targetId: string;
}

export interface ConnectionMetrics {
  connectionId: string;
  uptime: number;
  messageCount: number;
  requestCount: number;
  clientCount: number;
  lastActivity: number;
  reconnectionCount: number;
}

// ============================================================================
// Message Storage Types
// ============================================================================

export interface StoredConsoleMessage {
  connectionId: string;
  type: 'log' | 'info' | 'warn' | 'error' | 'debug';
  text: string;
  args: any[];
  timestamp: number;
  stackTrace?: StackFrame[];
  source: 'Runtime.consoleAPICalled' | 'Log.entryAdded';
}

export interface StoredNetworkRequest {
  connectionId: string;
  requestId: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  timestamp: number;
  status?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  loadingFinished: boolean;
}

export interface StackFrame {
  functionName: string;
  url: string;
  lineNumber: number;
  columnNumber: number;
}

// ============================================================================
// Filtering Types
// ============================================================================

export interface ConsoleMessageFilter {
  types?: Array<'log' | 'info' | 'warn' | 'error' | 'debug'>;
  textPattern?: string;
  maxMessages?: number;
  startTime?: number;
  endTime?: number;
  source?: 'Runtime.consoleAPICalled' | 'Log.entryAdded';
}

export interface NetworkRequestFilter {
  methods?: string[];
  statusCodes?: number[];
  urlPattern?: string;
  maxRequests?: number;
  startTime?: number;
  endTime?: number;
  includeResponseBody?: boolean;
}

// ============================================================================
// API Types
// ============================================================================

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

export interface ConnectRequest {
  host: string;
  port: number;
  targetId?: string;
}

export interface ConnectResponse {
  connectionId: string;
  targetInfo: {
    id: string;
    title: string;
    url: string;
    type: string;
  };
  isNewConnection: boolean;
}

// ============================================================================
// Health Monitoring Types
// ============================================================================

export interface HealthCheckResult {
  connectionId: string;
  isHealthy: boolean;
  lastCheck: number;
  errorCount: number;
  lastError?: string;
}

// ============================================================================
// WebSocket Proxy Types
// ============================================================================

export interface ProxyWebSocketConnection {
  id: string;
  clientWs: WebSocket;
  connectionId: string;
  createdAt: number;
  messageCount: number;
}

// ============================================================================
// Browser Target Types (from existing codebase)
// ============================================================================

export interface BrowserTarget {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl?: string;
}
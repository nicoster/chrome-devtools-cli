# Design Document: Persistent Connection Proxy Server

## Overview

The Persistent Connection Proxy Server is a local HTTP server that solves the console monitoring historical messages problem by maintaining continuous CDP connections and accumulating console messages and network requests. The proxy server acts as an intermediary between chrome-cdp-cli processes and Chrome browser instances, enabling true connection sharing and complete historical data access.

**Core Design Principles:**
- **Connection Persistence**: Maintain CDP connections across multiple CLI command executions
- **Message Accumulation**: Capture and store all console messages and network requests from connection establishment
- **Transparent Integration**: Work seamlessly with existing chrome-cdp-cli commands
- **Resource Efficiency**: Manage memory usage and automatically clean up unused connections
- **Fault Tolerance**: Handle connection failures and automatically recover

## Architecture

The system uses a proxy server architecture with the following components:

```
┌─────────────────────────────────────────┐
│  chrome-cdp-cli (Process 1, 2, 3...)   │
│  └─> HTTP API → Proxy Server           │
└─────────────────────────────────────────┘
              ↓ (HTTP)
┌─────────────────────────────────────────┐
│  Proxy Server (localhost:9223)         │
│  ├─ HTTP API Server                     │
│  ├─ Command Execution Service           │
│  ├─ CDP Connection Pool                 │
│  ├─ Message Store                       │
│  └─ Health Monitor                      │
└─────────────────────────────────────────┘
              ↓ (WebSocket CDP)
┌─────────────────────────────────────────┐
│  Chrome DevTools Protocol              │
│  └─ Actual CDP Connections             │
└─────────────────────────────────────────┘
```

### Component Interaction Flow

```
1. CLI Command Execution:
   CLI → Check Proxy Running → Start if Needed → Connect to Proxy

2. Connection Management:
   Proxy → Discover Chrome Targets → Create/Reuse CDP Connection → Start Monitoring

3. Message Capture:
   Chrome → CDP Events → Proxy → Store in Memory → Serve to CLI

4. Command Execution:
   CLI → HTTP POST → Command Execution Service → CDP → Chrome → Response → CLI
```

## Components and Interfaces

### 1. Proxy Server Core (CDPProxyServer)

The main server component that orchestrates all proxy functionality.

```typescript
interface ProxyServerConfig {
  port: number;                    // Server port (default: 9223)
  host: string;                    // Bind host (default: localhost)
  maxConsoleMessages: number;      // Max console messages per connection (default: 1000)
  maxNetworkRequests: number;      // Max network requests per connection (default: 500)
  autoShutdownTimeout: number;     // Auto shutdown timeout in ms (default: 300000)
  reconnectMaxAttempts: number;    // Max reconnection attempts (default: 5)
  reconnectBackoffMs: number;      // Initial reconnection backoff (default: 1000)
}

class CDPProxyServer {
  private config: ProxyServerConfig;
  private httpServer: express.Application;
  private wsServer: WebSocketServer;
  private connectionPool: ConnectionPool;
  private messageStore: MessageStore;
  private healthMonitor: HealthMonitor;
  
  async start(config?: Partial<ProxyServerConfig>): Promise<void>;
  async stop(): Promise<void>;
  async getConnection(host: string, port: number, targetId?: string): Promise<string>;
  async closeConnection(connectionId: string): Promise<void>;
}
```

### 2. Connection Pool (ConnectionPool)

Manages persistent CDP connections and their lifecycle.

```typescript
interface CDPConnectionInfo {
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

class ConnectionPool {
  private connections: Map<string, CDPConnectionInfo> = new Map();
  private connectionsByKey: Map<string, string> = new Map(); // host:port:targetId -> connectionId
  
  async getOrCreateConnection(host: string, port: number, targetId: string): Promise<CDPConnectionInfo>;
  async closeConnection(connectionId: string): Promise<void>;
  async healthCheck(connectionId: string): Promise<boolean>;
  async reconnect(connectionId: string): Promise<boolean>;
  getConnectionInfo(connectionId: string): CDPConnectionInfo | null;
  getAllConnections(): CDPConnectionInfo[];
  cleanupUnusedConnections(maxIdleTime: number): Promise<void>;
}
```

### 3. Message Store (MessageStore)

Stores and manages accumulated console messages and network requests.

```typescript
interface StoredConsoleMessage {
  connectionId: string;
  type: 'log' | 'info' | 'warn' | 'error' | 'debug';
  text: string;
  args: any[];
  timestamp: number;
  stackTrace?: StackFrame[];
  source: 'Runtime.consoleAPICalled' | 'Log.entryAdded';
}

interface StoredNetworkRequest {
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

class MessageStore {
  private consoleMessages: Map<string, StoredConsoleMessage[]> = new Map();
  private networkRequests: Map<string, StoredNetworkRequest[]> = new Map();
  private maxConsoleMessages: number;
  private maxNetworkRequests: number;
  
  // Console message methods
  addConsoleMessage(connectionId: string, message: StoredConsoleMessage): void;
  getConsoleMessages(connectionId: string, filter?: ConsoleMessageFilter): StoredConsoleMessage[];
  getLatestConsoleMessage(connectionId: string, filter?: ConsoleMessageFilter): StoredConsoleMessage | null;
  clearConsoleMessages(connectionId: string): void;
  
  // Network request methods
  addNetworkRequest(connectionId: string, request: StoredNetworkRequest): void;
  updateNetworkRequest(connectionId: string, requestId: string, update: Partial<StoredNetworkRequest>): void;
  getNetworkRequests(connectionId: string, filter?: NetworkRequestFilter): StoredNetworkRequest[];
  getLatestNetworkRequest(connectionId: string, filter?: NetworkRequestFilter): StoredNetworkRequest | null;
  clearNetworkRequests(connectionId: string): void;
  
  // Cleanup methods
  cleanupConnection(connectionId: string): void;
  enforceMemoryLimits(): void;
}
```

### 4. Health Monitor (HealthMonitor)

Monitors connection health and handles automatic reconnection.

```typescript
interface HealthCheckResult {
  connectionId: string;
  isHealthy: boolean;
  lastCheck: number;
  errorCount: number;
  lastError?: string;
}

class HealthMonitor {
  private healthChecks: Map<string, HealthCheckResult> = new Map();
  private checkInterval: NodeJS.Timeout;
  private connectionPool: ConnectionPool;
  
  start(intervalMs: number = 30000): void;
  stop(): void;
  async checkConnection(connectionId: string): Promise<HealthCheckResult>;
  async attemptReconnection(connectionId: string): Promise<boolean>;
  getHealthStatus(connectionId: string): HealthCheckResult | null;
  getAllHealthStatuses(): HealthCheckResult[];
}
```

### 5. HTTP API Server (ProxyAPIServer)

Provides REST API endpoints for connection management and data retrieval.

```typescript
interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

interface ConnectRequest {
  host: string;
  port: number;
  targetId?: string;
}

interface ConnectResponse {
  connectionId: string;
  targetInfo: {
    id: string;
    title: string;
    url: string;
    type: string;
  };
  isNewConnection: boolean;
}

class ProxyAPIServer {
  private app: express.Application;
  private connectionPool: ConnectionPool;
  private messageStore: MessageStore;
  
  // API Endpoints
  async handleConnect(req: Request<{}, APIResponse<ConnectResponse>, ConnectRequest>): Promise<void>;
  async handleGetConsoleMessages(req: Request<{connectionId: string}>): Promise<void>;
  async handleGetNetworkRequests(req: Request<{connectionId: string}>): Promise<void>;
  async handleHealthCheck(req: Request<{connectionId: string}>): Promise<void>;
  async handleCloseConnection(req: Request<{connectionId: string}>): Promise<void>;
  async handleServerStatus(req: Request): Promise<void>;
}
```

### 6. Command Execution Service (CommandExecutionService)

Handles HTTP-based command execution using Long Polling approach to avoid WebSocket message routing complexity.

```typescript
interface CommandExecutionRequest {
  connectionId: string;
  command: {
    id: number | string;
    method: string;
    params?: any;
  };
  timeout?: number;
}

interface CommandExecutionResponse {
  success: boolean;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
  executionTime: number;
}

class CommandExecutionService {
  private connectionPool: ConnectionPool;
  private pendingCommands: Map<string, PendingCommand> = new Map();
  
  async executeCommand(request: CommandExecutionRequest): Promise<CommandExecutionResponse>;
  private sendCDPCommand(connectionId: string, command: any): Promise<any>;
  private waitForResponse(commandId: string, timeout: number): Promise<any>;
  cleanup(): void;
}
```

### 7. CLI Integration (ProxyClient)

Client-side integration for chrome-cdp-cli to use the proxy server with HTTP-based command execution.

```typescript
interface ProxyClientConfig {
  proxyUrl: string;               // Proxy server URL (default: http://localhost:9223)
  fallbackToDirect: boolean;      // Fall back to direct CDP if proxy unavailable
  startProxyIfNeeded: boolean;    // Auto-start proxy server if not running
}

class ProxyClient {
  private config: ProxyClientConfig;
  private connectionId?: string;
  
  async ensureProxyRunning(): Promise<boolean>;
  async connect(host: string, port: number, targetId?: string): Promise<string>;
  async getConsoleMessages(filter?: ConsoleMessageFilter): Promise<StoredConsoleMessage[]>;
  async getNetworkRequests(filter?: NetworkRequestFilter): Promise<StoredNetworkRequest[]>;
  async executeCommand(command: any, timeout?: number): Promise<any>;
  async healthCheck(): Promise<boolean>;
  async disconnect(): Promise<void>;
}
```

## Data Models

### Connection Management

```typescript
interface ProxyConnectionKey {
  host: string;
  port: number;
  targetId: string;
}

interface ConnectionMetrics {
  connectionId: string;
  uptime: number;
  messageCount: number;
  requestCount: number;
  clientCount: number;
  lastActivity: number;
  reconnectionCount: number;
}
```

### Command Execution

```typescript
interface PendingCommand {
  id: string;
  connectionId: string;
  command: any;
  timestamp: number;
  timeout: number;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
}

interface CommandExecutionMetrics {
  totalCommands: number;
  successfulCommands: number;
  failedCommands: number;
  averageExecutionTime: number;
  timeoutCount: number;
}
```

### Message Filtering

```typescript
interface ConsoleMessageFilter {
  types?: Array<'log' | 'info' | 'warn' | 'error' | 'debug'>;
  textPattern?: string;
  maxMessages?: number;
  startTime?: number;
  endTime?: number;
  source?: 'Runtime.consoleAPICalled' | 'Log.entryAdded';
}

interface NetworkRequestFilter {
  methods?: string[];
  statusCodes?: number[];
  urlPattern?: string;
  maxRequests?: number;
  startTime?: number;
  endTime?: number;
  includeResponseBody?: boolean;
}
```

### Configuration

```typescript
interface ProxyConfiguration {
  server: {
    port: number;
    host: string;
    autoShutdownTimeout: number;
  };
  connections: {
    maxConsoleMessages: number;
    maxNetworkRequests: number;
    reconnectMaxAttempts: number;
    reconnectBackoffMs: number;
    healthCheckInterval: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    file?: string;
    maxFileSize?: number;
  };
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Connection Persistence Across CLI Processes
*For any* valid Chrome target, when multiple CLI processes connect to the same target through the proxy, they should all share the same underlying CDP connection and receive the same accumulated historical data
**Validates: Requirements 2.5, 9.2**

### Property 2: Message Accumulation Completeness
*For any* console message generated in Chrome after proxy connection establishment, that message should be retrievable through the proxy API regardless of when the CLI client requests it
**Validates: Requirements 3.1, 3.2, 3.3**

### Property 3: Network Request Capture Completeness
*For any* network request initiated by Chrome after proxy connection establishment, that request should be captured and retrievable through the proxy API with complete request/response information
**Validates: Requirements 4.1, 4.2, 4.3**

### Property 4: Proxy Server Auto-Start Reliability
*For any* CLI command execution when no proxy server is running, the proxy server should start successfully and be ready to accept connections within the specified timeout
**Validates: Requirements 1.1, 1.2, 9.1**

### Property 5: Connection Health Recovery
*For any* CDP connection that becomes unhealthy, the proxy server should detect the failure and either successfully reconnect or properly clean up the connection within the configured timeout
**Validates: Requirements 7.1, 7.2, 7.3**

### Property 6: Memory Management Bounds
*For any* proxy server instance running for extended periods, the memory usage should remain bounded by the configured limits through proper cleanup of old messages and requests
**Validates: Requirements 8.1, 8.2, 8.3**

### Property 7: API Response Consistency
*For any* valid API request to the proxy server, the response should follow the defined APIResponse format and include appropriate success/error information
**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

### Property 8: HTTP Command Execution Reliability
*For any* CDP command sent through the HTTP command execution endpoint, the command should be forwarded to Chrome and the response should be returned to the CLI client without modification, with proper timeout handling
**Validates: Requirements 6.1, 6.2, 6.3**

### Property 9: Configuration Override Consistency
*For any* valid configuration provided to the proxy server, all server behavior should respect the configured values instead of defaults
**Validates: Requirements 10.1, 10.2, 10.3, 10.4**

### Property 10: Historical Data Distinction
*For any* CLI request for console messages or network requests through the proxy, the response should clearly indicate that historical data is included and distinguish it from new data
**Validates: Requirements 9.4, 9.5**

### Property 11: Connection Cleanup Completeness
*For any* connection that is closed or becomes invalid, all associated stored data (console messages, network requests, health status) should be completely removed from memory
**Validates: Requirements 2.4, 8.3**

### Property 12: Fallback Behavior Consistency
*For any* CLI command when the proxy server is unavailable, the CLI should fall back to direct CDP connections and provide appropriate warnings about limited historical data
**Validates: Requirements 9.3**

## Error Handling

### Proxy Server Errors

**Startup Failures:**
- **Port Already in Use**: Detect port conflicts and suggest alternative ports or identify conflicting processes
- **Permission Denied**: Handle cases where binding to the specified port is not allowed
- **Configuration Errors**: Validate configuration and provide specific error messages for invalid settings

**Runtime Errors:**
- **CDP Connection Failures**: Handle Chrome disconnections, target closures, and protocol errors
- **Memory Exhaustion**: Implement graceful degradation when memory limits are approached
- **WebSocket Proxy Errors**: Handle client disconnections and message forwarding failures

### Connection Management Errors

**Target Discovery Failures:**
- **Chrome Not Running**: Provide clear instructions for starting Chrome with DevTools enabled
- **Invalid Target ID**: Handle cases where specified targets no longer exist
- **Network Connectivity**: Handle network issues between proxy and Chrome instances

**Health Monitoring Errors:**
- **Reconnection Failures**: Implement exponential backoff and eventual connection abandonment
- **Health Check Timeouts**: Handle unresponsive connections and mark them as unhealthy
- **Resource Cleanup**: Ensure proper cleanup when connections cannot be recovered

### API and Client Errors

**HTTP API Errors:**
- **Invalid Request Format**: Validate request bodies and return specific validation errors
- **Connection Not Found**: Handle requests for non-existent connection IDs
- **Rate Limiting**: Implement basic rate limiting to prevent API abuse

**WebSocket Proxy Errors:**
- **Protocol Violations**: Handle malformed CDP messages and protocol errors
- **Client Disconnections**: Clean up proxy connections when clients disconnect unexpectedly
- **Message Buffering**: Handle cases where message forwarding is temporarily blocked

### Recovery Strategies

**Automatic Recovery:**
- **Connection Reconnection**: Use exponential backoff for automatic reconnection attempts
- **Service Restart**: Implement graceful restart capabilities for the proxy server
- **Data Recovery**: Attempt to preserve accumulated data during connection recovery

**Graceful Degradation:**
- **Partial Functionality**: Continue operating with reduced functionality when some components fail
- **Fallback Modes**: Provide fallback to direct CDP connections when proxy is unavailable
- **User Notification**: Clearly communicate service status and limitations to users

## Testing Strategy

### Dual Testing Approach

**Unit Tests:**
- Test individual components (ConnectionPool, MessageStore, HealthMonitor)
- Verify API endpoint behavior with various request formats
- Test error handling and edge cases
- Validate configuration parsing and validation

**Property-Based Tests:**
- Verify connection sharing across multiple CLI processes
- Test message accumulation completeness with random message generation
- Validate memory management under various load conditions
- Test health monitoring and recovery mechanisms

### Property Test Configuration

- **Testing Framework**: Use fast-check for property-based testing in TypeScript
- **Minimum Iterations**: 100 iterations per property test for reliability
- **Tag Format**: **Feature: persistent-connection-proxy, Property {number}: {property_text}**
- **Test Environment**: Requires running Chrome instance and multiple CLI process simulation

### Integration Testing

**End-to-End Scenarios:**
- Start proxy server → Connect multiple CLI clients → Verify message sharing
- Simulate Chrome crashes → Verify reconnection and data preservation
- Test long-running scenarios → Verify memory management and cleanup
- Test concurrent access → Verify thread safety and data consistency

**Performance Testing:**
- **Load Testing**: Test with multiple simultaneous CLI connections
- **Memory Testing**: Monitor memory usage over extended periods
- **Latency Testing**: Measure proxy overhead compared to direct connections
- **Stress Testing**: Test behavior under high message/request volumes

### Mock and Simulation

**Chrome Simulation:**
- Mock CDP WebSocket server for controlled testing
- Simulate various Chrome behaviors (crashes, slow responses, protocol errors)
- Generate realistic console messages and network requests for testing

**CLI Client Simulation:**
- Simulate multiple concurrent CLI processes
- Test various command patterns and usage scenarios
- Verify proper cleanup when CLI processes terminate unexpectedly
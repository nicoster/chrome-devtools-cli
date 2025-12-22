# 持久化连接方案分析

## 需求背景

### 核心问题：Console Log 历史消息无法获取

**问题根源**：当前 `chrome-cdp-cli` 每次执行命令时都会：
1. 创建新的 CDP 连接
2. 开始监控控制台消息（`Runtime.consoleAPICalled` 事件）
3. 执行命令
4. 断开连接并退出

**关键限制**：CDP 的 `Runtime.consoleAPICalled` 事件**只在监控开始后产生的新消息时触发**。这意味着：
- ❌ 无法获取页面加载时产生的历史消息
- ❌ 无法获取连接建立前的控制台输出
- ❌ 每次命令都是"全新开始"，无法累积消息

**解决方案**：通过持久化连接，让监控从页面加载或连接建立的第一刻就开始，从而能够捕获所有控制台消息。

## 需求描述

实现一个持久化连接机制，**核心目标是解决控制台监控的历史消息问题**：

1. **第一次运行** `chrome-cdp-cli` 时，检测到页面就建立连接并开始监控
2. **连接保持**：只要页面存在，连接就一直有效，监控持续进行
3. **连接复用**：后续执行的 `chrome-cdp-cli` 命令都使用这个已存在的连接
4. **消息累积**：所有控制台消息都被持久化存储，可以查询历史消息

## 当前架构分析

### 现有连接模式

```
每次命令执行：
1. 解析命令行参数
2. 创建新的 CDP 连接
3. 开始监控控制台（Runtime.consoleAPICalled）
4. 执行命令
5. 返回结果（只能获取步骤 3-4 之间的新消息）
6. 断开连接并退出
```

**问题**：
- 每次命令都是独立的进程
- 无法在不同进程间共享连接状态
- 无法保持连接持久化
- **无法获取历史控制台消息**（核心问题）

### Console Log 问题的具体表现

**时间线示例**：
```
T1: 页面加载，产生 console.log("页面已加载")
T2: 用户交互，产生 console.warn("警告信息")
T3: 运行 chrome-cdp-cli list_console_messages
    ↳ 创建新连接
    ↳ 开始监控（只能捕获 T3 之后的消息）
    ↳ 立即查询消息（返回空，因为 T3 后没有新消息）
    ↳ 断开连接
```

**结果**：即使浏览器控制台中有很多历史消息，CLI 工具也返回空结果。

**持久化连接解决方案**：
```
T1: 页面加载，产生 console.log("页面已加载")
    ↳ 持久化连接已建立并监控
    ↳ 消息被捕获并存储 ✅
    
T2: 用户交互，产生 console.warn("警告信息")
    ↳ 消息被捕获并存储 ✅
    
T3: 运行 chrome-cdp-cli list_console_messages
    ↳ 使用已存在的持久化连接
    ↳ 查询存储的所有消息（包括 T1, T2 的消息）✅
    ↳ 返回完整历史
```

## 实现方案分析

### 方案 A：守护进程模式（Daemon Process）

#### 架构设计

```
┌─────────────────────────────────────────┐
│  chrome-cdp-cli (用户命令)              │
│  └─> 检查守护进程是否存在                │
│      ├─> 不存在：启动守护进程            │
│      └─> 已存在：通过 IPC 通信           │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  守护进程 (Daemon)                      │
│  - 保持 CDP 连接                        │
│  - 监听页面状态                         │
│  - 处理命令请求                         │
│  - 维护连接池                           │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Chrome DevTools Protocol (CDP)        │
│  - WebSocket 连接                       │
│  - 持续监听事件                         │
└─────────────────────────────────────────┘
```

#### 实现细节

**1. 守护进程启动**

```typescript
// daemon.ts
class CDPDaemon {
  private connections: Map<string, CDPClient> = new Map();
  private server: IPC_Server;

  async start() {
    // 1. 创建 IPC 服务器
    this.server = new IPCServer({
      path: this.getSocketPath()
    });

    // 2. 监听命令请求
    this.server.on('command', async (command, callback) => {
      const result = await this.executeCommand(command);
      callback(result);
    });

    // 3. 维护连接
    this.maintainConnections();

    // 4. 写入 PID 文件
    await this.writePIDFile();
  }

  private async maintainConnections() {
    setInterval(async () => {
      // 检查所有连接的健康状态
      for (const [targetId, client] of this.connections) {
        if (!client.isConnected()) {
          // 尝试重连
          await this.reconnect(targetId);
        }
      }
    }, 5000);
  }
}
```

**2. CLI 客户端通信**

```typescript
// CLIApplication.ts
class CLIApplication {
  private async ensureConnection(command: CLICommand): Promise<void> {
    // 1. 检查守护进程是否存在
    const daemonRunning = await this.checkDaemonRunning();
    
    if (!daemonRunning) {
      // 启动守护进程
      await this.startDaemon();
      // 等待守护进程就绪
      await this.waitForDaemon();
    }

    // 2. 通过 IPC 获取连接
    const client = await this.getClientFromDaemon();
    this.client = client;
  }

  private async getClientFromDaemon(): Promise<CDPClient> {
    const ipcClient = new IPCClient({
      path: this.getSocketPath()
    });

    // 请求连接
    const connection = await ipcClient.request('getConnection', {
      host: this.config.host,
      port: this.config.port
    });

    return connection;
  }
}
```

**3. IPC 通信协议**

```typescript
// IPC 消息格式
interface IPCMessage {
  type: 'command' | 'getConnection' | 'listConnections';
  payload: unknown;
  requestId: string;
}

// 命令执行请求
interface CommandRequest {
  command: string;
  args: unknown;
  config: CLIConfig;
}

// 连接获取请求
interface ConnectionRequest {
  host: string;
  port: number;
  targetId?: string;
}
```

#### 优点

- ✅ **解决 Console Log 问题**：守护进程从连接建立开始就持续监控，可以捕获所有历史消息
- ✅ **连接持久化**：守护进程保持连接，不随命令结束而断开
- ✅ **状态共享**：所有命令共享同一个连接池和消息存储
- ✅ **消息累积**：控制台消息在守护进程中累积存储，可以查询完整历史
- ✅ **自动重连**：守护进程可以自动检测和恢复断开的连接
- ✅ **性能优化**：避免频繁建立/断开连接的开销

#### 缺点

- ❌ **架构复杂度高**：需要实现守护进程、IPC 通信、进程管理
- ❌ **资源占用**：守护进程持续运行，占用系统资源
- ❌ **跨平台兼容性**：不同操作系统的 IPC 实现不同
- ❌ **调试困难**：守护进程的调试和日志管理复杂

### 方案 B：连接文件锁模式（File Lock）

#### 架构设计

```
┌─────────────────────────────────────────┐
│  chrome-cdp-cli (进程 1)                │
│  └─> 检查连接文件锁                     │
│      ├─> 不存在：创建连接并写入文件     │
│      └─> 已存在：读取连接信息并复用     │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  连接信息文件 (JSON)                    │
│  - 连接状态                             │
│  - WebSocket URL                        │
│  - Target ID                            │
│  - 时间戳                               │
└─────────────────────────────────────────┘
```

#### 实现细节

**1. 连接信息存储**

```typescript
// connection-store.ts
interface ConnectionInfo {
  targetId: string;
  wsUrl: string;
  host: string;
  port: number;
  createdAt: number;
  lastUsed: number;
  pid: number; // 创建连接的进程 ID
}

class ConnectionStore {
  private readonly STORE_PATH = path.join(
    os.homedir(),
    '.chrome-cdp-cli',
    'connections.json'
  );

  async saveConnection(info: ConnectionInfo): Promise<void> {
    // 使用文件锁确保原子性
    const lock = await this.acquireLock();
    try {
      const connections = await this.loadConnections();
      connections[info.targetId] = info;
      await fs.writeFile(this.STORE_PATH, JSON.stringify(connections));
    } finally {
      await lock.release();
    }
  }

  async getConnection(targetId: string): Promise<ConnectionInfo | null> {
    const connections = await this.loadConnections();
    const info = connections[targetId];
    
    // 检查连接是否仍然有效
    if (info && await this.isConnectionValid(info)) {
      return info;
    }
    
    return null;
  }

  private async isConnectionValid(info: ConnectionInfo): Promise<boolean> {
    // 1. 检查进程是否还在运行
    try {
      process.kill(info.pid, 0); // 检查进程是否存在
    } catch {
      return false; // 进程不存在
    }

    // 2. 检查 Chrome 目标是否还存在
    const targets = await this.discoverTargets(info.host, info.port);
    return targets.some(t => t.id === info.targetId);
  }
}
```

**2. CLI 连接管理**

```typescript
// CLIApplication.ts
class CLIApplication {
  private async ensureConnection(command: CLICommand): Promise<void> {
    const store = new ConnectionStore();
    
    // 1. 尝试获取现有连接
    const targets = await this.connectionManager.discoverTargets(
      command.config.host,
      command.config.port
    );
    
    const pageTarget = targets.find(t => t.type === 'page');
    if (!pageTarget) {
      throw new Error('No page targets available');
    }

    // 2. 检查是否有已保存的连接
    const savedConnection = await store.getConnection(pageTarget.id);
    
    if (savedConnection && await this.validateConnection(savedConnection)) {
      // 复用现有连接
      this.client = await this.reuseConnection(savedConnection);
    } else {
      // 创建新连接
      this.client = await this.connectionManager.connectToTarget(pageTarget);
      
      // 保存连接信息
      await store.saveConnection({
        targetId: pageTarget.id,
        wsUrl: pageTarget.webSocketDebuggerUrl!,
        host: command.config.host,
        port: command.config.port,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        pid: process.pid
      });
    }
  }

  private async validateConnection(info: ConnectionInfo): Promise<boolean> {
    // 验证连接是否仍然有效
    try {
      const client = await this.createClientFromInfo(info);
      await client.send('Runtime.enable'); // 测试连接
      return true;
    } catch {
      return false;
    }
  }
}
```

#### 优点

- ✅ **实现简单**：不需要守护进程，只需要文件存储
- ✅ **轻量级**：不占用额外系统资源
- ✅ **跨平台**：文件系统操作跨平台兼容
- ✅ **自动清理**：可以检测无效连接并清理

#### 缺点

- ❌ **无法解决 Console Log 问题**：每个进程仍然需要建立自己的连接，无法获取历史消息
- ❌ **连接不真正持久化**：每个进程仍然需要建立自己的连接
- ❌ **无法共享连接状态**：每个进程的监控器状态独立，消息无法累积
- ❌ **竞态条件**：多个进程同时访问可能有问题
- ⚠️ **部分解决**：只能复用连接信息，不能真正共享连接和消息存储

**结论**：此方案**不适合**解决 Console Log 问题，因为无法真正共享连接和消息状态。

### 方案 C：共享内存 + 连接代理（Shared Memory）

#### 架构设计

```
┌─────────────────────────────────────────┐
│  chrome-cdp-cli (进程 1)                │
│  └─> 检查共享内存中的连接               │
│      ├─> 不存在：创建连接并写入共享内存 │
│      └─> 已存在：通过代理使用连接       │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  连接代理服务器 (可选)                   │
│  - 管理实际 CDP 连接                    │
│  - 提供代理接口                         │
└─────────────────────────────────────────┘
```

#### 实现细节

**1. 共享内存存储**

```typescript
// shared-connection.ts
class SharedConnection {
  private readonly SHM_PATH = '/tmp/chrome-cdp-cli-connection';

  async createConnection(target: BrowserTarget): Promise<void> {
    // 创建共享内存区域
    const shm = await this.createSharedMemory();
    
    // 写入连接信息
    await shm.write({
      targetId: target.id,
      wsUrl: target.webSocketDebuggerUrl,
      pid: process.pid,
      createdAt: Date.now()
    });
  }

  async getConnection(): Promise<ConnectionInfo | null> {
    const shm = await this.openSharedMemory();
    if (!shm) return null;
    
    const info = await shm.read();
    
    // 检查进程是否还在运行
    if (!this.isProcessAlive(info.pid)) {
      await shm.close();
      return null;
    }
    
    return info;
  }
}
```

#### 优点

- ✅ **解决 Console Log 问题**：可以真正共享连接，消息可以累积存储
- ✅ **真正的连接共享**：多个进程可以共享同一个连接
- ✅ **性能好**：共享内存访问速度快

#### 缺点

- ❌ **平台限制**：不同操作系统的共享内存实现不同
- ❌ **复杂度高**：需要处理进程同步和锁机制
- ❌ **调试困难**：共享内存的调试和监控复杂
- ❌ **消息存储复杂**：需要在共享内存中实现消息队列和存储机制

### 方案 D：WebSocket 代理服务器（推荐）

#### 架构设计

```
┌─────────────────────────────────────────┐
│  chrome-cdp-cli (进程 1, 2, 3...)      │
│  └─> 连接到本地代理服务器               │
└─────────────────────────────────────────┘
              ↓ (HTTP/WebSocket)
┌─────────────────────────────────────────┐
│  本地代理服务器 (localhost:9223)        │
│  - 管理 CDP 连接池                     │
│  - 转发命令到 Chrome                    │
│  - 维护连接状态                         │
└─────────────────────────────────────────┘
              ↓ (WebSocket)
┌─────────────────────────────────────────┐
│  Chrome DevTools Protocol               │
│  - 实际 CDP 连接                        │
└─────────────────────────────────────────┘
```

#### 实现细节

**1. 代理服务器（包含 Console 监控）**

```typescript
// proxy-server.ts
import express from 'express';
import { WebSocketServer } from 'ws';

class CDPProxyServer {
  private app: express.Application;
  private wss: WebSocketServer;
  private connections: Map<string, WebSocket> = new Map();
  // 关键：消息存储
  private consoleMessages: Map<string, ConsoleMessage[]> = new Map();
  private networkRequests: Map<string, NetworkRequest[]> = new Map();

  async start(port: number = 9223) {
    this.app = express();
    
    // REST API: 获取连接
    this.app.post('/api/connect', async (req, res) => {
      const { host, port: chromePort, targetId } = req.body;
      const connection = await this.getOrCreateConnection(host, chromePort, targetId);
      res.json({ connectionId: connection.id });
    });

    // REST API: 获取控制台消息（历史 + 实时）
    this.app.get('/api/console/:connectionId', (req, res) => {
      const messages = this.consoleMessages.get(req.params.connectionId) || [];
      res.json({ messages, totalCount: messages.length });
    });

    // WebSocket: 代理 CDP 消息
    this.wss = new WebSocketServer({ port });
    this.wss.on('connection', (ws, req) => {
      const connectionId = this.extractConnectionId(req);
      this.handleProxyConnection(ws, connectionId);
    });
  }

  private async getOrCreateConnection(
    host: string,
    port: number,
    targetId: string
  ): Promise<CDPConnection> {
    const key = `${host}:${port}:${targetId}`;
    
    if (this.connections.has(key)) {
      return this.connections.get(key)!;
    }

    // 创建新连接
    const connection = await this.createCDPConnection(host, port, targetId);
    this.connections.set(key, connection);
    
    // 关键：立即开始监控控制台消息
    await this.startConsoleMonitoring(connection, key);
    
    // 监听连接关闭
    connection.on('close', () => {
      this.connections.delete(key);
      this.consoleMessages.delete(key);
    });

    return connection;
  }

  private async startConsoleMonitoring(
    connection: CDPConnection,
    key: string
  ): Promise<void> {
    // 启用 Runtime 和 Log 域
    await connection.send('Runtime.enable');
    await connection.send('Log.enable');

    // 初始化消息存储
    this.consoleMessages.set(key, []);

    // 监听控制台事件
    connection.on('Runtime.consoleAPICalled', (params) => {
      const messages = this.consoleMessages.get(key) || [];
      messages.push(this.formatConsoleMessage(params));
      this.consoleMessages.set(key, messages);
    });

    connection.on('Log.entryAdded', (params) => {
      const messages = this.consoleMessages.get(key) || [];
      messages.push(this.formatLogEntry(params));
      this.consoleMessages.set(key, messages);
    });
  }

  private async getOrCreateConnection(
    host: string,
    port: number,
    targetId: string
  ): Promise<CDPConnection> {
    const key = `${host}:${port}:${targetId}`;
    
    if (this.connections.has(key)) {
      return this.connections.get(key)!;
    }

    // 创建新连接
    const connection = await this.createCDPConnection(host, port, targetId);
    this.connections.set(key, connection);
    
    // 监听连接关闭
    connection.on('close', () => {
      this.connections.delete(key);
    });

    return connection;
  }
}
```

**2. CLI 客户端**

```typescript
// CLIApplication.ts
class CLIApplication {
  private async ensureConnection(command: CLICommand): Promise<void> {
    // 1. 检查代理服务器是否运行
    const proxyRunning = await this.checkProxyServer();
    
    if (!proxyRunning) {
      // 启动代理服务器（后台进程）
      await this.startProxyServer();
    }

    // 2. 通过代理获取连接
    const connectionId = await this.getConnectionFromProxy(
      command.config.host,
      command.config.port
    );

    // 3. 创建代理客户端
    this.client = new ProxyCDPClient(connectionId, this.proxyUrl);
  }

  private async getConnectionFromProxy(
    host: string,
    port: number
  ): Promise<string> {
    const response = await fetch(`${this.proxyUrl}/api/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host, port })
    });

    const data = await response.json();
    return data.connectionId;
  }
}
```

#### 优点

- ✅ **完美解决 Console Log 问题**：代理服务器从连接建立开始就持续监控，所有消息都被存储
- ✅ **真正的连接共享**：所有 CLI 进程共享同一个 CDP 连接和消息存储
- ✅ **历史消息查询**：可以查询从连接建立开始的所有控制台消息
- ✅ **消息累积**：消息在代理服务器中持续累积，不随 CLI 进程退出而丢失
- ✅ **架构清晰**：代理服务器独立，职责明确（连接管理 + 消息存储）
- ✅ **易于扩展**：可以添加连接池、负载均衡、消息过滤等功能
- ✅ **跨平台**：基于 HTTP/WebSocket，跨平台兼容
- ✅ **易于调试**：可以独立监控代理服务器和消息存储

#### 缺点

- ❌ **需要额外进程**：代理服务器需要运行
- ❌ **网络开销**：本地 HTTP/WebSocket 通信有轻微开销
- ❌ **启动管理**：需要管理代理服务器的启动和停止
- ⚠️ **内存占用**：消息存储在内存中，长时间运行可能占用较多内存（可配置清理策略）

## 方案对比

| 特性 | 守护进程 | 文件锁 | 共享内存 | 代理服务器 |
|------|---------|--------|---------|-----------|
| **解决 Console Log 问题** | ✅ 是 | ❌ 否 | ✅ 是 | ✅ 是 |
| **历史消息存储** | ✅ 是 | ❌ 否 | ⚠️ 复杂 | ✅ 是 |
| **连接持久化** | ✅ 是 | ⚠️ 部分 | ✅ 是 | ✅ 是 |
| **真正共享连接** | ✅ 是 | ❌ 否 | ✅ 是 | ✅ 是 |
| **实现复杂度** | 高 | 低 | 中 | 中 |
| **资源占用** | 中 | 低 | 低 | 中 |
| **跨平台兼容** | 中 | ✅ 好 | ❌ 差 | ✅ 好 |
| **调试难度** | 高 | 低 | 高 | 中 |
| **扩展性** | 中 | 低 | 低 | ✅ 好 |

## 推荐方案：代理服务器模式（方案 D）

### 理由

1. **平衡了复杂度和功能**：实现相对简单，功能完整
2. **真正的连接共享**：所有进程共享同一个 CDP 连接
3. **易于扩展**：可以添加连接池、监控、日志等功能
4. **跨平台兼容**：基于标准 HTTP/WebSocket
5. **易于调试**：代理服务器可以独立运行和监控

### 实现步骤

#### Phase 1: 基础代理服务器
- [ ] 实现 HTTP API 服务器
- [ ] 实现 CDP 连接管理
- [ ] 实现 WebSocket 代理

#### Phase 2: CLI 集成
- [ ] 修改 CLIApplication 使用代理
- [ ] 实现代理服务器自动启动
- [ ] 实现连接健康检查

#### Phase 3: 高级功能
- [ ] 连接池管理
- [ ] 自动重连机制
- [ ] 连接状态监控

### 使用示例

```bash
# 第一次运行（自动启动代理服务器并开始监控）
$ chrome-cdp-cli eval "document.title"
ℹ️  Starting CDP proxy server...
✅ Connected via proxy, console monitoring started
"Example Domain"

# 页面产生一些控制台消息
# (在浏览器中执行: console.log("test1"), console.warn("test2"))

# 后续运行（复用连接，可以获取历史消息）
$ chrome-cdp-cli list_console_messages
✅ Using existing connection
{
  "messages": [
    {"type": "log", "text": "test1", "timestamp": 1234567890},
    {"type": "warn", "text": "test2", "timestamp": 1234567900}
  ],
  "totalCount": 2,
  "source": "proxy",
  "note": "Includes all messages since connection established"
}

# 执行新命令，新产生的消息也会被捕获
$ chrome-cdp-cli eval "console.log('new message')"
✅ Using existing connection
"new message"

# 再次查询，可以看到新消息
$ chrome-cdp-cli list_console_messages
{
  "messages": [
    {"type": "log", "text": "test1", "timestamp": 1234567890},
    {"type": "warn", "text": "test2", "timestamp": 1234567900},
    {"type": "log", "text": "new message", "timestamp": 1234568000}
  ],
  "totalCount": 3
}
```

## 技术实现要点

### 1. 代理服务器生命周期管理

```typescript
class ProxyManager {
  async ensureProxyRunning(): Promise<void> {
    if (await this.isProxyRunning()) {
      return;
    }

    // 启动代理服务器（后台进程）
    await this.startProxyServer();
    
    // 等待服务器就绪
    await this.waitForProxyReady();
  }

  private async startProxyServer(): Promise<void> {
    const { spawn } = require('child_process');
    const proxy = spawn('node', [
      path.join(__dirname, 'proxy-server.js')
    ], {
      detached: true,
      stdio: 'ignore'
    });

    proxy.unref(); // 允许父进程退出
  }
}
```

### 2. 连接健康检查

```typescript
class ProxyCDPClient implements ICDPClient {
  async send(method: string, params?: unknown): Promise<unknown> {
    // 检查连接是否有效
    if (!await this.isConnectionAlive()) {
      // 重新获取连接
      await this.refreshConnection();
    }

    // 通过代理发送命令
    return await this.proxyRequest(method, params);
  }

  private async isConnectionAlive(): Promise<boolean> {
    try {
      const response = await fetch(`${this.proxyUrl}/api/health/${this.connectionId}`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

### 3. 自动清理

```typescript
class CDPProxyServer {
  private cleanupInterval: NodeJS.Timeout;

  startCleanup() {
    this.cleanupInterval = setInterval(() => {
      // 清理无效连接
      for (const [key, connection] of this.connections) {
        if (!connection.isAlive()) {
          this.connections.delete(key);
        }
      }
    }, 30000); // 每 30 秒清理一次
  }
}
```

## 总结

### 推荐方案：代理服务器模式（方案 D）

**核心优势**：
- ✅ **完美解决 Console Log 问题**：从连接建立开始持续监控，可以获取所有历史消息
- ✅ 真正的连接持久化和共享
- ✅ 消息累积存储，支持历史查询
- ✅ 架构清晰，易于维护和扩展
- ✅ 跨平台兼容
- ✅ 平衡了复杂度和功能

### 实施优先级：**高**

**理由**：
1. **直接解决核心问题**：这是解决控制台监控历史消息问题的根本方案
2. **显著改善用户体验**：用户可以获取完整的控制台历史，而不仅仅是新消息
3. **与设计目标一致**：虽然需要额外进程，但保持了 eval-first 设计，只是增强了监控能力

### 实施建议

**Phase 1: 核心功能（解决 Console Log 问题）**
- [ ] 实现代理服务器基础架构
- [ ] 实现控制台消息监控和存储
- [ ] 实现消息查询 API
- [ ] CLI 集成和自动启动

**Phase 2: 增强功能**
- [ ] 网络请求监控和存储
- [ ] 消息过滤和搜索
- [ ] 连接健康检查和自动重连

**Phase 3: 优化**
- [ ] 消息清理策略（避免内存泄漏）
- [ ] 性能优化
- [ ] 监控和日志

### 替代方案评估

**文件锁模式（方案 B）**：
- ❌ **不适合**：无法解决 Console Log 问题，因为无法真正共享连接和消息状态
- ⚠️ 只能作为连接信息缓存的辅助方案

**守护进程模式（方案 A）**：
- ✅ 可以解决 Console Log 问题
- ⚠️ 但实现复杂度更高，调试更困难
- 💡 如果代理服务器方案遇到问题，可以考虑此方案

### 关键设计决策

1. **消息存储位置**：代理服务器内存（快速访问，支持实时查询）
2. **消息清理策略**：可配置的最大消息数量或时间窗口
3. **连接生命周期**：与 Chrome 页面生命周期绑定，页面关闭时清理
4. **向后兼容**：不启用代理服务器时，回退到现有行为（只获取新消息）


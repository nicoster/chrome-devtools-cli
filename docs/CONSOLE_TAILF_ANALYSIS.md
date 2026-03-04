# Console Tailf 功能实现分析

## 需求概述

实现一个类似 `tailf` 的功能来实时查看 console log，特点：
- 持续运行，不退出
- 实时输出新的 console 消息
- 支持过滤选项（类型、文本模式等）
- 可以通过 Ctrl+C 退出

## 现有架构分析

### 1. ConsoleMonitor 组件

**位置**: `src/monitors/ConsoleMonitor.ts`

**功能**:
- 监听 CDP 事件：`Runtime.consoleAPICalled` 和 `Log.entryAdded`
- 存储消息到内存数组（最多 1000 条）
- 支持消息过滤（类型、文本模式、时间范围等）

**关键方法**:
```typescript
async startMonitoring(): Promise<void>  // 开始监听
async stopMonitoring(): Promise<void>   // 停止监听
getMessages(filter?: ConsoleMessageFilter): ConsoleMessage[]  // 获取消息
```

**事件监听机制**:
- 使用 `client.on('Runtime.consoleAPICalled', handler)` 监听事件
- 事件触发时调用 `handleConsoleMessage()` 处理

### 2. CDPClient 事件系统

**位置**: `src/client/CDPClient.ts`

**功能**:
- 支持事件订阅：`client.on(eventName, callback)`
- 事件分发机制：收到 CDP 事件后调用注册的回调函数

**关键代码**:
```typescript
// 注册事件监听器
this.client.on('Runtime.consoleAPICalled', this.messageHandler);

// 事件处理
private handleMessage(data: string): void {
  if (message.method) {
    const event = message as CDPEvent;
    const listeners = this.eventListeners.get(event.method);
    if (listeners) {
      listeners.forEach(callback => callback(event.params));
    }
  }
}
```

### 3. Proxy 服务器架构

**位置**: `src/proxy/server/`

**功能**:
- 存储历史 console 消息（`MessageStore`）
- WebSocket 实时事件转发（`WSProxy`）
- 支持事件订阅和过滤（`CDPEventMonitor`）

**WebSocket 事件转发**:
- Proxy 服务器可以订阅 CDP 事件
- 通过 WebSocket 实时转发给客户端
- 支持事件过滤（`setClientEventFilters`）

## 实现方案分析

### 方案 A：直接 CDP 连接 + ConsoleMonitor（推荐）

**优点**:
- 实现简单，直接利用现有 `ConsoleMonitor`
- 无需依赖 proxy 服务器
- 实时性好，直接监听 CDP 事件
- 代码改动最小

**实现思路**:
1. 创建新的 Handler：`TailConsoleHandler`
2. 使用 `ConsoleMonitor` 监听 console 事件
3. 在事件回调中实时输出消息到控制台
4. 支持过滤选项（类型、文本模式）
5. 监听 `SIGINT` 信号（Ctrl+C）优雅退出

**关键代码结构**:
```typescript
export class TailConsoleHandler implements ICommandHandler {
  readonly name = 'console:tail';
  private consoleMonitor: ConsoleMonitor | null = null;
  private isRunning = false;
  private messageFilter: ConsoleMessageFilter = {};

  async execute(client: CDPClient, args: unknown): Promise<CommandResult> {
    // 1. 解析参数（过滤选项）
    // 2. 初始化 ConsoleMonitor
    // 3. 注册事件回调，实时输出
    // 4. 设置信号处理（Ctrl+C）
    // 5. 持续运行直到用户中断
  }

  private formatMessage(message: ConsoleMessage): string {
    // 格式化消息输出
  }

  private shouldOutputMessage(message: ConsoleMessage): boolean {
    // 应用过滤规则
  }
}
```

**事件监听实现**:
```typescript
// 在 ConsoleMonitor 中添加事件回调支持
// 或者直接在 Handler 中监听 CDP 事件

// 方式 1: 扩展 ConsoleMonitor 支持回调
class ConsoleMonitor {
  private onMessageCallbacks: Array<(msg: ConsoleMessage) => void> = [];
  
  onMessage(callback: (msg: ConsoleMessage) => void) {
    this.onMessageCallbacks.push(callback);
  }
  
  private handleConsoleMessage(params: unknown): void {
    const message = this.convertToConsoleMessage(params);
    this.messages.push(message);
    
    // 触发回调
    this.onMessageCallbacks.forEach(cb => cb(message));
  }
}

// 方式 2: 直接在 Handler 中监听 CDP 事件
client.on('Runtime.consoleAPICalled', (params) => {
  const message = this.convertMessage(params);
  if (this.shouldOutputMessage(message)) {
    console.log(this.formatMessage(message));
  }
});
```

### 方案 B：Proxy + WebSocket 订阅

**优点**:
- 可以获取历史消息（从 proxy 连接建立时开始）
- 利用 proxy 的持久化存储
- 支持多客户端订阅

**缺点**:
- 需要 proxy 服务器运行
- 实现复杂度较高
- 需要 WebSocket 连接管理

**实现思路**:
1. 通过 `ProxyClient` 连接 proxy
2. 创建 WebSocket 连接订阅 console 事件
3. 实时接收并输出消息
4. 处理连接断开和重连

**关键代码结构**:
```typescript
export class TailConsoleHandler implements ICommandHandler {
  private proxyClient: ProxyClient | null = null;
  private wsConnection: WebSocket | null = null;

  async execute(client: CDPClient, args: unknown): Promise<CommandResult> {
    // 1. 连接 proxy
    // 2. 创建 WebSocket 连接
    // 3. 订阅 console 事件
    // 4. 监听 WebSocket 消息
    // 5. 实时输出
  }
}
```

### 方案 C：轮询方式（不推荐）

**实现思路**:
- 定期调用 `getConsoleMessages()`
- 比较时间戳，输出新消息
- 使用 `setInterval` 轮询

**缺点**:
- 实时性差
- 资源消耗高
- 不是真正的实时流式输出

## 推荐实现方案

### 首选：方案 A（直接 CDP + ConsoleMonitor）

**理由**:
1. **简单直接**：利用现有 `ConsoleMonitor`，代码改动最小
2. **实时性好**：直接监听 CDP 事件，延迟最低
3. **无依赖**：不需要 proxy 服务器
4. **符合设计**：与现有 CLI 工具的设计理念一致

### 实现步骤

#### 1. 创建 TailConsoleHandler

**文件**: `src/handlers/TailConsoleHandler.ts`

**功能**:
- 解析命令行参数（`--types`, `--textPattern`, `--format` 等）
- 初始化 `ConsoleMonitor` 并开始监听
- 注册事件回调，实时输出消息
- 处理 Ctrl+C 信号，优雅退出

#### 2. 扩展 ConsoleMonitor（可选）

如果需要更好的事件回调支持，可以扩展 `ConsoleMonitor`:

```typescript
// 在 ConsoleMonitor 中添加
onMessage(callback: (message: ConsoleMessage) => void): void {
  this.messageCallbacks.push(callback);
}

offMessage(callback: (message: ConsoleMessage) => void): void {
  const index = this.messageCallbacks.indexOf(callback);
  if (index > -1) {
    this.messageCallbacks.splice(index, 1);
  }
}
```

#### 3. 消息格式化

支持多种输出格式：
- **text**: 简单的文本输出
- **json**: JSON 格式（每行一个 JSON 对象）
- **pretty**: 带颜色和格式的美化输出

#### 4. 信号处理

```typescript
process.on('SIGINT', () => {
  console.log('\n\nStopping console tail...');
  this.consoleMonitor?.stopMonitoring();
  process.exit(0);
});
```

#### 5. 注册 Handler

在 `CLIApplication.ts` 中注册：
```typescript
this.cli.registerHandler(new TailConsoleHandler());
```

### 命令行接口设计

```bash
# 基本用法
chrome-cdp-cli console:tail

# 过滤错误和警告
chrome-cdp-cli console:tail --types error,warn

# 文本模式过滤
chrome-cdp-cli console:tail --textPattern "API"

# JSON 格式输出
chrome-cdp-cli console:tail --format json

# 组合过滤
chrome-cdp-cli console:tail --types error --textPattern "404"
```

### 参数定义

```typescript
interface TailConsoleArgs {
  types?: Array<'log' | 'info' | 'warn' | 'error' | 'debug'>;
  textPattern?: string;  // 正则表达式
  format?: 'text' | 'json' | 'pretty';
  host?: string;
  port?: number;
  targetId?: string;
}
```

## 技术细节

### 1. 事件监听的生命周期

```
CLI 启动
  ↓
创建 CDP 连接
  ↓
初始化 ConsoleMonitor
  ↓
调用 startMonitoring()
  ↓
注册 CDP 事件监听器
  ↓
[持续运行]
  ↓
收到 console 事件 → 处理 → 输出
  ↓
用户按 Ctrl+C
  ↓
停止监听 → 断开连接 → 退出
```

### 2. 消息过滤时机

- **事件级别过滤**：在事件回调中立即过滤，减少不必要的处理
- **输出级别过滤**：在格式化输出前再次过滤（双重保险）

### 3. 性能考虑

- **内存管理**：`ConsoleMonitor` 已经限制最多 1000 条消息
- **输出缓冲**：使用 `process.stdout.write()` 直接输出，避免缓冲
- **异步处理**：事件处理应该是异步的，不阻塞主线程

### 4. 错误处理

- CDP 连接断开：检测并提示用户
- 事件解析错误：忽略并继续运行
- 格式化错误：输出原始消息

## 与现有功能的对比

| 功能 | `console` 命令 | `console:tail` 命令 |
|------|---------------|-------------------|
| **执行模式** | 一次性查询 | 持续监听 |
| **输出方式** | 返回所有消息后退出 | 实时流式输出 |
| **使用场景** | 查看历史消息 | 实时监控日志 |
| **退出方式** | 自动退出 | Ctrl+C 退出 |

## 实现优先级

1. **Phase 1**: 基础功能
   - 创建 `TailConsoleHandler`
   - 实现基本的实时监听和输出
   - 支持 Ctrl+C 退出

2. **Phase 2**: 过滤功能
   - 支持 `--types` 过滤
   - 支持 `--textPattern` 过滤

3. **Phase 3**: 格式化
   - 支持 `--format` 选项
   - 实现多种输出格式

4. **Phase 4**: 增强功能（可选）
   - 支持 proxy 模式
   - 支持时间戳显示
   - 支持颜色高亮

## 测试策略

1. **单元测试**:
   - 测试参数解析
   - 测试消息过滤逻辑
   - 测试格式化函数

2. **集成测试**:
   - 测试完整的监听流程
   - 测试 Ctrl+C 退出
   - 测试过滤功能

3. **手动测试**:
   - 在真实浏览器环境中测试
   - 验证实时性和准确性

## 总结

实现 `console:tail` 功能的最佳方案是**方案 A：直接 CDP 连接 + ConsoleMonitor**。这个方案：

- ✅ 实现简单，代码改动最小
- ✅ 实时性好，直接监听 CDP 事件
- ✅ 无外部依赖，不需要 proxy 服务器
- ✅ 符合现有架构设计

主要工作：
1. 创建 `TailConsoleHandler` 类
2. 实现事件监听和实时输出
3. 添加过滤和格式化功能
4. 处理信号和优雅退出
5. 注册到 CLI 应用

预计实现时间：2-3 小时（包括测试）


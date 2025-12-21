# 设计文档: Chrome DevTools CLI

## 概述

Chrome DevTools CLI 是一个命令行工具，通过 Chrome DevTools Protocol (CDP) 提供对 Chrome 浏览器的编程控制。该工具使用 WebSocket 连接与 Chrome 实例通信，发送 JSON-RPC 格式的命令并接收响应。

核心设计原则：
- 简单直观的命令行界面
- 可靠的 WebSocket 连接管理
- 完整的 CDP 协议支持
- 灵活的输出格式（JSON/文本）
- 可扩展的命令架构

## 架构

系统采用分层架构：

```
┌─────────────────────────────────────┐
│      CLI 接口层 (CLI Interface)      │
│  - 参数解析                          │
│  - 命令路由                          │
│  - 输出格式化                        │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│    命令处理层 (Command Handlers)     │
│  - navigate_page                    │
│  - evaluate_script                  │
│  - take_screenshot                  │
│  - click, fill, hover...            │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   CDP 客户端层 (CDP Client)          │
│  - WebSocket 连接管理                │
│  - JSON-RPC 消息处理                 │
│  - 请求/响应匹配                     │
│  - 事件监听                          │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      Chrome 浏览器 (Chrome)          │
│  - DevTools Protocol 端点            │
└─────────────────────────────────────┘
```

## 组件和接口

### 1. CLI 接口层 (CLIInterface)

负责解析命令行参数并路由到相应的命令处理器。

```typescript
interface CLIConfig {
  host: string;           // Chrome 主机地址，默认 localhost
  port: number;           // DevTools 端口，默认 9222
  outputFormat: 'json' | 'text';  // 输出格式
  verbose: boolean;       // 详细日志
  quiet: boolean;         // 静默模式
  timeout: number;        // 命令超时（毫秒）
}

interface CLICommand {
  name: string;           // 命令名称
  args: Record<string, any>;  // 命令参数
  config: CLIConfig;      // 配置
}

class CLIInterface {
  parseArgs(argv: string[]): CLICommand;
  execute(command: CLICommand): Promise<CommandResult>;
  formatOutput(result: CommandResult, format: string): string;
}
```

### 2. CDP 客户端层 (CDPClient)

管理与 Chrome 的 WebSocket 连接，处理 CDP 协议通信。

```typescript
interface CDPMessage {
  id: number;             // 消息 ID
  method: string;         // CDP 方法名
  params?: any;           // 方法参数
}

interface CDPResponse {
  id: number;             // 对应请求的 ID
  result?: any;           // 成功结果
  error?: {               // 错误信息
    code: number;
    message: string;
  };
}

interface CDPEvent {
  method: string;         // 事件名称
  params: any;            // 事件参数
}

class CDPClient {
  private ws: WebSocket;
  private messageId: number;
  private pendingRequests: Map<number, Promise>;
  private eventListeners: Map<string, Function[]>;
  
  async connect(host: string, port: number): Promise<void>;
  async disconnect(): Promise<void>;
  async send(method: string, params?: any): Promise<any>;
  on(event: string, callback: Function): void;
  off(event: string, callback: Function): void;
}
```

### 3. 连接管理器 (ConnectionManager)

处理连接发现、建立和维护。

```typescript
interface BrowserTarget {
  id: string;             // 目标 ID
  type: string;           // 类型（page, background_page 等）
  title: string;          // 页面标题
  url: string;            // 页面 URL
  webSocketDebuggerUrl: string;  // WebSocket 端点
}

class ConnectionManager {
  async discoverTargets(host: string, port: number): Promise<BrowserTarget[]>;
  async connectToTarget(target: BrowserTarget): Promise<CDPClient>;
  async reconnect(client: CDPClient, maxRetries: number): Promise<void>;
}
```

### 4. 命令处理器 (CommandHandlers)

每个命令都有对应的处理器，封装 CDP 调用逻辑。

```typescript
interface CommandHandler {
  name: string;
  execute(client: CDPClient, args: any): Promise<CommandResult>;
}

interface CommandResult {
  success: boolean;
  data?: any;
  error?: string;
}

// 示例：JavaScript 执行命令
class EvaluateScriptHandler implements CommandHandler {
  name = 'evaluate_script';
  
  async execute(client: CDPClient, args: {
    expression: string;
    awaitPromise?: boolean;
    timeout?: number;
  }): Promise<CommandResult> {
    const result = await client.send('Runtime.evaluate', {
      expression: args.expression,
      awaitPromise: args.awaitPromise ?? true,
      returnByValue: true,
      timeout: args.timeout
    });
    
    if (result.exceptionDetails) {
      return {
        success: false,
        error: result.exceptionDetails.exception.description
      };
    }
    
    return {
      success: true,
      data: result.result.value
    };
  }
}
```

## 数据模型

### 页面信息 (PageInfo)

```typescript
interface PageInfo {
  id: string;             // 页面 ID
  url: string;            // 当前 URL
  title: string;          // 页面标题
  loadingState: 'loading' | 'loaded' | 'error';
}
```

### 控制台消息 (ConsoleMessage)

```typescript
interface ConsoleMessage {
  type: 'log' | 'info' | 'warn' | 'error' | 'debug';
  text: string;           // 消息文本
  args: any[];            // 参数
  timestamp: number;      // 时间戳
  stackTrace?: StackFrame[];  // 堆栈跟踪
}

interface StackFrame {
  functionName: string;
  url: string;
  lineNumber: number;
  columnNumber: number;
}
```

### 网络请求 (NetworkRequest)

```typescript
interface NetworkRequest {
  requestId: string;      // 请求 ID
  url: string;            // 请求 URL
  method: string;         // HTTP 方法
  headers: Record<string, string>;  // 请求头
  timestamp: number;      // 时间戳
  status?: number;        // 响应状态码
  responseHeaders?: Record<string, string>;  // 响应头
  responseBody?: string;  // 响应体
}
```

### 性能指标 (PerformanceMetrics)

```typescript
interface PerformanceMetrics {
  timestamp: number;
  metrics: {
    domContentLoaded: number;  // DOMContentLoaded 时间
    loadComplete: number;      // Load 完成时间
    firstPaint: number;        // 首次绘制
    firstContentfulPaint: number;  // 首次内容绘制
    scriptDuration: number;    // 脚本执行时间
    layoutDuration: number;    // 布局时间
  };
}
```

## 正确性属性

*属性是一个特征或行为，应该在系统的所有有效执行中保持为真——本质上是关于系统应该做什么的形式化陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

基于预工作分析，以下是经过反思和合并后的正确性属性：

### 属性 1: 连接建立和管理
*对于任何* 有效的连接参数（主机、端口、目标ID），建立连接后应该能够成功发送 CDP 命令并接收响应，连接应该保持稳定直到明确断开
**验证: 需求 1.1, 1.3, 1.4, 10.1, 10.2**

### 属性 2: JavaScript 执行往返
*对于任何* 有效的 JavaScript 表达式，通过 evaluate_script 执行后返回的结果应该与在浏览器控制台中直接执行的结果等价
**验证: 需求 3.1, 3.2**

### 属性 3: JavaScript 错误处理
*对于任何* 会抛出错误的 JavaScript 代码，执行时应该捕获错误信息而不是崩溃，并返回包含错误详情的结构化响应
**验证: 需求 3.3**

### 属性 4: 异步 JavaScript 执行
*对于任何* 返回 Promise 的 JavaScript 代码，工具应该等待 Promise 解决并返回最终结果，而不是 Promise 对象本身
**验证: 需求 3.4**

### 属性 5: DOM 修改即时性
*对于任何* 修改 DOM 的 JavaScript 代码，执行后立即查询相同的 DOM 元素应该反映出修改后的状态
**验证: 需求 3.5**

### 属性 6: 页面导航一致性
*对于任何* 有效的 URL，执行 navigate_page 命令后，通过 CDP 查询当前页面 URL 应该与导航目标 URL 匹配
**验证: 需求 2.1**

### 属性 7: 页面管理操作
*对于任何* 页面管理操作（创建、关闭、列表、选择），操作前后的页面状态变化应该与操作类型一致（创建增加数量，关闭减少数量等）
**验证: 需求 2.2, 2.3, 2.4, 2.5**

### 属性 8: 元素交互幂等性
*对于任何* 页面元素，连续执行相同的交互操作（如点击、悬停）应该产生一致的结果，不会因重复操作而产生意外副作用
**验证: 需求 5.1, 5.4**

### 属性 9: 表单填充往返
*对于任何* 表单字段和文本值，使用 fill 命令填充后，立即查询该字段的值应该与填充的文本匹配
**验证: 需求 5.2, 5.3**

### 属性 10: 截图文件创建
*对于任何* 有效的截图参数（尺寸、文件路径），执行截图命令后应该在指定路径创建具有正确尺寸的图像文件
**验证: 需求 4.1, 4.3, 4.4**

### 属性 11: 控制台消息捕获
*对于任何* 在页面中生成的控制台消息，监控功能应该能够捕获并返回包含正确消息内容、类型和时间戳的记录
**验证: 需求 6.1, 6.2, 6.5**

### 属性 12: 网络请求监控
*对于任何* 页面发起的网络请求，监控功能应该能够捕获请求详情（URL、方法、头部）和响应信息（状态码、响应头）
**验证: 需求 6.3, 6.4, 6.5**

### 属性 13: 性能跟踪数据完整性
*对于任何* 性能跟踪会话，开始跟踪、执行操作、停止跟踪的完整流程应该返回包含关键性能指标的结构化数据
**验证: 需求 7.1, 7.2, 7.4**

### 属性 14: 设备模拟配置
*对于任何* 有效的设备参数，启用模拟后查询浏览器的视口、用户代理等属性应该与指定的设备参数匹配
**验证: 需求 8.1, 8.2**

### 属性 15: 输出格式一致性
*对于任何* 命令执行结果，指定 JSON 格式时输出应该是有效的 JSON，指定文本格式时输出应该是人类可读的文本
**验证: 需求 11.1, 11.2**

### 属性 16: 错误退出代码
*对于任何* 导致错误的操作（连接失败、命令执行失败等），工具应该返回非零退出代码以便 bash 脚本正确处理错误情况
**验证: 需求 9.5**

## 错误处理

### 连接错误
- **连接超时**: 当无法在指定时间内建立连接时，返回清晰的超时错误
- **连接拒绝**: 当目标端口未开放时，提供启动 Chrome 的指导信息
- **协议版本不匹配**: 当 CDP 版本不兼容时，建议更新 Chrome 或工具版本

### 命令执行错误
- **元素未找到**: 当 CSS 选择器无法匹配元素时，返回具体的选择器信息
- **JavaScript 执行错误**: 捕获并格式化 JavaScript 异常，包含堆栈跟踪
- **超时错误**: 当命令执行超过指定时间时，终止操作并返回超时信息

### 文件操作错误
- **文件不存在**: 当指定的 JavaScript 文件不存在时，返回文件路径错误
- **权限错误**: 当无法写入截图文件时，提供权限相关的错误信息
- **磁盘空间不足**: 当截图或日志文件无法保存时，返回存储空间错误

### 错误恢复策略
- **自动重连**: 连接丢失时使用指数退避策略自动重连
- **命令重试**: 对于临时性错误（如网络抖动），自动重试命令执行
- **优雅降级**: 当某些功能不可用时，提供替代方案或跳过可选操作

## 测试策略

### 双重测试方法
本系统采用单元测试和基于属性的测试相结合的方法：

**单元测试**:
- 验证特定示例和边缘情况
- 测试错误条件和异常处理
- 验证组件间的集成点
- 测试配置文件解析和命令行参数处理

**基于属性的测试**:
- 验证跨所有输入的通用属性
- 通过随机化实现全面的输入覆盖
- 每个属性测试运行最少 100 次迭代
- 使用结构化标签引用设计文档属性

### 属性测试配置
- **测试框架**: 使用 fast-check (JavaScript/TypeScript) 进行基于属性的测试
- **迭代次数**: 每个属性测试最少 100 次迭代以确保可靠性
- **标签格式**: **Feature: chrome-devtools-cli, Property {number}: {property_text}**
- **测试数据生成**: 为 URL、CSS 选择器、JavaScript 代码、设备参数等创建智能生成器

### 测试环境要求
- **Chrome 实例**: 测试需要运行启用了 DevTools 的 Chrome 实例
- **测试页面**: 创建包含各种元素类型的测试 HTML 页面
- **网络模拟**: 使用 Chrome 的网络条件模拟功能测试不同网络环境
- **文件系统**: 测试文件上传、截图保存等文件操作功能

### 集成测试策略
- **端到端流程**: 测试完整的用户工作流程（连接→导航→交互→截图→断开）
- **多页面场景**: 测试多标签页管理和页面切换功能
- **长时间运行**: 测试长时间连接的稳定性和内存使用
- **并发操作**: 测试同时执行多个命令的行为

### 性能测试
- **响应时间**: 测量各种命令的执行时间
- **内存使用**: 监控长时间运行时的内存消耗
- **连接稳定性**: 测试长时间连接的可靠性
- **大数据处理**: 测试处理大型页面和大量网络请求的能力
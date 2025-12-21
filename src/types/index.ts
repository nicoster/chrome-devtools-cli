// Core CLI Configuration Types
export interface CLIConfig {
  host: string;           // Chrome 主机地址，默认 localhost
  port: number;           // DevTools 端口，默认 9222
  outputFormat: 'json' | 'text';  // 输出格式
  verbose: boolean;       // 详细日志
  quiet: boolean;         // 静默模式
  timeout: number;        // 命令超时（毫秒）
}

export interface CLICommand {
  name: string;           // 命令名称
  args: Record<string, unknown>;  // 命令参数
  config: CLIConfig;      // 配置
}

// CDP Protocol Types
export interface CDPMessage {
  id: number;             // 消息 ID
  method: string;         // CDP 方法名
  params?: unknown;       // 方法参数
}

export interface CDPResponse {
  id: number;             // 对应请求的 ID
  result?: unknown;       // 成功结果
  error?: {               // 错误信息
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface CDPEvent {
  method: string;         // 事件名称
  params: unknown;        // 事件参数
}

// Browser Target Types
export interface BrowserTarget {
  id: string;             // 目标 ID
  type: string;           // 类型（page, background_page 等）
  title: string;          // 页面标题
  url: string;            // 页面 URL
  webSocketDebuggerUrl: string;  // WebSocket 端点
  devtoolsFrontendUrl?: string;  // DevTools 前端 URL
  faviconUrl?: string;    // 图标 URL
}

// Command Handler Types
export interface CommandResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface CommandHandler {
  name: string;
  execute(client: CDPClient, args: unknown): Promise<CommandResult>;
}

// Page Information Types
export interface PageInfo {
  id: string;             // 页面 ID
  url: string;            // 当前 URL
  title: string;          // 页面标题
  loadingState: 'loading' | 'loaded' | 'error';
}

// Console Message Types
export interface ConsoleMessage {
  type: 'log' | 'info' | 'warn' | 'error' | 'debug';
  text: string;           // 消息文本
  args: unknown[];        // 参数
  timestamp: number;      // 时间戳
  stackTrace?: StackFrame[];  // 堆栈跟踪
}

export interface StackFrame {
  functionName: string;
  url: string;
  lineNumber: number;
  columnNumber: number;
}

// Network Request Types
export interface NetworkRequest {
  requestId: string;      // 请求 ID
  url: string;            // 请求 URL
  method: string;         // HTTP 方法
  headers: Record<string, string>;  // 请求头
  timestamp: number;      // 时间戳
  status?: number;        // 响应状态码
  responseHeaders?: Record<string, string>;  // 响应头
  responseBody?: string;  // 响应体
}

// Performance Metrics Types
export interface PerformanceMetrics {
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

// Forward declaration for CDPClient (will be implemented later)
export interface CDPClient {
  connect(host: string, port: number): Promise<void>;
  disconnect(): Promise<void>;
  send(method: string, params?: unknown): Promise<unknown>;
  on(event: string, callback: Function): void;
  off(event: string, callback: Function): void;
}
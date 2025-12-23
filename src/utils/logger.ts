// Enhanced structured logging utility for proxy server
import * as fs from 'fs';
import * as path from 'path';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export interface LogEntry {
  timestamp: string;
  level: string;
  component?: string;
  connectionId?: string;
  clientId?: string;
  message: string;
  data?: any;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  metrics?: {
    memoryUsage?: NodeJS.MemoryUsage;
    connectionCount?: number;
    messageCount?: number;
    requestCount?: number;
    messagesRemoved?: number;
    requestsRemoved?: number;
    maxLimit?: number;
    [key: string]: any; // Allow additional metrics
  };
}

export interface LoggerConfig {
  level: LogLevel;
  quiet: boolean;
  file?: string;
  maxFileSize?: number; // in bytes
  maxFiles?: number;
  enableConsole?: boolean;
  enableStructured?: boolean;
  component?: string;
}

export class Logger {
  private config: LoggerConfig;
  private logFileHandle?: fs.WriteStream;
  private currentFileSize: number = 0;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      quiet: false,
      maxFileSize: 10 * 1024 * 1024, // 10MB default
      maxFiles: 5,
      enableConsole: true,
      enableStructured: true,
      ...config
    };

    if (this.config.file) {
      this.initializeLogFile();
    }
  }

  private initializeLogFile(): void {
    if (!this.config.file) return;

    try {
      // Ensure log directory exists
      const logDir = path.dirname(this.config.file);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      // Check if file exists and get its size
      if (fs.existsSync(this.config.file)) {
        const stats = fs.statSync(this.config.file);
        this.currentFileSize = stats.size;
        
        // If file is too large, rotate it immediately
        if (this.currentFileSize >= (this.config.maxFileSize || 10 * 1024 * 1024)) {
          this.rotateLogFile();
        }
      }

      this.logFileHandle = fs.createWriteStream(this.config.file, { flags: 'a' });
      
      this.logFileHandle.on('error', (error) => {
        console.error('Log file write error:', error);
      });

    } catch (error) {
      console.error('Failed to initialize log file:', error);
    }
  }

  private rotateLogFile(): void {
    if (!this.config.file || !this.logFileHandle) return;

    try {
      // Close current file handle
      this.logFileHandle.end();

      // Rotate existing files
      for (let i = (this.config.maxFiles || 5) - 1; i > 0; i--) {
        const oldFile = `${this.config.file}.${i}`;
        const newFile = `${this.config.file}.${i + 1}`;
        
        if (fs.existsSync(oldFile)) {
          if (i === (this.config.maxFiles || 5) - 1) {
            // Delete the oldest file
            fs.unlinkSync(oldFile);
          } else {
            fs.renameSync(oldFile, newFile);
          }
        }
      }

      // Move current file to .1
      if (fs.existsSync(this.config.file)) {
        fs.renameSync(this.config.file, `${this.config.file}.1`);
      }

      // Create new file handle
      this.currentFileSize = 0;
      this.logFileHandle = fs.createWriteStream(this.config.file, { flags: 'a' });
      
      this.logFileHandle.on('error', (error) => {
        console.error('Log file write error:', error);
      });

    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    if (this.config.enableStructured) {
      return JSON.stringify(entry) + '\n';
    } else {
      const timestamp = entry.timestamp;
      const level = entry.level.padEnd(5);
      const component = entry.component ? `[${entry.component}]` : '';
      const connectionId = entry.connectionId ? `{conn:${entry.connectionId}}` : '';
      const clientId = entry.clientId ? `{client:${entry.clientId}}` : '';
      
      let message = `${timestamp} ${level} ${component}${connectionId}${clientId} ${entry.message}`;
      
      if (entry.data) {
        message += ` | Data: ${JSON.stringify(entry.data)}`;
      }
      
      if (entry.error) {
        message += ` | Error: ${entry.error.message}`;
        if (entry.error.stack) {
          message += `\nStack: ${entry.error.stack}`;
        }
      }
      
      if (entry.metrics) {
        message += ` | Metrics: ${JSON.stringify(entry.metrics)}`;
      }
      
      return message + '\n';
    }
  }

  private writeLog(entry: LogEntry): void {
    const formattedEntry = this.formatLogEntry(entry);

    // Write to console if enabled
    if (this.config.enableConsole && !this.config.quiet) {
      const consoleMessage = this.config.enableStructured 
        ? formattedEntry.trim()
        : formattedEntry.trim();
      
      switch (entry.level) {
        case 'ERROR':
          console.error(consoleMessage);
          break;
        case 'WARN':
          console.warn(consoleMessage);
          break;
        case 'INFO':
          console.info(consoleMessage);
          break;
        case 'DEBUG':
          console.debug(consoleMessage);
          break;
      }
    }

    // Write to file if enabled
    if (this.logFileHandle) {
      const entrySize = Buffer.byteLength(formattedEntry, 'utf8');
      
      // Check if we need to rotate the log file
      if (this.currentFileSize + entrySize >= (this.config.maxFileSize || 10 * 1024 * 1024)) {
        this.rotateLogFile();
      }
      
      this.logFileHandle.write(formattedEntry);
      this.currentFileSize += entrySize;
    }
  }

  private createLogEntry(
    level: string,
    message: string,
    data?: any,
    error?: Error,
    context?: {
      component?: string;
      connectionId?: string;
      clientId?: string;
      metrics?: LogEntry['metrics'];
    }
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      component: context?.component || this.config.component
    };

    if (context?.connectionId) entry.connectionId = context.connectionId;
    if (context?.clientId) entry.clientId = context.clientId;
    if (data !== undefined) entry.data = data;
    if (context?.metrics) entry.metrics = context.metrics;
    
    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      };
    }

    return entry;
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  setQuiet(quiet: boolean): void {
    this.config.quiet = quiet;
  }

  setComponent(component: string): void {
    this.config.component = component;
  }

  // Enhanced logging methods with structured data support
  error(message: string, errorOrData?: Error | any, context?: { component?: string; connectionId?: string; clientId?: string; data?: any }): void {
    if (this.config.level >= LogLevel.ERROR) {
      let error: Error | undefined;
      let data: any;
      
      // Handle overloaded parameters
      if (errorOrData instanceof Error) {
        error = errorOrData;
        data = context?.data;
      } else {
        data = errorOrData;
        error = undefined;
      }
      
      const entry = this.createLogEntry('ERROR', message, data, error, context);
      this.writeLog(entry);
    }
  }

  warn(message: string, data?: any, context?: { component?: string; connectionId?: string; clientId?: string }): void {
    if (this.config.level >= LogLevel.WARN) {
      const entry = this.createLogEntry('WARN', message, data, undefined, context);
      this.writeLog(entry);
    }
  }

  info(message: string, data?: any, context?: { component?: string; connectionId?: string; clientId?: string }): void {
    if (this.config.level >= LogLevel.INFO) {
      const entry = this.createLogEntry('INFO', message, data, undefined, context);
      this.writeLog(entry);
    }
  }

  debug(message: string, data?: any, context?: { component?: string; connectionId?: string; clientId?: string }): void {
    if (this.config.level >= LogLevel.DEBUG) {
      const entry = this.createLogEntry('DEBUG', message, data, undefined, context);
      this.writeLog(entry);
    }
  }

  // Specialized logging methods for proxy server events
  logServerEvent(event: 'startup' | 'shutdown' | 'error', message: string, data?: any, error?: Error): void {
    const metrics = event === 'startup' || event === 'shutdown' ? {
      memoryUsage: process.memoryUsage()
    } : undefined;

    const entry = this.createLogEntry(
      event === 'error' ? 'ERROR' : 'INFO',
      `[SERVER-${event.toUpperCase()}] ${message}`,
      data,
      error,
      { component: 'ProxyServer', metrics }
    );
    this.writeLog(entry);
  }

  logConnectionEvent(
    event: 'established' | 'lost' | 'reconnected' | 'cleanup',
    connectionId: string,
    message: string,
    data?: any,
    error?: Error
  ): void {
    const entry = this.createLogEntry(
      error ? 'ERROR' : 'INFO',
      `[CONNECTION-${event.toUpperCase()}] ${message}`,
      data,
      error,
      { component: 'ConnectionPool', connectionId }
    );
    this.writeLog(entry);
  }

  logClientEvent(
    event: 'connected' | 'disconnected' | 'command' | 'error',
    clientId: string,
    message: string,
    data?: any,
    error?: Error
  ): void {
    const entry = this.createLogEntry(
      error ? 'ERROR' : 'INFO',
      `[CLIENT-${event.toUpperCase()}] ${message}`,
      data,
      error,
      { component: 'WSProxy', clientId }
    );
    this.writeLog(entry);
  }

  logMemoryEvent(
    event: 'cleanup' | 'limit-reached' | 'rotation',
    message: string,
    metrics: {
      memoryUsage?: NodeJS.MemoryUsage;
      connectionCount?: number;
      messageCount?: number;
      requestCount?: number;
      [key: string]: any; // Allow additional metrics
    }
  ): void {
    const entry = this.createLogEntry(
      'INFO',
      `[MEMORY-${event.toUpperCase()}] ${message}`,
      undefined,
      undefined,
      { component: 'MemoryManager', metrics }
    );
    this.writeLog(entry);
  }

  logAPIEvent(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    clientIP?: string,
    error?: Error
  ): void {
    const entry = this.createLogEntry(
      error ? 'ERROR' : 'INFO',
      `[API] ${method} ${path} - ${statusCode} (${duration}ms)`,
      { clientIP, duration, statusCode },
      error,
      { component: 'ProxyAPI' }
    );
    this.writeLog(entry);
  }

  logSecurityEvent(
    event: string,
    message: string,
    data?: any,
    error?: Error
  ): void {
    const entry = this.createLogEntry(
      error ? 'ERROR' : 'WARN',
      `[SECURITY-${event.toUpperCase()}] ${message}`,
      data,
      error,
      { component: 'SecurityManager' }
    );
    this.writeLog(entry);
  }

  // Performance monitoring
  logPerformanceMetrics(component: string, metrics: any): void {
    const entry = this.createLogEntry(
      'INFO',
      `[PERFORMANCE] ${component} metrics`,
      undefined,
      undefined,
      { component, metrics }
    );
    this.writeLog(entry);
  }

  // Cleanup method
  close(): void {
    if (this.logFileHandle) {
      this.logFileHandle.end();
      this.logFileHandle = undefined;
    }
  }
}

// Create default logger instance for backward compatibility
export const logger = new Logger();

// Create specialized loggers for different components
export const createLogger = (config: Partial<LoggerConfig> = {}): Logger => {
  return new Logger(config);
};
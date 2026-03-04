import { ListConsoleMessagesHandler } from './ListConsoleMessagesHandler';
import { CDPClient } from '../types';

// Mock CDPClient for testing
class MockCDPClient implements CDPClient {
  private eventListeners = new Map<string, Array<(params: unknown) => void>>();

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}

  async send(method: string): Promise<unknown> {
    if (method === 'Runtime.enable' || method === 'Log.enable') {
      return {};
    }
    return {};
  }

  on(event: string, callback: (params: unknown) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: (params: unknown) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event: string, params: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(cb => cb(params));
    }
  }
}

describe('ListConsoleMessagesHandler', () => {
  let handler: ListConsoleMessagesHandler;
  let mockClient: MockCDPClient;

  beforeEach(() => {
    handler = new ListConsoleMessagesHandler();
    mockClient = new MockCDPClient();
    jest.spyOn(process, 'on').mockImplementation(() => process);
    jest.spyOn(process, 'removeAllListeners').mockImplementation(() => process);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should have name "log"', () => {
    expect(handler.name).toBe('log');
  });

  it('should have "console" as alias', () => {
    expect((handler as any).aliases).toContain('console');
  });

  it('execute() returns isLongRunning result', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const result = await handler.execute(mockClient as any, {});
    expect(result.success).toBe(true);
    expect((result as any).isLongRunning).toBe(true);
    consoleSpy.mockRestore();
  });

  it('execute() with format=json does not print follow header', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await handler.execute(mockClient as any, { format: 'json' });
    expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Following'));
    consoleSpy.mockRestore();
  });

  it('validateArgs accepts empty args', () => {
    expect(handler.validateArgs({})).toBe(true);
  });

  it('validateArgs accepts valid types', () => {
    expect(handler.validateArgs({ types: ['error', 'warn'] })).toBe(true);
  });

  it('validateArgs rejects invalid types', () => {
    expect(handler.validateArgs({ types: ['invalid'] })).toBe(false);
  });

  it('validateArgs accepts valid format', () => {
    expect(handler.validateArgs({ format: 'json' })).toBe(true);
  });

  it('validateArgs rejects invalid format', () => {
    expect(handler.validateArgs({ format: 'xml' })).toBe(false);
  });

  it('validateArgs accepts textPattern string', () => {
    expect(handler.validateArgs({ textPattern: 'API' })).toBe(true);
  });

  it('getHelp returns string with cdp log examples', () => {
    const help = handler.getHelp();
    expect(help).toContain('cdp log');
    expect(help).toContain('--types');
    expect(help).toContain('--textPattern');
    expect(help).toContain('--format');
  });

  it('getHelp does not reference proxy or historical queries', () => {
    const help = handler.getHelp();
    expect(help).not.toContain('proxy');
    expect(help).not.toContain('--latest');
    expect(help).not.toContain('--maxMessages');
  });
});

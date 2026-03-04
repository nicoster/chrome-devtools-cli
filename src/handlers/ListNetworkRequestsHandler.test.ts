import { ListNetworkRequestsHandler } from './ListNetworkRequestsHandler';
import { CDPClient } from '../types';

class MockCDPClient implements CDPClient {
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async send(): Promise<unknown> { return {}; }
  on(): void {}
  off(): void {}
}

describe('ListNetworkRequestsHandler', () => {
  let handler: ListNetworkRequestsHandler;
  let mockClient: MockCDPClient;

  beforeEach(() => {
    handler = new ListNetworkRequestsHandler();
    mockClient = new MockCDPClient();
    jest.spyOn(process, 'on').mockImplementation(() => process);
    jest.spyOn(process, 'removeAllListeners').mockImplementation(() => process);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should have name "network"', () => {
    expect(handler.name).toBe('network');
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

  it('shouldOutputRequest filters by method', () => {
    const shouldOutput = (handler as any).shouldOutputRequest.bind(handler);
    const req = { method: 'GET', url: 'https://example.com', status: 200 };
    expect(shouldOutput(req, ['POST'], undefined, [])).toBe(false);
    expect(shouldOutput(req, ['GET'], undefined, [])).toBe(true);
    expect(shouldOutput(req, [], undefined, [])).toBe(true);
  });

  it('shouldOutputRequest filters by urlPattern', () => {
    const shouldOutput = (handler as any).shouldOutputRequest.bind(handler);
    const req = { method: 'GET', url: 'https://example.com/api/users', status: 200 };
    expect(shouldOutput(req, [], '/api/', [])).toBe(true);
    expect(shouldOutput(req, [], '/other/', [])).toBe(false);
  });

  it('shouldOutputRequest filters by statusCodes', () => {
    const shouldOutput = (handler as any).shouldOutputRequest.bind(handler);
    const req = { method: 'GET', url: 'https://example.com', status: 404 };
    expect(shouldOutput(req, [], undefined, [404, 500])).toBe(true);
    expect(shouldOutput(req, [], undefined, [200])).toBe(false);
    expect(shouldOutput(req, [], undefined, [])).toBe(true);
  });

  it('parseList handles comma-separated string', () => {
    const parseList = (handler as any).parseList.bind(handler);
    expect(parseList('GET,POST,PUT')).toEqual(['GET', 'POST', 'PUT']);
    expect(parseList(undefined)).toEqual([]);
    expect(parseList(['GET', 'POST'])).toEqual(['GET', 'POST']);
  });

  it('getHelp returns cdp network examples', () => {
    const help = handler.getHelp();
    expect(help).toContain('cdp network');
    expect(help).toContain('--methods');
    expect(help).toContain('--urlPattern');
    expect(help).toContain('--statusCodes');
  });

  it('getHelp does not reference --filter object', () => {
    const help = handler.getHelp();
    expect(help).not.toContain('--filter');
  });
});

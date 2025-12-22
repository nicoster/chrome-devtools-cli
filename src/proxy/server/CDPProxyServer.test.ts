/**
 * Unit tests for CDPProxyServer
 */

import { CDPProxyServer } from './CDPProxyServer';

describe('CDPProxyServer', () => {
  let server: CDPProxyServer;

  beforeEach(() => {
    server = new CDPProxyServer();
  });

  afterEach(async () => {
    if (server.isServerRunning()) {
      await server.stop();
    }
  });

  describe('constructor', () => {
    it('should create server instance with default configuration', () => {
      expect(server).toBeInstanceOf(CDPProxyServer);
      expect(server.isServerRunning()).toBe(false);
    });
  });

  describe('getConfig', () => {
    it('should return default configuration', () => {
      const config = server.getConfig();
      
      expect(config.port).toBe(9223);
      expect(config.host).toBe('localhost');
      expect(config.maxConsoleMessages).toBe(1000);
      expect(config.maxNetworkRequests).toBe(500);
      expect(config.autoShutdownTimeout).toBe(300000);
      expect(config.reconnectMaxAttempts).toBe(5);
      expect(config.reconnectBackoffMs).toBe(1000);
      expect(config.healthCheckInterval).toBe(30000);
    });
  });

  describe('getStatus', () => {
    it('should return server status', () => {
      const status = server.getStatus();
      
      expect(status.isRunning).toBe(false);
      expect(status.config).toBeDefined();
      expect(status.connections).toBe(0);
      expect(typeof status.uptime).toBe('number');
    });
  });

  describe('start and stop', () => {
    it('should start and stop server successfully', async () => {
      // Use a different port to avoid conflicts
      const testConfig = { port: 9224 };
      
      expect(server.isServerRunning()).toBe(false);
      
      await server.start(testConfig);
      expect(server.isServerRunning()).toBe(true);
      
      const config = server.getConfig();
      expect(config.port).toBe(9224);
      
      await server.stop();
      expect(server.isServerRunning()).toBe(false);
    });

    it('should not start if already running', async () => {
      const testConfig = { port: 9225 };
      
      await server.start(testConfig);
      expect(server.isServerRunning()).toBe(true);
      
      // Starting again should not throw
      await server.start(testConfig);
      expect(server.isServerRunning()).toBe(true);
      
      await server.stop();
    });

    it('should handle stop when not running', async () => {
      expect(server.isServerRunning()).toBe(false);
      
      // Stopping when not running should not throw
      await server.stop();
      expect(server.isServerRunning()).toBe(false);
    });
  });

  describe('configuration override', () => {
    it('should merge configuration correctly', async () => {
      const customConfig = {
        port: 9226,
        maxConsoleMessages: 2000,
        autoShutdownTimeout: 600000
      };
      
      await server.start(customConfig);
      
      const config = server.getConfig();
      expect(config.port).toBe(9226);
      expect(config.maxConsoleMessages).toBe(2000);
      expect(config.autoShutdownTimeout).toBe(600000);
      // Other values should remain default
      expect(config.host).toBe('localhost');
      expect(config.maxNetworkRequests).toBe(500);
      
      await server.stop();
    });
  });
});
/**
 * Tests for SecurityManager
 */

import express from 'express';
import { SecurityManager } from './SecurityManager';

describe('SecurityManager', () => {
  let securityManager: SecurityManager;
  let mockReq: Partial<express.Request>;
  let mockRes: Partial<express.Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    securityManager = new SecurityManager();
    mockReq = {
      method: 'GET',
      path: '/api/test',
      ip: '127.0.0.1',
      get: jest.fn(),
      body: {}
    } as any;
    mockRes = {
      setHeader: jest.fn(),
      removeHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  describe('constructor', () => {
    it('should create SecurityManager with default configuration', () => {
      expect(securityManager).toBeInstanceOf(SecurityManager);
      const config = securityManager.getConfig();
      expect(config.enableRateLimit).toBe(true);
      expect(config.enableRequestValidation).toBe(true);
      expect(config.enableInputSanitization).toBe(true);
    });

    it('should create SecurityManager with custom configuration', () => {
      const customConfig = {
        enableRateLimit: false,
        rateLimitMaxRequests: 50
      };
      const customSecurityManager = new SecurityManager(customConfig);
      const config = customSecurityManager.getConfig();
      expect(config.enableRateLimit).toBe(false);
      expect(config.rateLimitMaxRequests).toBe(50);
    });
  });

  describe('getSecurityHeadersMiddleware', () => {
    it('should set security headers when enabled', () => {
      const middleware = securityManager.getSecurityHeadersMiddleware();
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
      expect(mockRes.removeHeader).toHaveBeenCalledWith('X-Powered-By');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip headers when disabled', () => {
      const customSecurityManager = new SecurityManager({ enableSecurityHeaders: false });
      const middleware = customSecurityManager.getSecurityHeadersMiddleware();
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);

      expect(mockRes.setHeader).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('getHostValidationMiddleware', () => {
    it('should allow localhost connections', () => {
      (mockReq as any).path = '/api/connect';
      (mockReq as any).method = 'POST';
      (mockReq as any).body = { host: 'localhost', port: 9222 };

      const middleware = securityManager.getHostValidationMiddleware();
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow 127.0.0.1 connections', () => {
      (mockReq as any).path = '/api/connect';
      (mockReq as any).method = 'POST';
      (mockReq as any).body = { host: '127.0.0.1', port: 9222 };

      const middleware = securityManager.getHostValidationMiddleware();
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow local network connections', () => {
      (mockReq as any).path = '/api/connect';
      (mockReq as any).method = 'POST';
      (mockReq as any).body = { host: '192.168.1.100', port: 9222 };

      const middleware = securityManager.getHostValidationMiddleware();
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject external host connections', () => {
      (mockReq as any).path = '/api/connect';
      (mockReq as any).method = 'POST';
      (mockReq as any).body = { host: 'evil.example.com', port: 9222 };

      const middleware = securityManager.getHostValidationMiddleware();
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Connection to this host is not allowed for security reasons',
        timestamp: expect.any(Number)
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass through non-connect requests', () => {
      (mockReq as any).path = '/api/status';
      (mockReq as any).method = 'GET';

      const middleware = securityManager.getHostValidationMiddleware();
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('getRequestValidationMiddleware', () => {
    it('should validate POST requests have JSON content type', () => {
      (mockReq as any).method = 'POST';
      (mockReq as any).is = jest.fn().mockReturnValue(false);

      const middleware = securityManager.getRequestValidationMiddleware();
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Content-Type must be application/json',
        timestamp: expect.any(Number)
      });
    });

    it('should allow GET requests without content type validation', () => {
      (mockReq as any).method = 'GET';

      const middleware = securityManager.getRequestValidationMiddleware();
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should validate request size', () => {
      (mockReq as any).method = 'POST';
      (mockReq as any).is = jest.fn().mockReturnValue(true); // Pass content-type check
      (mockReq as any).get = jest.fn().mockImplementation((header) => {
        if (header === 'content-type') return 'application/json';
        if (header === 'content-length') return '200000000'; // 200MB
        return undefined;
      });

      const middleware = securityManager.getRequestValidationMiddleware();
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(413);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Request body too large',
        timestamp: expect.any(Number)
      });
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const newConfig = {
        rateLimitMaxRequests: 200,
        enableInputSanitization: false
      };

      securityManager.updateConfig(newConfig);
      const config = securityManager.getConfig();

      expect(config.rateLimitMaxRequests).toBe(200);
      expect(config.enableInputSanitization).toBe(false);
    });
  });
});
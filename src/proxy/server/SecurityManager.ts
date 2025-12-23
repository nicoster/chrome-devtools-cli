/**
 * Security Manager for the Proxy Server
 * 
 * Implements security measures including request validation, sanitization,
 * rate limiting, and access control.
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import { createLogger, Logger } from '../../utils/logger';

export interface SecurityConfig {
  enableRateLimit: boolean;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  enableRequestValidation: boolean;
  enableInputSanitization: boolean;
  allowedHosts: string[];
  maxRequestBodySize: string;
  enableSecurityHeaders: boolean;
}

export class SecurityManager {
  private logger: Logger;
  private config: SecurityConfig;
  private rateLimiter!: express.RequestHandler;
  private strictRateLimiter!: express.RequestHandler;

  constructor(config?: Partial<SecurityConfig>) {
    this.logger = createLogger({ component: 'SecurityManager' });
    
    this.config = {
      enableRateLimit: true,
      rateLimitWindowMs: 60 * 1000, // 1 minute
      rateLimitMaxRequests: 100,
      enableRequestValidation: true,
      enableInputSanitization: true,
      allowedHosts: ['localhost', '127.0.0.1'],
      maxRequestBodySize: '10mb',
      enableSecurityHeaders: true,
      ...config
    };

    this.setupRateLimiters();
    this.logger.info('Security manager initialized', { config: this.config });
  }

  /**
   * Setup rate limiters with different configurations
   */
  private setupRateLimiters(): void {
    // Standard rate limiter for general API endpoints
    this.rateLimiter = rateLimit({
      windowMs: this.config.rateLimitWindowMs,
      max: this.config.rateLimitMaxRequests,
      message: {
        success: false,
        error: 'Too many requests, please try again later',
        timestamp: Date.now()
      },
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        // Skip rate limiting for health checks and status endpoints
        return req.path === '/api/health' || req.path === '/api/status';
      },
      handler: (req, res) => {
        this.logger.logSecurityEvent('rate_limit_exceeded', 'Rate limit exceeded', {
          ip: req.ip,
          path: req.path,
          method: req.method,
          userAgent: req.get('user-agent')
        });
        
        res.status(429).json({
          success: false,
          error: 'Too many requests, please try again later',
          timestamp: Date.now()
        });
      }
    });

    // Strict rate limiter for sensitive operations
    this.strictRateLimiter = rateLimit({
      windowMs: this.config.rateLimitWindowMs,
      max: Math.floor(this.config.rateLimitMaxRequests / 4), // 25% of normal limit
      message: {
        success: false,
        error: 'Too many requests for this operation, please try again later',
        timestamp: Date.now()
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        this.logger.logSecurityEvent('strict_rate_limit_exceeded', 'Strict rate limit exceeded', {
          ip: req.ip,
          path: req.path,
          method: req.method,
          userAgent: req.get('user-agent')
        });
        
        res.status(429).json({
          success: false,
          error: 'Too many requests for this operation, please try again later',
          timestamp: Date.now()
        });
      }
    });
  }

  /**
   * Get the standard rate limiter middleware
   */
  getRateLimiter(): express.RequestHandler {
    return this.config.enableRateLimit ? this.rateLimiter : this.noOpMiddleware;
  }

  /**
   * Get the strict rate limiter middleware for sensitive operations
   */
  getStrictRateLimiter(): express.RequestHandler {
    return this.config.enableRateLimit ? this.strictRateLimiter : this.noOpMiddleware;
  }

  /**
   * Security headers middleware
   */
  getSecurityHeadersMiddleware(): express.RequestHandler {
    return (_req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (!this.config.enableSecurityHeaders) {
        return next();
      }

      // Set security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Content-Security-Policy', "default-src 'self'");
      
      // Remove server information
      res.removeHeader('X-Powered-By');
      
      next();
    };
  }

  /**
   * Request validation middleware
   */
  getRequestValidationMiddleware(): express.RequestHandler {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (!this.config.enableRequestValidation) {
        return next();
      }

      try {
        // Validate request method
        const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
        if (!allowedMethods.includes(req.method)) {
          this.logger.logSecurityEvent('invalid_method', 'Invalid HTTP method', {
            method: req.method,
            ip: req.ip,
            path: req.path
          });
          
          return res.status(405).json({
            success: false,
            error: 'Method not allowed',
            timestamp: Date.now()
          });
        }

        // Validate Content-Type for POST/PUT requests
        if (['POST', 'PUT'].includes(req.method)) {
          const contentType = req.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            this.logger.logSecurityEvent('invalid_content_type', 'Invalid content type', {
              contentType,
              method: req.method,
              ip: req.ip,
              path: req.path
            });
            
            return res.status(400).json({
              success: false,
              error: 'Content-Type must be application/json',
              timestamp: Date.now()
            });
          }
        }

        // Validate request size
        const contentLength = req.get('content-length');
        if (contentLength) {
          const maxSize = this.parseSize(this.config.maxRequestBodySize);
          if (parseInt(contentLength) > maxSize) {
            this.logger.logSecurityEvent('request_too_large', 'Request body too large', {
              contentLength: parseInt(contentLength),
              maxSize,
              ip: req.ip,
              path: req.path
            });
            
            return res.status(413).json({
              success: false,
              error: 'Request body too large',
              timestamp: Date.now()
            });
          }
        }

        // Validate User-Agent header (basic bot detection)
        const userAgent = req.get('user-agent');
        if (!userAgent || this.isSuspiciousUserAgent(userAgent)) {
          this.logger.logSecurityEvent('suspicious_user_agent', 'Suspicious user agent', {
            userAgent,
            ip: req.ip,
            path: req.path
          });
          
          // Don't block, but log for monitoring
        }

        next();
      } catch (error) {
        this.logger.error('Request validation error:', error);
        res.status(500).json({
          success: false,
          error: 'Request validation failed',
          timestamp: Date.now()
        });
      }
    };
  }

  /**
   * Input sanitization middleware
   */
  getInputSanitizationMiddleware(): express.RequestHandler {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (!this.config.enableInputSanitization) {
        return next();
      }

      try {
        // Sanitize request body
        if (req.body && typeof req.body === 'object') {
          req.body = this.sanitizeObject(req.body);
        }

        // Sanitize query parameters
        if (req.query && typeof req.query === 'object') {
          req.query = this.sanitizeObject(req.query);
        }

        // Sanitize URL parameters
        if (req.params && typeof req.params === 'object') {
          req.params = this.sanitizeObject(req.params);
        }

        next();
      } catch (error) {
        this.logger.error('Input sanitization error:', error);
        res.status(500).json({
          success: false,
          error: 'Input sanitization failed',
          timestamp: Date.now()
        });
      }
    };
  }

  /**
   * Host validation middleware - ensures only allowed hosts can connect
   */
  getHostValidationMiddleware(): express.RequestHandler {
    return (req: express.Request, res: express.Response, next: express.NextFunction): void => {
      // For connect requests, validate the target host
      if (req.path === '/api/connect' && req.method === 'POST') {
        const { host } = req.body;
        
        if (host && !this.isAllowedHost(host)) {
          this.logger.logSecurityEvent('unauthorized_host', 'Unauthorized host connection attempt', {
            requestedHost: host,
            clientIP: req.ip,
            allowedHosts: this.config.allowedHosts
          });
          
          res.status(403).json({
            success: false,
            error: 'Connection to this host is not allowed for security reasons',
            timestamp: Date.now()
          });
          return;
        }
      }

      next();
    };
  }

  /**
   * Request logging middleware for security monitoring
   */
  getSecurityLoggingMiddleware(): express.RequestHandler {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const startTime = Date.now();
      
      // Log request details
      this.logger.debug('Security: Request received', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        contentType: req.get('content-type'),
        contentLength: req.get('content-length')
      });

      // Monitor response
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        
        // Log security-relevant responses
        if (res.statusCode >= 400) {
          this.logger.logSecurityEvent('error_response', 'Error response sent', {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration,
            ip: req.ip,
            userAgent: req.get('user-agent')
          });
        }
      });

      next();
    };
  }

  /**
   * Check if a host is allowed for connections
   */
  private isAllowedHost(host: string): boolean {
    // Always allow localhost variants
    if (host === 'localhost' || host === '127.0.0.1') {
      return true;
    }

    // Check against configured allowed hosts
    if (this.config.allowedHosts.includes(host)) {
      return true;
    }

    // Allow local network ranges for development
    if (host.startsWith('192.168.') || 
        host.startsWith('10.') || 
        host.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
      return true;
    }

    return false;
  }

  /**
   * Check if user agent looks suspicious
   */
  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /^$/
    ];

    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * Sanitize an object recursively
   */
  private sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = this.sanitizeString(key);
        sanitized[sanitizedKey] = this.sanitizeObject(value);
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Sanitize a string by removing potentially dangerous characters
   */
  private sanitizeString(str: string): string {
    if (typeof str !== 'string') {
      return str;
    }

    // Remove null bytes and control characters (except newlines and tabs)
    let sanitized = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // Limit string length to prevent DoS
    if (sanitized.length > 10000) {
      sanitized = sanitized.substring(0, 10000);
      this.logger.warn('String truncated during sanitization', { 
        originalLength: str.length,
        truncatedLength: sanitized.length 
      });
    }

    return sanitized;
  }

  /**
   * Parse size string (e.g., "10mb") to bytes
   */
  private parseSize(sizeStr: string): number {
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)$/i);
    if (!match) {
      return 10 * 1024 * 1024; // Default 10MB
    }

    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 'b': return value;
      case 'kb': return value * 1024;
      case 'mb': return value * 1024 * 1024;
      case 'gb': return value * 1024 * 1024 * 1024;
      default: return 10 * 1024 * 1024;
    }
  }

  /**
   * No-op middleware for when security features are disabled
   */
  private noOpMiddleware(_req: express.Request, _res: express.Response, next: express.NextFunction): void {
    next();
  }

  /**
   * Update security configuration
   */
  updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.setupRateLimiters();
    this.logger.info('Security configuration updated', { config: this.config });
  }

  /**
   * Get current security configuration
   */
  getConfig(): SecurityConfig {
    return { ...this.config };
  }
}
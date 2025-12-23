/**
 * File System Security Manager
 * 
 * Implements file system security measures including directory restrictions,
 * sensitive data sanitization, and configuration file permission checks.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createLogger, Logger } from '../../utils/logger';

export interface FileSystemSecurityConfig {
  allowedDirectories: string[];
  configDirectory: string;
  logDirectory: string;
  enablePermissionChecks: boolean;
  enableDataSanitization: boolean;
  maxFileSize: number; // in bytes
}

export class FileSystemSecurity {
  private logger: Logger;
  private config: FileSystemSecurityConfig;
  private allowedPaths: Set<string>;

  constructor(config?: Partial<FileSystemSecurityConfig>) {
    this.logger = createLogger({ component: 'FileSystemSecurity' });
    
    const homeDir = os.homedir();
    const configDir = path.join(homeDir, '.chrome-cdp-cli');
    
    this.config = {
      allowedDirectories: [
        configDir,
        path.join(configDir, 'logs'),
        path.join(configDir, 'config'),
        '/tmp',
        os.tmpdir()
      ],
      configDirectory: configDir,
      logDirectory: path.join(configDir, 'logs'),
      enablePermissionChecks: true,
      enableDataSanitization: true,
      maxFileSize: 100 * 1024 * 1024, // 100MB
      ...config
    };

    this.allowedPaths = new Set();
    this.initializeAllowedPaths();
    this.ensureDirectoriesExist();
    
    this.logger.info('File system security initialized', { 
      config: this.sanitizeConfigForLogging(this.config) 
    });
  }

  /**
   * Initialize allowed paths by resolving and normalizing directory paths
   */
  private initializeAllowedPaths(): void {
    for (const dir of this.config.allowedDirectories) {
      try {
        const resolvedPath = path.resolve(dir);
        this.allowedPaths.add(resolvedPath);
        
        // Also add common subdirectories
        this.allowedPaths.add(path.join(resolvedPath, 'proxy'));
        this.allowedPaths.add(path.join(resolvedPath, 'temp'));
        
      } catch (error) {
        this.logger.warn(`Failed to resolve allowed directory: ${dir}`, { error });
      }
    }
  }

  /**
   * Ensure required directories exist with proper permissions
   */
  private ensureDirectoriesExist(): void {
    const requiredDirs = [
      this.config.configDirectory,
      this.config.logDirectory
    ];

    for (const dir of requiredDirs) {
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); // Owner read/write/execute only
          this.logger.info(`Created directory with secure permissions: ${dir}`);
        } else {
          // Check and fix permissions on existing directories
          this.checkAndFixDirectoryPermissions(dir);
        }
      } catch (error) {
        this.logger.error(`Failed to create/secure directory: ${dir}`, error as Error);
      }
    }
  }

  /**
   * Check if a file path is allowed for operations
   */
  isPathAllowed(filePath: string): boolean {
    try {
      const resolvedPath = path.resolve(filePath);
      const normalizedPath = path.normalize(resolvedPath);
      
      // Check if the path is within any allowed directory
      for (const allowedPath of this.allowedPaths) {
        if (normalizedPath.startsWith(allowedPath)) {
          return true;
        }
      }
      
      this.logger.logSecurityEvent('unauthorized_path_access', 'Attempted access to unauthorized path', {
        requestedPath: filePath,
        resolvedPath,
        allowedPaths: Array.from(this.allowedPaths)
      });
      
      return false;
    } catch (error) {
      this.logger.logSecurityEvent('path_validation_error', 'Error validating file path', {
        requestedPath: filePath,
        error: (error as Error).message
      });
      return false;
    }
  }

  /**
   * Secure file read operation
   */
  async readFileSecurely(filePath: string): Promise<string> {
    if (!this.isPathAllowed(filePath)) {
      throw new Error(`Access denied: Path not allowed - ${filePath}`);
    }

    try {
      // Check file size before reading
      const stats = await fs.promises.stat(filePath);
      if (stats.size > this.config.maxFileSize) {
        throw new Error(`File too large: ${stats.size} bytes (max: ${this.config.maxFileSize})`);
      }

      const content = await fs.promises.readFile(filePath, 'utf8');
      
      this.logger.debug('Secure file read completed', {
        filePath: this.sanitizePath(filePath),
        fileSize: stats.size
      });
      
      return this.config.enableDataSanitization ? this.sanitizeFileContent(content) : content;
      
    } catch (error) {
      this.logger.logSecurityEvent('file_read_error', 'Secure file read failed', {
        filePath: this.sanitizePath(filePath),
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Secure file write operation
   */
  async writeFileSecurely(filePath: string, content: string): Promise<void> {
    if (!this.isPathAllowed(filePath)) {
      throw new Error(`Access denied: Path not allowed - ${filePath}`);
    }

    try {
      // Sanitize content before writing
      const sanitizedContent = this.config.enableDataSanitization 
        ? this.sanitizeFileContent(content) 
        : content;

      // Check content size
      const contentSize = Buffer.byteLength(sanitizedContent, 'utf8');
      if (contentSize > this.config.maxFileSize) {
        throw new Error(`Content too large: ${contentSize} bytes (max: ${this.config.maxFileSize})`);
      }

      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });
      }

      // Write file with secure permissions
      await fs.promises.writeFile(filePath, sanitizedContent, { 
        encoding: 'utf8',
        mode: 0o600 // Owner read/write only
      });
      
      this.logger.debug('Secure file write completed', {
        filePath: this.sanitizePath(filePath),
        contentSize
      });
      
    } catch (error) {
      this.logger.logSecurityEvent('file_write_error', 'Secure file write failed', {
        filePath: this.sanitizePath(filePath),
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Check configuration file permissions and security
   */
  async checkConfigurationSecurity(configPath: string): Promise<{
    isSecure: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      if (!this.isPathAllowed(configPath)) {
        issues.push('Configuration file is not in an allowed directory');
        recommendations.push(`Move configuration to: ${this.config.configDirectory}`);
        return { isSecure: false, issues, recommendations };
      }

      if (!fs.existsSync(configPath)) {
        issues.push('Configuration file does not exist');
        recommendations.push('Create configuration file with secure permissions');
        return { isSecure: false, issues, recommendations };
      }

      const stats = await fs.promises.stat(configPath);
      
      // Check file permissions (should be 600 or 644 at most)
      const mode = stats.mode & parseInt('777', 8);
      if (mode > parseInt('644', 8)) {
        issues.push(`Configuration file has overly permissive permissions: ${mode.toString(8)}`);
        recommendations.push('Set file permissions to 600 (owner read/write only)');
      }

      // Check if file is world-readable
      if (mode & parseInt('004', 8)) {
        issues.push('Configuration file is world-readable');
        recommendations.push('Remove world-read permissions');
      }

      // Check if file is group-writable
      if (mode & parseInt('020', 8)) {
        issues.push('Configuration file is group-writable');
        recommendations.push('Remove group-write permissions');
      }

      // Check file size
      if (stats.size > 1024 * 1024) { // 1MB
        issues.push('Configuration file is unusually large');
        recommendations.push('Review configuration file for unnecessary content');
      }

      // Check file ownership (if running as non-root)
      if (process.getuid && process.getuid() !== 0) {
        const uid = process.getuid();
        if (stats.uid !== uid) {
          issues.push('Configuration file is not owned by current user');
          recommendations.push('Change file ownership to current user');
        }
      }

      const isSecure = issues.length === 0;
      
      this.logger.info('Configuration security check completed', {
        configPath: this.sanitizePath(configPath),
        isSecure,
        issueCount: issues.length
      });

      return { isSecure, issues, recommendations };
      
    } catch (error) {
      this.logger.logSecurityEvent('config_security_check_error', 'Configuration security check failed', {
        configPath: this.sanitizePath(configPath),
        error: (error as Error).message
      });
      
      issues.push(`Security check failed: ${(error as Error).message}`);
      return { isSecure: false, issues, recommendations };
    }
  }

  /**
   * Fix configuration file permissions
   */
  async fixConfigurationPermissions(configPath: string): Promise<void> {
    if (!this.isPathAllowed(configPath)) {
      throw new Error(`Access denied: Path not allowed - ${configPath}`);
    }

    try {
      // Set secure permissions: owner read/write only
      await fs.promises.chmod(configPath, 0o600);
      
      this.logger.info('Configuration file permissions fixed', {
        configPath: this.sanitizePath(configPath),
        newPermissions: '600'
      });
      
    } catch (error) {
      this.logger.logSecurityEvent('permission_fix_error', 'Failed to fix configuration permissions', {
        configPath: this.sanitizePath(configPath),
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Sanitize file content by removing sensitive information
   */
  private sanitizeFileContent(content: string): string {
    let sanitized = content;

    // Remove potential sensitive patterns
    const sensitivePatterns = [
      // API keys and tokens
      /['"](api[_-]?key|token|secret|password)['"]\s*:\s*['"][^'"]+['"]/gi,
      // URLs with credentials
      /https?:\/\/[^:]+:[^@]+@[^\s]+/gi,
      // Private keys
      /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE\s+KEY-----/gi,
      // JWT tokens
      /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g,
      // Credit card numbers (basic pattern)
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
      // Social security numbers
      /\b\d{3}-\d{2}-\d{4}\b/g
    ];

    for (const pattern of sensitivePatterns) {
      sanitized = sanitized.replace(pattern, (match) => {
        this.logger.logSecurityEvent('sensitive_data_sanitized', 'Sensitive data pattern detected and sanitized', {
          patternLength: match.length,
          patternStart: match.substring(0, 10) + '...'
        });
        return '[REDACTED]';
      });
    }

    return sanitized;
  }

  /**
   * Sanitize file path for logging (remove sensitive parts)
   */
  private sanitizePath(filePath: string): string {
    const homeDir = os.homedir();
    return filePath.replace(homeDir, '~');
  }

  /**
   * Sanitize configuration object for logging
   */
  private sanitizeConfigForLogging(config: FileSystemSecurityConfig): any {
    return {
      ...config,
      allowedDirectories: config.allowedDirectories.map(dir => this.sanitizePath(dir)),
      configDirectory: this.sanitizePath(config.configDirectory),
      logDirectory: this.sanitizePath(config.logDirectory)
    };
  }

  /**
   * Check and fix directory permissions
   */
  private checkAndFixDirectoryPermissions(dirPath: string): void {
    try {
      const stats = fs.statSync(dirPath);
      const mode = stats.mode & parseInt('777', 8);
      
      // Directory should be 700 (owner read/write/execute only)
      if (mode !== parseInt('700', 8)) {
        fs.chmodSync(dirPath, 0o700);
        this.logger.info('Fixed directory permissions', {
          directory: this.sanitizePath(dirPath),
          oldMode: mode.toString(8),
          newMode: '700'
        });
      }
    } catch (error) {
      this.logger.warn('Failed to check/fix directory permissions', {
        directory: this.sanitizePath(dirPath),
        error: (error as Error).message
      });
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): FileSystemSecurityConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<FileSystemSecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.allowedPaths.clear();
    this.initializeAllowedPaths();
    this.ensureDirectoriesExist();
    
    this.logger.info('File system security configuration updated', {
      config: this.sanitizeConfigForLogging(this.config)
    });
  }

  /**
   * Add an allowed directory
   */
  addAllowedDirectory(directory: string): void {
    try {
      const resolvedPath = path.resolve(directory);
      this.allowedPaths.add(resolvedPath);
      this.config.allowedDirectories.push(directory);
      
      this.logger.info('Added allowed directory', {
        directory: this.sanitizePath(directory),
        resolvedPath: this.sanitizePath(resolvedPath)
      });
    } catch (error) {
      this.logger.error('Failed to add allowed directory', error as Error, {
        data: { directory: this.sanitizePath(directory) }
      });
    }
  }

  /**
   * Remove an allowed directory
   */
  removeAllowedDirectory(directory: string): void {
    try {
      const resolvedPath = path.resolve(directory);
      this.allowedPaths.delete(resolvedPath);
      
      const index = this.config.allowedDirectories.indexOf(directory);
      if (index > -1) {
        this.config.allowedDirectories.splice(index, 1);
      }
      
      this.logger.info('Removed allowed directory', {
        directory: this.sanitizePath(directory),
        resolvedPath: this.sanitizePath(resolvedPath)
      });
    } catch (error) {
      this.logger.error('Failed to remove allowed directory', error as Error, {
        data: { directory: this.sanitizePath(directory) }
      });
    }
  }
}
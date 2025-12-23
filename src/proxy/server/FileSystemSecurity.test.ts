/**
 * Tests for FileSystemSecurity
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FileSystemSecurity } from './FileSystemSecurity';

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  promises: {
    stat: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn()
  }
}));

describe('FileSystemSecurity', () => {
  let fileSystemSecurity: FileSystemSecurity;
  let tempDir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    tempDir = path.join(os.tmpdir(), 'test-fs-security');
    
    // Mock fs.existsSync to return false by default
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    
    // Mock fs.mkdirSync
    (fs.mkdirSync as jest.Mock).mockImplementation(() => undefined);
    
    fileSystemSecurity = new FileSystemSecurity({
      allowedDirectories: [tempDir],
      configDirectory: tempDir,
      logDirectory: path.join(tempDir, 'logs')
    });
  });

  describe('constructor', () => {
    it('should create FileSystemSecurity with default configuration', () => {
      expect(fileSystemSecurity).toBeInstanceOf(FileSystemSecurity);
      const config = fileSystemSecurity.getConfig();
      expect(config.enablePermissionChecks).toBe(true);
      expect(config.enableDataSanitization).toBe(true);
    });

    it('should create required directories', () => {
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        tempDir,
        { recursive: true, mode: 0o700 }
      );
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        path.join(tempDir, 'logs'),
        { recursive: true, mode: 0o700 }
      );
    });
  });

  describe('isPathAllowed', () => {
    it('should allow paths within allowed directories', () => {
      const testPath = path.join(tempDir, 'test.txt');
      expect(fileSystemSecurity.isPathAllowed(testPath)).toBe(true);
    });

    it('should reject paths outside allowed directories', () => {
      const testPath = '/etc/passwd';
      expect(fileSystemSecurity.isPathAllowed(testPath)).toBe(false);
    });

    it('should handle relative paths correctly', () => {
      const testPath = path.join(tempDir, '..', '..', 'etc', 'passwd');
      expect(fileSystemSecurity.isPathAllowed(testPath)).toBe(false);
    });
  });

  describe('readFileSecurely', () => {
    it('should reject unauthorized paths', async () => {
      const unauthorizedPath = '/etc/passwd';
      
      await expect(fileSystemSecurity.readFileSecurely(unauthorizedPath))
        .rejects.toThrow('Access denied: Path not allowed');
    });

    it('should read authorized files', async () => {
      const authorizedPath = path.join(tempDir, 'test.txt');
      const mockContent = 'test content';
      
      // Mock fs.promises.stat
      const mockStat = { size: mockContent.length };
      (fs.promises.stat as jest.Mock).mockResolvedValue(mockStat);
      
      // Mock fs.promises.readFile
      (fs.promises.readFile as jest.Mock).mockResolvedValue(mockContent);
      
      const result = await fileSystemSecurity.readFileSecurely(authorizedPath);
      expect(result).toBe(mockContent);
      expect(fs.promises.readFile).toHaveBeenCalledWith(authorizedPath, 'utf8');
    });

    it('should reject files that are too large', async () => {
      const authorizedPath = path.join(tempDir, 'large.txt');
      
      // Mock fs.promises.stat to return large file
      const mockStat = { size: 200 * 1024 * 1024 }; // 200MB
      (fs.promises.stat as jest.Mock).mockResolvedValue(mockStat);
      
      await expect(fileSystemSecurity.readFileSecurely(authorizedPath))
        .rejects.toThrow('File too large');
    });
  });

  describe('writeFileSecurely', () => {
    it('should reject unauthorized paths', async () => {
      const unauthorizedPath = '/etc/test.txt';
      
      await expect(fileSystemSecurity.writeFileSecurely(unauthorizedPath, 'content'))
        .rejects.toThrow('Access denied: Path not allowed');
    });

    it('should write to authorized paths', async () => {
      const authorizedPath = path.join(tempDir, 'test.txt');
      const content = 'test content';
      
      // Mock fs.promises.writeFile
      (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);
      
      // Mock fs.promises.mkdir
      (fs.promises.mkdir as jest.Mock).mockResolvedValue(undefined);
      
      await fileSystemSecurity.writeFileSecurely(authorizedPath, content);
      
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        authorizedPath,
        content,
        { encoding: 'utf8', mode: 0o600 }
      );
    });

    it('should reject content that is too large', async () => {
      const authorizedPath = path.join(tempDir, 'test.txt');
      const largeContent = 'x'.repeat(200 * 1024 * 1024); // 200MB
      
      await expect(fileSystemSecurity.writeFileSecurely(authorizedPath, largeContent))
        .rejects.toThrow('Content too large');
    });

    it('should sanitize content when enabled', async () => {
      const authorizedPath = path.join(tempDir, 'test.txt');
      const sensitiveContent = '"api_key": "secret123"'; // Use proper JSON format
      
      // Mock fs.promises.writeFile
      (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);
      (fs.promises.mkdir as jest.Mock).mockResolvedValue(undefined);
      
      await fileSystemSecurity.writeFileSecurely(authorizedPath, sensitiveContent);
      
      // Check that the content was sanitized (should contain [REDACTED])
      const writeCall = (fs.promises.writeFile as jest.Mock).mock.calls[0];
      expect(writeCall[1]).toContain('[REDACTED]');
    });
  });

  describe('checkConfigurationSecurity', () => {
    it('should report unauthorized paths as insecure', async () => {
      const unauthorizedPath = '/etc/config.json';
      
      const result = await fileSystemSecurity.checkConfigurationSecurity(unauthorizedPath);
      
      expect(result.isSecure).toBe(false);
      expect(result.issues).toContain('Configuration file is not in an allowed directory');
    });

    it('should report missing files as insecure', async () => {
      const authorizedPath = path.join(tempDir, 'missing.json');
      
      const result = await fileSystemSecurity.checkConfigurationSecurity(authorizedPath);
      
      expect(result.isSecure).toBe(false);
      expect(result.issues).toContain('Configuration file does not exist');
    });

    it('should check file permissions', async () => {
      const authorizedPath = path.join(tempDir, 'config.json');
      
      // Mock file exists
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      
      // Mock fs.promises.stat with overly permissive permissions
      const mockStat = { 
        size: 1024,
        mode: 0o100777, // World writable
        uid: process.getuid ? process.getuid() : 1000
      };
      (fs.promises.stat as jest.Mock).mockResolvedValue(mockStat);
      
      const result = await fileSystemSecurity.checkConfigurationSecurity(authorizedPath);
      
      expect(result.isSecure).toBe(false);
      expect(result.issues.some(issue => issue.includes('overly permissive permissions'))).toBe(true);
    });
  });

  describe('addAllowedDirectory', () => {
    it('should add directory to allowed paths', () => {
      const newDir = '/tmp/new-allowed';
      fileSystemSecurity.addAllowedDirectory(newDir);
      
      const testPath = path.join(newDir, 'test.txt');
      expect(fileSystemSecurity.isPathAllowed(testPath)).toBe(true);
    });
  });

  describe('removeAllowedDirectory', () => {
    it('should remove directory from allowed paths', () => {
      const testPath = path.join(tempDir, 'test.txt');
      expect(fileSystemSecurity.isPathAllowed(testPath)).toBe(true);
      
      fileSystemSecurity.removeAllowedDirectory(tempDir);
      expect(fileSystemSecurity.isPathAllowed(testPath)).toBe(false);
    });
  });
});
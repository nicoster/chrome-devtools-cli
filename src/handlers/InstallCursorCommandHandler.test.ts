import { InstallCursorCommandHandler } from './InstallCursorCommandHandler';
import { CDPClient } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs module
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('InstallCursorCommandHandler', () => {
  let handler: InstallCursorCommandHandler;
  let mockClient: jest.Mocked<CDPClient>;

  beforeEach(() => {
    handler = new InstallCursorCommandHandler();
    mockClient = {} as jest.Mocked<CDPClient>;
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup default mock implementations
    mockFs.access.mockImplementation((path) => {
      // By default, .cursor directory exists
      if (path === '.cursor') {
        return Promise.resolve(undefined);
      }
      // Other directories don't exist
      return Promise.reject(new Error('Directory does not exist'));
    });
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
  });

  describe('execute', () => {
    it('should create cursor commands with default settings', async () => {
      // Mock .cursor directory exists
      mockFs.access.mockImplementation((path) => {
        if (path === '.cursor') {
          return Promise.resolve(undefined);
        }
        return Promise.reject(new Error('Directory does not exist'));
      });

      const result = await handler.execute(mockClient, {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        installed: 1,
        directory: '.cursor/commands',
        commands: ['cdp-cli'],
        files: expect.arrayContaining([
          '.cursor/commands/cdp-cli.md'
        ])
      });

      // Verify directory creation
      expect(mockFs.mkdir).toHaveBeenCalledWith('.cursor/commands', { recursive: true });

      // Verify file creation
      expect(mockFs.writeFile).toHaveBeenCalledTimes(1);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '.cursor/commands/cdp-cli.md',
        expect.stringContaining('# Chrome DevTools Protocol CLI 工具'),
        'utf8'
      );
    });

    it('should use custom target directory', async () => {
      const customDir = 'custom/commands';
      const result = await handler.execute(mockClient, {
        targetDirectory: customDir
      });

      expect(result.success).toBe(true);
      expect((result.data as any)?.directory).toBe(customDir);
      expect(mockFs.mkdir).toHaveBeenCalledWith(customDir, { recursive: true });
    });

    it('should warn when .cursor directory does not exist', async () => {
      // Mock .cursor directory not existing
      mockFs.access.mockImplementation((path) => {
        if (path === '.cursor') {
          return Promise.reject(new Error('Directory does not exist'));
        }
        return Promise.reject(new Error('Directory does not exist'));
      });

      const result = await handler.execute(mockClient, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('No .cursor directory found');
      expect(result.error).toContain('--force');
    });

    it('should install when using --force even without .cursor directory', async () => {
      // Mock .cursor directory not existing
      mockFs.access.mockImplementation((path) => {
        if (path === '.cursor') {
          return Promise.reject(new Error('Directory does not exist'));
        }
        return Promise.reject(new Error('Directory does not exist'));
      });

      const result = await handler.execute(mockClient, { force: true });

      expect(result.success).toBe(true);
      expect(mockFs.mkdir).toHaveBeenCalledWith('.cursor/commands', { recursive: true });
    });

    it('should handle file write errors', async () => {
      const writeError = new Error('Permission denied');
      mockFs.writeFile.mockRejectedValue(writeError);

      const result = await handler.execute(mockClient, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
    });

    it('should handle directory creation errors', async () => {
      const mkdirError = new Error('Cannot create directory');
      mockFs.mkdir.mockRejectedValue(mkdirError);

      const result = await handler.execute(mockClient, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot create directory');
    });
  });

  describe('generateCommandMarkdown', () => {
    it('should generate valid markdown content', async () => {
      const result = await handler.execute(mockClient, {});

      expect(result.success).toBe(true);

      // Check that writeFile was called with proper markdown content
      const writeFileCalls = mockFs.writeFile.mock.calls;
      const automationCommandCall = writeFileCalls.find(call => 
        call[0] === '.cursor/commands/cdp-cli.md'
      );

      expect(automationCommandCall).toBeDefined();
      const markdownContent = automationCommandCall![1] as string;

      // Verify markdown structure
      expect(markdownContent).toContain('# Chrome DevTools Protocol CLI 工具');
      expect(markdownContent).toContain('## 完整命令列表');
      expect(markdownContent).toContain('### 1. JavaScript 执行');
      expect(markdownContent).toContain('### 2. 页面截图和快照');
      expect(markdownContent).toContain('### 3. 元素交互');
      expect(markdownContent).toContain('### 4. 高级交互');
      expect(markdownContent).toContain('### 5. 监控功能');
      expect(markdownContent).toContain('## 使用示例');
      expect(markdownContent).toContain('## 前置条件');
      expect(markdownContent).toContain('chrome-cdp-cli eval');
      expect(markdownContent).toContain('--remote-debugging-port=9222');
    });

    it('should include all expected commands', async () => {
      const result = await handler.execute(mockClient, {});

      expect(result.success).toBe(true);
      expect((result.data as any)?.commands).toEqual([
        'cdp-cli'
      ]);
    });

    it('should generate unique content for each command', async () => {
      const result = await handler.execute(mockClient, {});

      expect(result.success).toBe(true);

      const writeFileCalls = mockFs.writeFile.mock.calls;
      const contents = writeFileCalls.map(call => call[1] as string);

      // Should have one unified command file
      expect(contents.length).toBe(1);

      // Should contain all functionality descriptions
      const content = contents[0];
      expect(content).toContain('JavaScript 执行');
      expect(content).toContain('页面截图和快照');
      expect(content).toContain('元素交互');
      expect(content).toContain('监控功能');
      expect(content).toContain('IDE 集成');
    });
  });

  describe('command configuration', () => {
    it('should have correct handler name', () => {
      expect(handler.name).toBe('install_cursor_command');
    });

    it('should generate commands with proper structure', async () => {
      const result = await handler.execute(mockClient, {});
      expect(result.success).toBe(true);

      // Verify all files have .md extension
      const files = (result.data as any)?.files as string[];
      files.forEach(file => {
        expect(path.extname(file)).toBe('.md');
      });
    });
  });
});
import { InstallClaudeSkillHandler } from './InstallClaudeSkillHandler';
import { CDPClient } from '../types';
import * as fs from 'fs/promises';
import * as os from 'os';

// Mock fs module
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock os module
jest.mock('os');
const mockOs = os as jest.Mocked<typeof os>;

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('InstallClaudeSkillHandler', () => {
  let handler: InstallClaudeSkillHandler;
  let mockClient: jest.Mocked<CDPClient>;

  beforeEach(() => {
    handler = new InstallClaudeSkillHandler();
    mockClient = {} as jest.Mocked<CDPClient>;
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup default mock implementations
    mockFs.access.mockImplementation((path) => {
      // By default, .claude directory exists
      if (path === '.claude') {
        return Promise.resolve(undefined);
      }
      // Other directories don't exist
      return Promise.reject(new Error('Directory does not exist'));
    });
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockOs.homedir.mockReturnValue('/home/testuser');
  });

  describe('execute', () => {
    it('should create project-level skill with default settings', async () => {
      // Mock .claude directory exists
      mockFs.access.mockImplementation((path) => {
        if (path === '.claude') {
          return Promise.resolve(undefined);
        }
        return Promise.reject(new Error('Directory does not exist'));
      });

      const result = await handler.execute(mockClient, {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        skillType: 'project',
        directory: '.claude/skills/cdp-cli',
        files: ['SKILL.md'],
        skillName: 'cdp-cli'
      });

      // Verify directory creation
      expect(mockFs.mkdir).toHaveBeenCalledWith('.claude/skills/cdp-cli', { recursive: true });

      // Verify SKILL.md creation
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '.claude/skills/cdp-cli/SKILL.md',
        expect.stringContaining('---'),
        'utf8'
      );
    });

    it('should create personal-level skill', async () => {
      const result = await handler.execute(mockClient, {
        skillType: 'personal'
      });

      expect(result.success).toBe(true);
      expect((result.data as any)?.skillType).toBe('personal');
      expect((result.data as any)?.directory).toBe('/home/testuser/.claude/skills/cdp-cli');
      expect(mockFs.mkdir).toHaveBeenCalledWith('/home/testuser/.claude/skills/cdp-cli', { recursive: true });
    });

    it('should use custom target directory', async () => {
      const customDir = 'custom/skills';
      const result = await handler.execute(mockClient, {
        targetDirectory: customDir
      });

      expect(result.success).toBe(true);
      expect((result.data as any)?.directory).toBe('custom/skills/cdp-cli');
      expect(mockFs.mkdir).toHaveBeenCalledWith('custom/skills/cdp-cli', { recursive: true });
    });

    it('should include examples file when requested', async () => {
      const result = await handler.execute(mockClient, {
        includeExamples: true
      });

      expect(result.success).toBe(true);
      expect((result.data as any)?.files).toContain('examples.md');
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '.claude/skills/cdp-cli/examples.md',
        expect.stringContaining('# Chrome Automation Examples'),
        'utf8'
      );
    });

    it('should include references file when requested', async () => {
      const result = await handler.execute(mockClient, {
        includeReferences: true
      });

      expect(result.success).toBe(true);
      expect((result.data as any)?.files).toContain('reference.md');
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '.claude/skills/cdp-cli/reference.md',
        expect.stringContaining('# Chrome DevTools CLI Reference'),
        'utf8'
      );
    });

    it('should include all files when all options are enabled', async () => {
      const result = await handler.execute(mockClient, {
        includeExamples: true,
        includeReferences: true
      });

      expect(result.success).toBe(true);
      expect((result.data as any)?.files).toEqual(['SKILL.md', 'examples.md', 'reference.md']);
      expect(mockFs.writeFile).toHaveBeenCalledTimes(3);
    });

    it('should not create directory if it already exists', async () => {
      mockFs.access.mockResolvedValue(undefined); // Directory exists

      const result = await handler.execute(mockClient, {});

      expect(result.success).toBe(true);
      expect(mockFs.mkdir).not.toHaveBeenCalled();
    });

    it('should warn when .claude directory does not exist for project type', async () => {
      // Mock .claude directory not existing
      mockFs.access.mockImplementation((path) => {
        if (path === '.claude') {
          return Promise.reject(new Error('Directory does not exist'));
        }
        return Promise.reject(new Error('Directory does not exist'));
      });

      const result = await handler.execute(mockClient, { skillType: 'project' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No .claude directory found');
      expect(result.error).toContain('--force');
    });

    it('should install when using --force even without .claude directory', async () => {
      // Mock .claude directory not existing
      mockFs.access.mockImplementation((path) => {
        if (path === '.claude') {
          return Promise.reject(new Error('Directory does not exist'));
        }
        return Promise.reject(new Error('Directory does not exist'));
      });

      const result = await handler.execute(mockClient, { 
        skillType: 'project',
        force: true 
      });

      expect(result.success).toBe(true);
      expect(mockFs.mkdir).toHaveBeenCalledWith('.claude/skills/cdp-cli', { recursive: true });
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

  describe('generateSkillMarkdown', () => {
    it('should generate valid YAML frontmatter', async () => {
      const result = await handler.execute(mockClient, {});

      expect(result.success).toBe(true);

      const writeFileCalls = mockFs.writeFile.mock.calls;
      const skillCall = writeFileCalls.find(call => 
        (call[0] as string).endsWith('SKILL.md')
      );

      expect(skillCall).toBeDefined();
      const markdownContent = skillCall![1] as string;

      // Verify YAML frontmatter structure
      expect(markdownContent).toMatch(/^---\n/);
      expect(markdownContent).toContain('name: cdp-cli');
      expect(markdownContent).toContain('description: Chrome browser automation');
      expect(markdownContent).toContain('allowedTools:');
      expect(markdownContent).toMatch(/---\n\n/);
    });

    it('should include skill instructions', async () => {
      const result = await handler.execute(mockClient, {});

      expect(result.success).toBe(true);

      const writeFileCalls = mockFs.writeFile.mock.calls;
      const skillCall = writeFileCalls.find(call => 
        (call[0] as string).endsWith('SKILL.md')
      );

      const markdownContent = skillCall![1] as string;

      // Verify instructions content
      expect(markdownContent).toContain('# Chrome Browser Automation');
      expect(markdownContent).toContain('## Instructions');
      expect(markdownContent).toContain('## Available Commands');
      expect(markdownContent).toContain('## Usage Examples');
      expect(markdownContent).toContain('## Prerequisites');
      expect(markdownContent).toContain('chrome-cdp-cli eval');
      expect(markdownContent).toContain('--remote-debugging-port=9222');
    });

    it('should include allowed tools in frontmatter', async () => {
      const result = await handler.execute(mockClient, {});

      expect(result.success).toBe(true);

      const writeFileCalls = mockFs.writeFile.mock.calls;
      const skillCall = writeFileCalls.find(call => 
        (call[0] as string).endsWith('SKILL.md')
      );

      const markdownContent = skillCall![1] as string;

      expect(markdownContent).toContain('allowedTools: ["Execute", "Read", "Write"]');
    });
  });

  describe('examples file generation', () => {
    it('should generate comprehensive examples', async () => {
      const result = await handler.execute(mockClient, {
        includeExamples: true
      });

      expect(result.success).toBe(true);

      const writeFileCalls = mockFs.writeFile.mock.calls;
      const examplesCall = writeFileCalls.find(call => 
        (call[0] as string).endsWith('examples.md')
      );

      expect(examplesCall).toBeDefined();
      const examplesContent = examplesCall![1] as string;

      // Verify examples structure
      expect(examplesContent).toContain('# Chrome Automation Examples');
      expect(examplesContent).toContain('## Basic JavaScript Execution');
      expect(examplesContent).toContain('## Visual Capture');
      expect(examplesContent).toContain('## Monitoring');
      expect(examplesContent).toContain('## Common Workflows');
      expect(examplesContent).toContain('### Testing Form Submission');
      expect(examplesContent).toContain('### API Testing');
    });
  });

  describe('reference file generation', () => {
    it('should generate comprehensive reference documentation', async () => {
      const result = await handler.execute(mockClient, {
        includeReferences: true
      });

      expect(result.success).toBe(true);

      const writeFileCalls = mockFs.writeFile.mock.calls;
      const referenceCall = writeFileCalls.find(call => 
        (call[0] as string).endsWith('reference.md')
      );

      expect(referenceCall).toBeDefined();
      const referenceContent = referenceCall![1] as string;

      // Verify reference structure
      expect(referenceContent).toContain('# Chrome DevTools CLI Reference');
      expect(referenceContent).toContain('## Command Reference');
      expect(referenceContent).toContain('### eval');
      expect(referenceContent).toContain('### screenshot');
      expect(referenceContent).toContain('### snapshot');
      expect(referenceContent).toContain('## Global Options');
      expect(referenceContent).toContain('## Chrome Setup');
      expect(referenceContent).toContain('## Error Handling');
      expect(referenceContent).toContain('## Integration Examples');
    });
  });

  describe('command configuration', () => {
    it('should have correct handler name', () => {
      expect(handler.name).toBe('install_claude_skill');
    });

    it('should create skill directory with correct name', async () => {
      const result = await handler.execute(mockClient, {});
      expect(result.success).toBe(true);
      expect((result.data as any)?.directory).toContain('cdp-cli');
    });
  });
});
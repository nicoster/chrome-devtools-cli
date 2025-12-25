import { EnhancedCLIInterface } from './EnhancedCLIInterface';

describe('EnhancedCLIInterface', () => {
  let cli: EnhancedCLIInterface;
  let mockExit: jest.SpyInstance;
  let mockConsoleLog: jest.SpyInstance;

  beforeEach(() => {
    cli = new EnhancedCLIInterface();
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockConsoleLog.mockRestore();
  });

  describe('parseArgs', () => {
    it('should parse help command correctly', () => {
      // Set NODE_ENV to test to prevent process.exit
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      
      try {
        expect(() => {
          cli.parseArgs(['node', 'script.js', 'help']);
        }).toThrow('HELP_COMMAND_EXECUTED');
        
        expect(mockConsoleLog).toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should parse command with global options correctly', () => {
      const result = cli.parseArgs(['node', 'script.js', '--host', '127.0.0.1', '--port', '9223', '--format', 'json', '--verbose', 'eval', '--expression', 'console.log("test")']);
      
      expect(result.name).toBe('eval');
      expect(result.config.host).toBe('127.0.0.1');
      expect(result.config.port).toBe(9223);
      expect(result.config.outputFormat).toBe('json');
      expect(result.config.verbose).toBe(true);
      expect(result.args.expression).toBe('console.log("test")');
    });

    it('should parse boolean negation correctly', () => {
      const result = cli.parseArgs(['node', 'script.js', '--no-verbose', '--no-debug', 'eval', 'test']);
      
      expect(result.config.verbose).toBe(false);
      expect(result.config.debug).toBe(false);
      expect(result.name).toBe('eval');
    });

    it('should parse screenshot command with options correctly', () => {
      const result = cli.parseArgs(['node', 'script.js', 'screenshot', '--filename', 'test.png', '--width', '800', '--height', '600', '--full-page']);
      
      expect(result.name).toBe('screenshot');
      expect(result.args.filename).toBe('test.png');
      expect(result.args.width).toBe(800);
      expect(result.args.height).toBe(600);
      expect(result.args['full-page']).toBe(true);
    });

    it('should parse click command with selector argument', () => {
      const result = cli.parseArgs(['node', 'script.js', 'click', '#submit-button']);
      
      expect(result.name).toBe('click');
      expect(result.args.selector).toBe('#submit-button');
    });

    it('should parse fill command with selector and text arguments', () => {
      const result = cli.parseArgs(['node', 'script.js', 'fill', '#username', 'john@example.com']);
      
      expect(result.name).toBe('fill');
      expect(result.args.selector).toBe('#username');
      expect(result.args.text).toBe('john@example.com');
    });

    it('should handle command aliases', () => {
      const result = cli.parseArgs(['node', 'script.js', 'ss', '--filename', 'test.png']);
      
      expect(result.name).toBe('screenshot'); // Resolved from alias 'ss'
      expect(result.args.filename).toBe('test.png');
    });

    it('should handle eval command aliases', () => {
      const result1 = cli.parseArgs(['node', 'script.js', 'js', 'document.title']);
      expect(result1.name).toBe('eval');
      expect(result1.args.expression).toBe('document.title');

      const result2 = cli.parseArgs(['node', 'script.js', 'execute', '--expression', 'window.location.href']);
      expect(result2.name).toBe('eval');
      expect(result2.args.expression).toBe('window.location.href');
    });

    it('should default to help command when no command provided', () => {
      // Set NODE_ENV to test to prevent process.exit
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      
      try {
        expect(() => {
          cli.parseArgs(['node', 'script.js']);
        }).toThrow('HELP_COMMAND_EXECUTED');
        
        expect(mockConsoleLog).toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should handle parse errors gracefully', () => {
      expect(() => {
        cli.parseArgs(['node', 'script.js', 'unknown-command']);
      }).toThrow('Parse error');
    });
  });

  describe('showHelp', () => {
    it('should generate help for specific command', () => {
      const help = cli.showHelp('eval');
      
      expect(help).toContain('EVAL');
      expect(help).toContain('Execute JavaScript code in the browser');
      expect(help).toContain('USAGE');
      expect(help).toContain('OPTIONS');
      expect(help).toContain('EXAMPLES');
    });

    it('should generate general help', () => {
      const help = cli.showHelp();
      
      expect(help).toContain('CHROME DEVTOOLS CLI - ENHANCED HELP SYSTEM');
      expect(help).toContain('GLOBAL OPTIONS');
      expect(help).toContain('AVAILABLE COMMANDS');
    });

    it('should handle unknown command in help', () => {
      const help = cli.showHelp('unknown');
      
      expect(help).toContain('ERROR: Unknown command');
    });
  });

  describe('getAvailableCommands', () => {
    it('should return list of available commands', () => {
      const commands = cli.getAvailableCommands();
      
      expect(commands).toContain('help');
      expect(commands).toContain('eval');
      expect(commands).toContain('screenshot');
      expect(commands).toContain('click');
      expect(commands).toContain('fill');
      expect(Array.isArray(commands)).toBe(true);
    });
  });

  describe('formatOutput', () => {
    it('should format JSON output correctly', () => {
      const result = {
        success: true,
        data: { message: 'test' }
      };
      
      const output = cli.formatOutput(result, 'json');
      
      expect(output).toContain('"success": true');
      expect(output).toContain('"message": "test"');
    });

    it('should format text output correctly', () => {
      const result = {
        success: true,
        data: 'test message'
      };
      
      const output = cli.formatOutput(result, 'text');
      
      expect(output).toBe('test message');
    });

    it('should format error output correctly', () => {
      const result = {
        success: false,
        error: 'Something went wrong'
      };
      
      const output = cli.formatOutput(result, 'text');
      
      expect(output).toBe('Error: Something went wrong');
    });

    it('should handle console messages output', () => {
      const result = {
        success: true,
        data: {
          messages: [
            {
              type: 'log',
              text: 'Hello world',
              timestamp: Date.now(),
              args: []
            }
          ]
        }
      };
      
      const output = cli.formatOutput(result, 'text');
      
      expect(output).toContain('Found 1 console message(s)');
      expect(output).toContain('[LOG] Hello world');
    });
  });

  describe('Integration', () => {
    it('should have argument parser properly initialized', () => {
      const parser = cli.getArgumentParser();
      
      expect(parser.hasCommand('help')).toBe(true);
      expect(parser.hasCommand('eval')).toBe(true);
      expect(parser.hasCommand('screenshot')).toBe(true);
    });

    it('should have schema registry properly initialized', () => {
      const registry = cli.getSchemaRegistry();
      
      expect(registry.hasCommand('help')).toBe(true);
      expect(registry.hasCommand('eval')).toBe(true);
      expect(registry.hasCommand('screenshot')).toBe(true);
    });

    it('should resolve command aliases correctly', () => {
      const parser = cli.getArgumentParser();
      
      expect(parser.hasCommand('ss')).toBe(true); // screenshot alias
      expect(parser.hasCommand('js')).toBe(true); // eval alias
      expect(parser.hasCommand('h')).toBe(true); // help alias
    });
  });
});
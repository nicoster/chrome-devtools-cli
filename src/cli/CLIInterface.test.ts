import { CLIInterface } from './CLIInterface';
import { EvaluateScriptHandler } from '../handlers/EvaluateScriptHandler';

describe('CLIInterface', () => {
  let cli: CLIInterface;

  beforeEach(() => {
    cli = new CLIInterface();
    cli.registerHandler(new EvaluateScriptHandler(false)); // Disable proxy for tests
  });

  describe('parseArgs', () => {
    it('should parse help command correctly', () => {
      const result = cli.parseArgs(['node', 'script.js', 'help']);
      
      expect(result.name).toBe('help');
      expect(result.config.host).toBe('localhost');
      expect(result.config.port).toBe(9222);
      expect(result.config.outputFormat).toBe('text');
      expect(result.config.debug).toBe(false);
    });

    it('should parse command with options correctly', () => {
      const result = cli.parseArgs(['node', 'script.js', '--host', '127.0.0.1', '--port', '9223', '--format', 'json', 'eval', '--expression', 'console.log("test")']);
      
      expect(result.name).toBe('eval');
      expect(result.config.host).toBe('127.0.0.1');
      expect(result.config.port).toBe(9223);
      expect(result.config.outputFormat).toBe('json');
      expect(result.args.expression).toBe('console.log("test")');
    });

    it('should parse short options correctly', () => {
      const result = cli.parseArgs(['node', 'script.js', '-h', '192.168.1.1', '-p', '9224', '-f', 'json', '-v', 'help']);
      
      expect(result.config.host).toBe('192.168.1.1');
      expect(result.config.port).toBe(9224);
      expect(result.config.outputFormat).toBe('json');
      expect(result.config.verbose).toBe(true);
      expect(result.config.debug).toBe(false);
    });

    it('should parse debug flag correctly', () => {
      const result = cli.parseArgs(['node', 'script.js', '--debug', 'help']);
      
      expect(result.config.debug).toBe(true);
    });

    it('should parse short debug flag correctly', () => {
      const result = cli.parseArgs(['node', 'script.js', '-d', 'help']);
      
      expect(result.config.debug).toBe(true);
    });

    it('should default to help command when no command provided', () => {
      const result = cli.parseArgs(['node', 'script.js']);
      
      expect(result.name).toBe('help');
    });

    it('should parse eval command arguments correctly', () => {
      const result = cli.parseArgs(['node', 'script.js', 'eval', '--expression', 'document.title', '--await-promise']);
      
      expect(result.name).toBe('eval');
      expect(result.args.expression).toBe('document.title');
      expect(result.args.awaitPromise).toBe(true);
    });

    it('should parse navigate command correctly', () => {
      const result = cli.parseArgs(['node', 'script.js', 'navigate', 'https://example.com']);
      
      expect(result.name).toBe('navigate');
      expect(result.args.url).toBe('https://example.com');
    });

    it('should parse screenshot command with options correctly', () => {
      const result = cli.parseArgs(['node', 'script.js', 'screenshot', '--output', 'test.png', '--width', '800', '--height', '600']);
      
      expect(result.name).toBe('screenshot');
      expect(result.args.filename).toBe('test.png'); // Changed from output to filename
      expect(result.args.width).toBe(800);
      expect(result.args.height).toBe(600);
    });
  });

  describe('formatOutput', () => {
    it('should format successful result as text', () => {
      const result = { success: true, data: 'Hello World' };
      const output = cli.formatOutput(result, 'text');
      
      expect(output).toBe('Hello World');
    });

    it('should format successful result as JSON', () => {
      const result = { success: true, data: { message: 'Hello World' } };
      const output = cli.formatOutput(result, 'json');
      
      expect(output).toBe(JSON.stringify(result, null, 2));
    });

    it('should format error result as text', () => {
      const result = { success: false, error: 'Something went wrong' };
      const output = cli.formatOutput(result, 'text');
      
      expect(output).toBe('❌ Error: Something went wrong');
    });

    it('should format error result as JSON', () => {
      const result = { success: false, error: 'Something went wrong' };
      const output = cli.formatOutput(result, 'json');
      
      // The JSON output includes exitCode when formatting through OutputManager
      const expectedResult = { ...result, exitCode: 1 };
      expect(output).toBe(JSON.stringify(expectedResult, null, 2));
    });

    it('should handle null/undefined data', () => {
      const result = { success: true, data: null };
      const output = cli.formatOutput(result, 'text');
      
      expect(output).toBe('Success');
    });

    it('should handle object data in text format', () => {
      const result = { success: true, data: { key: 'value' } };
      const output = cli.formatOutput(result, 'text');
      
      // The new OutputManager formats objects differently
      expect(output).toBe('Object with 1 properties: key');
    });
  });

  describe('getAvailableCommands', () => {
    it('should return list of registered commands', () => {
      const commands = cli.getAvailableCommands();
      
      expect(commands).toContain('eval');
    });
  });

  describe('showHelp', () => {
    it('should return help for specific command', () => {
      const help = cli.showHelp('eval');
      
      expect(help).toContain('eval'); // help text still shows original name
      expect(help).toContain('Execute JavaScript code');
    });

    it('should return general help when no command specified', () => {
      const help = cli.showHelp();
      
      expect(help).toContain('Command-line tool for controlling Chrome browser');
      expect(help).toContain('Usage:');
    });

    it('should handle unknown command', () => {
      const help = cli.showHelp('unknown-command');
      
      expect(help).toBe('Unknown command: unknown-command');
    });
  });
});
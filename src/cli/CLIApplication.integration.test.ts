import { CLIApplication } from './CLIApplication';

describe('CLIApplication Integration', () => {
  let app: CLIApplication;

  beforeEach(() => {
    app = new CLIApplication();
  });

  afterEach(async () => {
    await app.shutdown();
  });

  describe('Enhanced CLI Integration', () => {
    it('should use EnhancedCLIInterface', () => {
      const cli = app.getCLI();
      expect(cli.constructor.name).toBe('EnhancedCLIInterface');
    });

    it('should have ConfigurationManager', () => {
      const configManager = app.getConfigurationManager();
      expect(configManager).toBeDefined();
      expect(configManager.constructor.name).toBe('ConfigurationManager');
    });

    it('should have OutputManager', () => {
      const outputManager = app.getOutputManager();
      expect(outputManager).toBeDefined();
      expect(outputManager.constructor.name).toBe('OutputManager');
    });

    it('should handle help command with enhanced parser', async () => {
      // The help command should be handled by the enhanced parser
      // We'll test this by checking that the CLI uses the enhanced interface
      const cli = app.getCLI();
      expect(cli.constructor.name).toBe('EnhancedCLIInterface');
      
      // Test that help generation works
      const helpText = cli.showHelp();
      expect(helpText).toContain('CHROME DEVTOOLS CLI');
      expect(helpText).toContain('AVAILABLE COMMANDS');
    });

    it('should handle version command with enhanced parser', async () => {
      // Mock console.log to capture version output
      const originalLog = console.log;
      const logSpy = jest.fn();
      console.log = logSpy;

      // Mock process.exit to prevent actual exit
      const originalExit = process.exit;
      process.exit = jest.fn() as any;

      try {
        await app.run(['node', 'script', '--version']);
        expect(logSpy).toHaveBeenCalled();
      } finally {
        console.log = originalLog;
        process.exit = originalExit;
      }
    });

    it('should handle configuration errors gracefully', async () => {
      // Test that configuration loading works
      const configManager = app.getConfigurationManager();
      expect(configManager).toBeDefined();
      
      // Test that the application can handle commands without crashing
      // The eval command should succeed in parsing but fail in execution due to no Chrome connection
      const exitCode = await app.run(['node', 'script', 'eval', '"test"']);
      // Should succeed because eval command is valid, but execution will fail
      expect(exitCode).toBe(0); // Success in parsing, execution handled by router
    });

    it('should handle parse errors gracefully', async () => {
      const exitCode = await app.run(['node', 'script', 'invalid-command-with-bad-args', '--invalid-option']);
      expect(exitCode).toBe(8); // INVALID_ARGUMENTS
    });
  });

  describe('Command Registration', () => {
    it('should have all handlers registered', () => {
      const cli = app.getCLI();
      const registry = cli.getRegistry();
      const commands = registry.getCommandNames();
      
      // Check that essential commands are registered
      expect(commands).toContain('eval');
      expect(commands).toContain('screenshot');
      expect(commands).toContain('click');
      expect(commands).toContain('fill');
      expect(commands).toContain('hover');
    });

    it('should have command schemas available', () => {
      const cli = app.getCLI();
      const schemaRegistry = cli.getSchemaRegistry();
      
      // Check that command definitions are available
      expect(schemaRegistry.hasCommand('eval')).toBe(true);
      expect(schemaRegistry.hasCommand('screenshot')).toBe(true);
      expect(schemaRegistry.hasCommand('help')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should format errors with enhanced error handling', async () => {
      // Mock console.error to capture error output
      const originalError = console.error;
      const errorSpy = jest.fn();
      console.error = errorSpy;

      try {
        const exitCode = await app.run(['node', 'script', 'nonexistent-command']);
        expect(exitCode).toBe(8); // INVALID_ARGUMENTS
        expect(errorSpy).toHaveBeenCalled();
        
        // Check that error includes contextual help
        const errorOutput = errorSpy.mock.calls[0][0];
        expect(errorOutput).toContain('Unknown command');
      } finally {
        console.error = originalError;
      }
    });
  });
});
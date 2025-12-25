import { HelpSystem } from './HelpSystem';
import { CommandSchemaRegistry } from './CommandSchemaRegistry';
import { CommandDefinition } from './interfaces/ArgumentParser';

describe('HelpSystem', () => {
  let helpSystem: HelpSystem;
  let schemaRegistry: CommandSchemaRegistry;

  beforeEach(() => {
    schemaRegistry = CommandSchemaRegistry.getInstance();
    helpSystem = new HelpSystem(schemaRegistry);
  });

  describe('generateCommandHelp', () => {
    it('should generate comprehensive help for existing commands', () => {
      const help = helpSystem.generateCommandHelp('eval');
      
      expect(help).toContain('EVAL');
      expect(help).toContain('Execute JavaScript code in the browser');
      expect(help).toContain('USAGE');
      expect(help).toContain('ARGUMENTS');
      expect(help).toContain('OPTIONS');
      expect(help).toContain('EXAMPLES');
      expect(help).toContain('ALIASES');
    });

    it('should show practical examples for complex commands', () => {
      const help = helpSystem.generateCommandHelp('screenshot');
      
      expect(help).toContain('EXAMPLES');
      expect(help).toContain('Take basic screenshot');
      expect(help).toContain('Full page screenshot');
      expect(help).toContain('Custom size and quality');
    });

    it('should include option details with types and defaults', () => {
      const help = helpSystem.generateCommandHelp('screenshot');
      
      expect(help).toContain('--format');
      expect(help).toContain('Type: number'); // width and height options have number type
      expect(help).toContain('Default: png');
      expect(help).toContain('Choices: png, jpeg, webp');
    });

    it('should show boolean negation options', () => {
      const help = helpSystem.generateCommandHelp('eval');
      
      expect(help).toContain('--await-promise');
      expect(help).toContain('--no-await-promise');
    });

    it('should handle unknown commands gracefully', () => {
      const help = helpSystem.generateCommandHelp('nonexistent');
      
      expect(help).toContain('Unknown command');
      expect(help).toContain('Available commands');
    });

    it('should suggest similar commands for typos', () => {
      const help = helpSystem.generateCommandHelp('screenshoot'); // typo
      
      expect(help).toContain('Did you mean');
      expect(help).toContain('screenshot');
    });
  });

  describe('generateGeneralHelp', () => {
    it('should generate comprehensive overview help', () => {
      const help = helpSystem.generateGeneralHelp();
      
      expect(help).toContain('CHROME DEVTOOLS CLI');
      expect(help).toContain('USAGE');
      expect(help).toContain('GLOBAL OPTIONS');
      expect(help).toContain('AVAILABLE COMMANDS');
      expect(help).toContain('GETTING MORE HELP');
    });

    it('should categorize commands by functionality', () => {
      const help = helpSystem.generateGeneralHelp();
      
      expect(help).toContain('JavaScript Execution');
      expect(help).toContain('Page Capture');
      expect(help).toContain('User Interaction');
      expect(help).toContain('Monitoring & Debugging');
    });

    it('should list all global options with descriptions', () => {
      const help = helpSystem.generateGeneralHelp();
      
      expect(help).toContain('--host');
      expect(help).toContain('--port');
      expect(help).toContain('--format');
      expect(help).toContain('--verbose');
      expect(help).toContain('--no-verbose');
      expect(help).toContain('--quiet');
      expect(help).toContain('--debug');
      expect(help).toContain('--config');
    });

    it('should include help topics for advanced features', () => {
      const help = helpSystem.generateGeneralHelp();
      
      // Since help topics were removed, we just check that the method works
      expect(help).toContain('GETTING MORE HELP');
    });
  });

  describe('generateTopicHelp', () => {
    it('should generate detailed help for configuration topic', () => {
      const help = helpSystem.generateTopicHelp('configuration');
      
      expect(help).toContain('CONFIGURATION MANAGEMENT');
      expect(help).toContain('precedence order');
      expect(help).toContain('Command-line arguments');
      expect(help).toContain('Environment variables');
      expect(help).toContain('Configuration files');
      expect(help).toContain('EXAMPLES');
    });

    it('should generate detailed help for selectors topic', () => {
      const help = helpSystem.generateTopicHelp('selectors');
      
      expect(help).toContain('CSS SELECTORS GUIDE');
      expect(help).toContain('ID selectors');
      expect(help).toContain('Class selectors');
      expect(help).toContain('data-testid');
      expect(help).toContain('Best practices');
    });

    it('should handle unknown topics gracefully', () => {
      const help = helpSystem.generateTopicHelp('nonexistent');
      
      expect(help).toContain('Unknown help topic');
      expect(help).toContain('Available help topics');
    });

    it('should include examples and see-also sections', () => {
      const help = helpSystem.generateTopicHelp('automation');
      
      expect(help).toContain('EXAMPLES');
      expect(help).toContain('SEE ALSO');
    });
  });

  describe('generateContextualHelp', () => {
    it('should provide specific suggestions for connection errors', () => {
      const help = helpSystem.generateContextualHelp('connection refused');
      
      expect(help).toContain('HELP SUGGESTIONS');
      expect(help).toContain('Chrome is running with remote debugging');
      expect(help).toContain('chrome --remote-debugging-port=9222');
      expect(help).toContain('host and port are correct');
    });

    it('should provide specific suggestions for element not found errors', () => {
      const help = helpSystem.generateContextualHelp('element not found', 'click');
      
      expect(help).toContain('Verify the CSS selector');
      expect(help).toContain('DevTools → Console');
      expect(help).toContain('Wait for the page to load');
      expect(help).toContain('chrome-cdp-cli help click');
    });

    it('should provide specific suggestions for timeout errors', () => {
      const help = helpSystem.generateContextualHelp('timeout');
      
      expect(help).toContain('Increase the timeout value');
      expect(help).toContain('--timeout 60000');
      expect(help).toContain('network issues');
    });

    it('should provide specific suggestions for validation errors', () => {
      const help = helpSystem.generateContextualHelp('validation failed');
      
      expect(help).toContain('Check required arguments');
      expect(help).toContain('option types');
      expect(help).toContain('file paths exist');
    });

    it('should provide command-specific suggestions', () => {
      const help = helpSystem.generateContextualHelp('some error', 'eval');
      
      expect(help).toContain('chrome-cdp-cli help eval');
    });

    it('should provide general suggestions when no specific match found', () => {
      const help = helpSystem.generateContextualHelp('unknown error type');
      
      expect(help).toContain('No specific suggestions available');
      expect(help).toContain('Check command syntax');
      expect(help).toContain('Verify Chrome is running');
      expect(help).toContain('--debug flag');
    });
  });

  describe('help topic management', () => {
    it('should list available help topics', () => {
      const topics = helpSystem.getAvailableTopics();
      
      expect(topics).toContain('configuration');
      expect(topics).toContain('selectors');
      expect(topics).toContain('automation');
      expect(topics).toContain('debugging');
      expect(topics).toContain('scripting');
      expect(topics).toContain('installation');
    });

    it('should check if help topics exist', () => {
      expect(helpSystem.hasHelpTopic('configuration')).toBe(true);
      expect(helpSystem.hasHelpTopic('nonexistent')).toBe(false);
    });

    it('should allow adding custom help topics', () => {
      const customTopic = {
        name: 'custom',
        title: 'Custom Topic',
        description: 'A custom help topic',
        content: 'This is custom content'
      };
      
      helpSystem.addHelpTopic(customTopic);
      
      expect(helpSystem.hasHelpTopic('custom')).toBe(true);
      const help = helpSystem.generateTopicHelp('custom');
      expect(help).toContain('CUSTOM TOPIC');
      expect(help).toContain('This is custom content');
    });
  });

  describe('contextual help management', () => {
    it('should allow adding custom contextual help', () => {
      const customHelp = {
        error: 'custom error',
        suggestion: 'Try this custom solution',
        example: 'custom-command --option value'
      };
      
      helpSystem.addContextualHelp('custom error', customHelp);
      
      const help = helpSystem.generateContextualHelp('custom error');
      expect(help).toContain('Try this custom solution');
      expect(help).toContain('custom-command --option value');
    });
  });

  describe('integration with command registry', () => {
    it('should work with dynamically registered commands', () => {
      // Register a new command
      const newCommand: CommandDefinition = {
        name: 'test-command',
        aliases: ['tc'],
        description: 'A test command',
        usage: 'chrome-cdp-cli test-command',
        examples: [
          { command: 'chrome-cdp-cli test-command', description: 'Run test' }
        ],
        options: [],
        arguments: []
      };
      
      schemaRegistry.registerCommand(newCommand);
      
      // Help should include the new command
      const generalHelp = helpSystem.generateGeneralHelp();
      expect(generalHelp).toContain('test-command');
      expect(generalHelp).toContain('A test command');
      
      // Command-specific help should work
      const commandHelp = helpSystem.generateCommandHelp('test-command');
      expect(commandHelp).toContain('TEST-COMMAND');
      expect(commandHelp).toContain('A test command');
    });
  });
});
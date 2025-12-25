import { CommandDefinition } from './interfaces/ArgumentParser';
import { CommandSchemaRegistry } from './CommandSchemaRegistry';

/**
 * ANSI color codes for terminal output
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

/**
 * Color helper functions
 */
const colorize = {
  title: (text: string) => `${colors.bright}${colors.cyan}${text}${colors.reset}`,
  section: (text: string) => `${colors.bright}${colors.blue}${text}${colors.reset}`,
  command: (text: string) => `${colors.green}${text}${colors.reset}`,
  alias: (text: string) => `${colors.gray}${text}${colors.reset}`,
  option: (text: string) => `${colors.cyan}${text}${colors.reset}`,
  description: (text: string) => text,
  category: (text: string) => `${colors.bright}${colors.yellow}${text}${colors.reset}`,
};

/**
 * Help topic definition for advanced features
 */
export interface HelpTopic {
  name: string;
  title: string;
  description: string;
  content: string;
  examples?: string[];
  seeAlso?: string[];
}

/**
 * Contextual help suggestion
 */
export interface ContextualHelp {
  error: string;
  suggestion: string;
  example?: string;
  relatedCommands?: string[];
}

/**
 * Enhanced help system providing comprehensive documentation and contextual assistance
 * Implements requirements 4.1, 4.2, 4.3, 4.4, 4.5
 */
export class HelpSystem {
  private schemaRegistry: CommandSchemaRegistry;
  private argumentParser?: any;
  private helpTopics: Map<string, HelpTopic> = new Map();
  private contextualHelpers: Map<string, ContextualHelp[]> = new Map();

  constructor(schemaRegistry?: CommandSchemaRegistry, argumentParser?: any) {
    this.schemaRegistry = schemaRegistry || CommandSchemaRegistry.getInstance();
    this.argumentParser = argumentParser;
    this.initializeHelpTopics();
    this.initializeContextualHelpers();
  }

  /**
   * Generate comprehensive help for a specific command
   * Requirement 4.1: Command-specific usage, options, and examples
   */
  generateCommandHelp(commandName: string): string {
    // Try to get command from argument parser first, then schema registry
    let command: CommandDefinition | undefined;
    
    if (this.argumentParser && this.argumentParser.getCommand) {
      command = this.argumentParser.getCommand(commandName);
    }
    
    if (!command) {
      command = this.schemaRegistry.getCommand(commandName);
    }
    
    if (!command) {
      return this.generateCommandNotFoundHelp(commandName);
    }

    let help = '';
    
    // Command header with name and description
    help += `${command.name.toUpperCase()}\n`;
    help += '='.repeat(command.name.length) + '\n\n';
    help += `${command.description}\n\n`;

    // Usage section
    if (command.usage) {
      help += 'USAGE\n';
      help += '-----\n';
      help += `${command.usage}\n\n`;
    }

    // Arguments section
    if (command.arguments.length > 0) {
      help += 'ARGUMENTS\n';
      help += '---------\n';
      for (const arg of command.arguments) {
        const required = arg.required ? ' (required)' : ' (optional)';
        const variadic = arg.variadic ? '...' : '';
        help += `  ${arg.name}${variadic}${required.padStart(30 - arg.name.length - variadic.length)}\n`;
        help += `    ${arg.description}\n`;
        if (arg.type !== 'string') {
          help += `    Type: ${arg.type}\n`;
        }
        help += '\n';
      }
    }

    // Options section
    if (command.options.length > 0) {
      help += 'OPTIONS\n';
      help += '-------\n';
      for (const option of command.options) {
        const shortFlag = option.short ? `-${option.short}, ` : '    ';
        const longFlag = `--${option.name}`;
        const negation = option.type === 'boolean' ? `, --no-${option.name}` : '';
        const flags = `${shortFlag}${longFlag}${negation}`;
        
        help += `  ${flags}\n`;
        help += `    ${option.description}\n`;
        
        if (option.type !== 'string') {
          help += `    Type: ${option.type}\n`;
        }
        
        if (option.required) {
          help += `    Required: yes\n`;
        }
        
        if (option.default !== undefined) {
          help += `    Default: ${option.default}\n`;
        }
        
        if (option.choices && option.choices.length > 0) {
          help += `    Choices: ${option.choices.join(', ')}\n`;
        }
        
        help += '\n';
      }
    }

    // Examples section with practical usage
    // Requirement 4.4: Practical examples for complex commands
    if (command.examples && command.examples.length > 0) {
      help += 'EXAMPLES\n';
      help += '--------\n';
      for (let i = 0; i < command.examples.length; i++) {
        const example = command.examples[i];
        help += `${i + 1}. ${example.description || 'Example usage'}\n`;
        help += `   $ ${example.command}\n\n`;
      }
    }

    // Aliases section
    if (command.aliases.length > 0) {
      help += 'ALIASES\n';
      help += '-------\n';
      help += `${command.aliases.join(', ')}\n\n`;
    }

    // Related help topics
    const relatedTopics = this.getRelatedHelpTopics(commandName);
    if (relatedTopics.length > 0) {
      help += 'SEE ALSO\n';
      help += '--------\n';
      help += `Help topics: ${relatedTopics.join(', ')}\n`;
      help += `Use 'chrome-cdp-cli help topic <topic-name>' for more information\n\n`;
    }

    return help.trim();
  }

  /**
   * Generate general help overview
   * Requirement 4.2: Overview of all available commands with descriptions
   */
  generateGeneralHelp(): string {
    let help = '';
    
    // Header
    help += `${colorize.title('CHROME DEVTOOLS CLI - ENHANCED HELP SYSTEM')}\n`;
    help += `${colors.cyan}${'='.repeat(42)}${colors.reset}\n\n`;
    
    help += 'A powerful command-line interface for Chrome DevTools Protocol automation.\n\n';

    // Usage
    help += `${colorize.section('USAGE')}\n`;
    help += `${colors.blue}${'-'.repeat(5)}${colors.reset}\n`;
    help += `${colorize.command('chrome-cdp-cli')} [global-options] <command> [command-options] [arguments]\n\n`;

    // Global options
    help += `${colorize.section('GLOBAL OPTIONS')}\n`;
    help += `${colors.blue}${'-'.repeat(15)}${colors.reset}\n`;
    help += `  ${colorize.option('-h, --host <host>')}        Chrome host address (default: localhost)\n`;
    help += `  ${colorize.option('-p, --port <port>')}        DevTools port (default: 9222)\n`;
    help += `  ${colorize.option('-f, --format <format>')}    Output format: json|text (default: text)\n`;
    help += `  ${colorize.option('-v, --verbose')}            Enable verbose logging\n`;
    help += `      ${colorize.option('--no-verbose')}         Disable verbose logging\n`;
    help += `  ${colorize.option('-q, --quiet')}              Enable quiet mode\n`;
    help += `      ${colorize.option('--no-quiet')}           Disable quiet mode\n`;
    help += `  ${colorize.option('-t, --timeout <ms>')}       Command timeout in milliseconds (default: 30000)\n`;
    help += `  ${colorize.option('-d, --debug')}              Enable debug logging\n`;
    help += `      ${colorize.option('--no-debug')}           Disable debug logging\n`;
    help += `  ${colorize.option('-c, --config <path>')}      Configuration file path\n`;
    help += `      ${colorize.option('--version')}            Show version number\n\n`;

    // Available commands grouped by category
    let commands: CommandDefinition[];
    
    if (this.argumentParser && this.argumentParser.getCommands) {
      commands = this.argumentParser.getCommands();
    } else {
      commands = this.schemaRegistry.getAllCommands();
    }
    
    const categorizedCommands = this.categorizeCommands(commands);
    
    help += `${colorize.section('AVAILABLE COMMANDS')}\n`;
    help += `${colors.blue}${'-'.repeat(18)}${colors.reset}\n`;
    
    for (const [categoryName, categoryCommands] of categorizedCommands) {
      help += `\n${colorize.category(categoryName)}:\n`;
      for (const command of categoryCommands) {
        const commandName = colorize.command(command.name);
        const aliases = command.aliases.length > 0 ? ` ${colorize.alias(`(${command.aliases.join(', ')})`)}` : '';
        // Calculate padding based on actual text length (not ANSI codes)
        const namePadding = Math.max(0, 20 - command.name.length);
        const aliasText = command.aliases.length > 0 ? `(${command.aliases.join(', ')})` : '';
        const aliasPadding = Math.max(0, 15 - aliasText.length);
        help += `  ${commandName}${' '.repeat(namePadding)}${aliases}${' '.repeat(aliasPadding)} ${command.description}\n`;
      }
    }

    // Getting more help
    help += `\n${colorize.section('GETTING MORE HELP')}\n`;
    help += `${colors.blue}${'-'.repeat(18)}${colors.reset}\n`;
    help += 'For detailed help on a specific command:\n';
    help += `  ${colorize.command('chrome-cdp-cli')} ${colorize.option('help')} <command>\n\n`;
    help += 'For contextual help when commands fail:\n';
    help += '  Commands automatically show relevant help suggestions on errors\n\n';

    return help.trim();
  }

  /**
   * Generate help for advanced topics
   * Requirement 4.5: Support help topics for advanced features
   */
  generateTopicHelp(topicName: string): string {
    const topic = this.helpTopics.get(topicName);
    if (!topic) {
      return this.generateTopicNotFoundHelp(topicName);
    }

    let help = '';
    
    // Topic header
    help += `${topic.title.toUpperCase()}\n`;
    help += '='.repeat(topic.title.length) + '\n\n';
    
    // Topic content
    help += `${topic.content}\n\n`;
    
    // Examples if available
    if (topic.examples && topic.examples.length > 0) {
      help += 'EXAMPLES\n';
      help += '--------\n';
      for (let i = 0; i < topic.examples.length; i++) {
        help += `${i + 1}. ${topic.examples[i]}\n`;
      }
      help += '\n';
    }
    
    // See also section
    if (topic.seeAlso && topic.seeAlso.length > 0) {
      help += 'SEE ALSO\n';
      help += '--------\n';
      help += `${topic.seeAlso.join(', ')}\n\n`;
    }
    
    return help.trim();
  }

  /**
   * Generate contextual help for command failures
   * Requirement 4.3: Contextual help suggestions when commands fail
   */
  generateContextualHelp(error: string, commandName?: string): string {
    let help = '';
    
    // Find matching contextual helpers
    const suggestions = this.findContextualSuggestions(error, commandName);
    
    if (suggestions.length === 0) {
      help += 'HELP SUGGESTIONS\n';
      help += '----------------\n';
      help += 'No specific suggestions available for this error.\n\n';
      help += 'Try:\n';
      help += '  - Check command syntax with: chrome-cdp-cli help <command>\n';
      help += '  - Verify Chrome is running with --remote-debugging-port=9222\n';
      help += '  - Use --debug flag for detailed error information\n\n';
    } else {
      help += 'HELP SUGGESTIONS\n';
      help += '----------------\n';
      
      for (let i = 0; i < suggestions.length; i++) {
        const suggestion = suggestions[i];
        help += `${i + 1}. ${suggestion.suggestion}\n`;
        
        if (suggestion.example) {
          help += `   Example: ${suggestion.example}\n`;
        }
        
        if (suggestion.relatedCommands && suggestion.relatedCommands.length > 0) {
          help += `   Related commands: ${suggestion.relatedCommands.join(', ')}\n`;
        }
        
        help += '\n';
      }
    }
    
    // Add command-specific help reference
    if (commandName) {
      help += `For detailed help on '${commandName}' command:\n`;
      help += `  chrome-cdp-cli help ${commandName}\n\n`;
    }
    
    return help.trim();
  }

  /**
   * Generate help when command is not found with suggestions
   */
  private generateCommandNotFoundHelp(commandName: string): string {
    let help = '';
    
    help += `ERROR: Unknown command '${commandName}'\n\n`;
    
    // Find similar commands
    const similarCommands = this.findSimilarCommands(commandName);
    if (similarCommands.length > 0) {
      help += 'Did you mean:\n';
      for (const similar of similarCommands) {
        help += `  ${similar}\n`;
      }
      help += '\n';
    }
    
    help += 'Available commands:\n';
    let commands: CommandDefinition[];
    
    if (this.argumentParser && this.argumentParser.getCommands) {
      commands = this.argumentParser.getCommands();
    } else {
      commands = this.schemaRegistry.getAllCommands();
    }
    
    for (const command of commands.sort((a, b) => a.name.localeCompare(b.name))) {
      help += `  ${command.name.padEnd(20)} ${command.description}\n`;
    }
    
    help += '\nFor more information:\n';
    help += '  chrome-cdp-cli help\n';
    
    return help;
  }

  /**
   * Generate help when topic is not found
   */
  private generateTopicNotFoundHelp(topicName: string): string {
    let help = '';
    
    help += `ERROR: Unknown help topic '${topicName}'\n\n`;
    
    help += 'Available help topics:\n';
    const topics = Array.from(this.helpTopics.values()).sort((a, b) => a.name.localeCompare(b.name));
    for (const topic of topics) {
      help += `  ${topic.name.padEnd(20)} ${topic.description}\n`;
    }
    
    help += '\nUsage:\n';
    help += '  chrome-cdp-cli help topic <topic-name>\n';
    
    return help;
  }

  /**
   * Find similar commands using simple string similarity
   */
  private findSimilarCommands(commandName: string): string[] {
    let commands: CommandDefinition[];
    
    if (this.argumentParser && this.argumentParser.getCommands) {
      commands = this.argumentParser.getCommands();
    } else {
      commands = this.schemaRegistry.getAllCommands();
    }
    
    const similar: string[] = [];
    
    for (const command of commands) {
      // Check if command name contains the input or vice versa
      if (command.name.includes(commandName) || commandName.includes(command.name)) {
        similar.push(command.name);
      }
      
      // Check aliases
      for (const alias of command.aliases) {
        if (alias.includes(commandName) || commandName.includes(alias)) {
          similar.push(command.name);
          break;
        }
      }
    }
    
    return [...new Set(similar)].slice(0, 5); // Remove duplicates and limit to 5
  }

  /**
   * Find contextual suggestions for errors
   */
  private findContextualSuggestions(error: string, commandName?: string): ContextualHelp[] {
    const suggestions: ContextualHelp[] = [];
    
    // Check error-specific helpers
    for (const [errorPattern, helpers] of this.contextualHelpers) {
      if (error.toLowerCase().includes(errorPattern.toLowerCase())) {
        suggestions.push(...helpers);
      }
    }
    
    // Add command-specific suggestions if available
    if (commandName) {
      const commandHelpers = this.contextualHelpers.get(`command:${commandName}`);
      if (commandHelpers) {
        suggestions.push(...commandHelpers);
      }
    }
    
    return suggestions;
  }

  /**
   * Categorize commands for better organization
   */
  private categorizeCommands(commands: CommandDefinition[]): Map<string, CommandDefinition[]> {
    const categories = new Map<string, CommandDefinition[]>();
    
    for (const command of commands) {
      let category = 'General';
      
      // Categorize based on command name patterns
      if (['eval', 'execute', 'js'].includes(command.name)) {
        category = 'JavaScript Execution';
      } else if (['screenshot', 'capture', 'snapshot', 'dom'].includes(command.name)) {
        category = 'Page Capture';
      } else if (['click', 'hover', 'fill', 'type', 'drag', 'press', 'upload'].includes(command.name)) {
        category = 'User Interaction';
      } else if (['console', 'network', 'logs', 'requests'].includes(command.name) || 
                 command.name.includes('console') || command.name.includes('network')) {
        category = 'Monitoring & Debugging';
      } else if (['navigate', 'goto', 'open', 'wait'].includes(command.name)) {
        category = 'Navigation & Timing';
      } else if (command.name.includes('install')) {
        category = 'Installation & Setup';
      } else if (['help', 'version'].includes(command.name)) {
        category = 'Help & Information';
      }
      
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(command);
    }
    
    // Sort commands within each category
    for (const [, categoryCommands] of categories) {
      categoryCommands.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    return categories;
  }

  /**
   * Get related help topics for a command
   */
  private getRelatedHelpTopics(commandName: string): string[] {
    const related: string[] = [];
    
    // Map commands to related topics
    const topicMappings: Record<string, string[]> = {
      'eval': ['configuration', 'scripting'],
      'screenshot': ['configuration', 'output-formats'],
      'click': ['selectors', 'automation'],
      'fill': ['selectors', 'automation'],
      'hover': ['selectors', 'automation'],
      'console_messages': ['monitoring', 'debugging'],
      'network_requests': ['monitoring', 'debugging'],
      'install_cursor_command': ['installation', 'integration'],
      'install_claude_skill': ['installation', 'integration']
    };
    
    const mappedTopics = topicMappings[commandName];
    if (mappedTopics) {
      for (const topic of mappedTopics) {
        if (this.helpTopics.has(topic)) {
          related.push(topic);
        }
      }
    }
    
    return related;
  }

  /**
   * Initialize help topics for advanced features
   */
  private initializeHelpTopics(): void {
    // Configuration topic
    this.helpTopics.set('configuration', {
      name: 'configuration',
      title: 'Configuration Management',
      description: 'Advanced configuration options and file formats',
      content: `The Chrome DevTools CLI supports multiple configuration sources with a clear precedence order:

1. Command-line arguments (highest priority)
2. Environment variables
3. Configuration files (profile-specific, then default)
4. Default values (lowest priority)

Configuration files can be in YAML or JSON format and support:
- Global default settings
- Profile-specific configurations
- Command-specific defaults
- Plugin configurations
- Custom aliases

Environment variables follow the pattern CDP_<OPTION_NAME> (e.g., CDP_HOST, CDP_PORT).`,
      examples: [
        'chrome-cdp-cli --config ~/.chrome-cdp-cli.yaml eval "document.title"',
        'CDP_HOST=remote-chrome CDP_PORT=9223 chrome-cdp-cli screenshot',
        'chrome-cdp-cli --profile production screenshot --full-page'
      ],
      seeAlso: ['profiles', 'environment-variables']
    });

    // Selectors topic
    this.helpTopics.set('selectors', {
      name: 'selectors',
      title: 'CSS Selectors Guide',
      description: 'Guide to using CSS selectors effectively',
      content: `CSS selectors are used to target elements for interaction commands like click, fill, and hover.

Supported selector types:
- ID selectors: #element-id
- Class selectors: .class-name
- Attribute selectors: [data-testid="value"]
- Pseudo-selectors: :first-child, :nth-of-type(2)
- Complex selectors: .parent > .child, .item:not(.disabled)

Best practices:
- Use data-testid attributes for reliable automation
- Prefer specific selectors over generic ones
- Test selectors in browser DevTools first
- Use :visible pseudo-selector for visible elements only`,
      examples: [
        'chrome-cdp-cli click "#submit-button"',
        'chrome-cdp-cli fill "[data-testid=username]" "user@example.com"',
        'chrome-cdp-cli hover ".dropdown-menu > .first-item"'
      ],
      seeAlso: ['automation', 'debugging']
    });

    // Automation topic
    this.helpTopics.set('automation', {
      name: 'automation',
      title: 'Browser Automation Best Practices',
      description: 'Guidelines for effective browser automation',
      content: `Effective browser automation requires careful planning and robust selectors.

Key principles:
- Wait for elements to be ready before interaction
- Use explicit waits instead of arbitrary delays
- Handle dynamic content and loading states
- Implement proper error handling and retries
- Use page object patterns for complex workflows

Common patterns:
- Navigate → Wait → Interact → Verify
- Fill forms step by step with validation
- Take screenshots for debugging failed tests
- Monitor console and network for errors`,
      examples: [
        'chrome-cdp-cli navigate "https://example.com" && chrome-cdp-cli wait "#content" && chrome-cdp-cli click ".login"',
        'chrome-cdp-cli fill "#username" "user" && chrome-cdp-cli fill "#password" "pass" && chrome-cdp-cli click "#login"'
      ],
      seeAlso: ['selectors', 'debugging', 'scripting']
    });

    // Output formats topic
    this.helpTopics.set('output-formats', {
      name: 'output-formats',
      title: 'Output Formats and Processing',
      description: 'Understanding different output formats and processing options',
      content: `The CLI supports multiple output formats for different use cases:

Text format (default):
- Human-readable output
- Formatted for console display
- Includes contextual information

JSON format:
- Machine-parseable structured data
- Suitable for scripting and automation
- Preserves all data fields and metadata

Quiet mode:
- Suppresses non-essential output
- Shows only errors and critical information
- Useful for automated scripts

Verbose mode:
- Includes detailed operation information
- Shows timing and performance data
- Helpful for debugging and optimization`,
      examples: [
        'chrome-cdp-cli --format json eval "document.title"',
        'chrome-cdp-cli --quiet screenshot --filename result.png',
        'chrome-cdp-cli --verbose --debug console_messages'
      ],
      seeAlso: ['configuration', 'scripting']
    });

    // Debugging topic
    this.helpTopics.set('debugging', {
      name: 'debugging',
      title: 'Debugging and Troubleshooting',
      description: 'Tools and techniques for debugging CLI issues',
      content: `When commands don't work as expected, use these debugging techniques:

Debug mode (--debug):
- Shows detailed execution logs
- Includes stack traces for errors
- Displays CDP protocol messages

Verbose mode (--verbose):
- Shows timing information
- Includes connection details
- Displays intermediate results

Common issues and solutions:
- Connection refused: Check Chrome is running with --remote-debugging-port=9222
- Element not found: Verify selectors in browser DevTools
- Timeout errors: Increase timeout or wait for page load
- Permission denied: Check file paths and permissions

Monitoring commands:
- Use console_messages to check for JavaScript errors
- Use network_requests to verify API calls
- Take screenshots to see current page state`,
      examples: [
        'chrome-cdp-cli --debug --verbose click "#button"',
        'chrome-cdp-cli console_messages --filter error',
        'chrome-cdp-cli screenshot --filename debug.png'
      ],
      seeAlso: ['monitoring', 'automation']
    });

    // Scripting topic
    this.helpTopics.set('scripting', {
      name: 'scripting',
      title: 'Scripting and Integration',
      description: 'Using the CLI in scripts and automation workflows',
      content: `The CLI is designed for integration with shell scripts, CI/CD pipelines, and automation tools.

Shell scripting tips:
- Check exit codes for error handling
- Use --format json for parsing results
- Combine commands with && for sequential execution
- Use --quiet mode to reduce noise

Error handling:
- Exit code 0: Success
- Exit code 1: General error
- Exit code 2: Connection error
- Exit code 3: Command not found
- Exit code 4: Invalid arguments
- Exit code 5: Validation error

CI/CD integration:
- Set CDP_HOST and CDP_PORT environment variables
- Use configuration files for consistent settings
- Capture screenshots on test failures
- Monitor console errors in automated tests`,
      examples: [
        '#!/bin/bash\nif chrome-cdp-cli eval "document.readyState === \'complete\'"; then\n  chrome-cdp-cli screenshot\nfi',
        'chrome-cdp-cli --format json eval "performance.timing" | jq .data.loadEventEnd'
      ],
      seeAlso: ['configuration', 'output-formats']
    });

    // Installation topic
    this.helpTopics.set('installation', {
      name: 'installation',
      title: 'Installation and Setup',
      description: 'Setting up the CLI and integrations',
      content: `The CLI can be integrated with various development tools and IDEs.

Chrome setup:
- Start Chrome with: --remote-debugging-port=9222
- For headless mode: --headless --disable-gpu
- For automation: --no-sandbox --disable-dev-shm-usage

IDE integrations:
- Cursor IDE: Use install_cursor_command for custom commands
- Claude Code: Use install_claude_skill for AI assistance
- VS Code: Create custom tasks and snippets

Configuration setup:
- Create ~/.chrome-cdp-cli.yaml for global settings
- Use project-specific .chrome-cdp-cli.yaml files
- Set up environment variables for CI/CD

Plugin development:
- Follow the plugin API specification
- Register commands with proper schemas
- Include comprehensive help documentation`,
      examples: [
        'chrome --remote-debugging-port=9222 --headless',
        'chrome-cdp-cli install_cursor_command --target-directory ./commands',
        'chrome-cdp-cli install_claude_skill --skill-type automation'
      ],
      seeAlso: ['configuration', 'integration']
    });
  }

  /**
   * Initialize contextual help suggestions
   */
  private initializeContextualHelpers(): void {
    // Connection errors
    this.contextualHelpers.set('connection refused', [
      {
        error: 'connection refused',
        suggestion: 'Make sure Chrome is running with remote debugging enabled',
        example: 'chrome --remote-debugging-port=9222',
        relatedCommands: ['help']
      },
      {
        error: 'connection refused',
        suggestion: 'Check if the host and port are correct',
        example: 'chrome-cdp-cli --host localhost --port 9222 <command>',
        relatedCommands: ['help']
      }
    ]);

    // Element not found errors
    this.contextualHelpers.set('element not found', [
      {
        error: 'element not found',
        suggestion: 'Verify the CSS selector in browser DevTools',
        example: 'Open DevTools → Console → document.querySelector("#your-selector")',
        relatedCommands: ['help topic selectors']
      },
      {
        error: 'element not found',
        suggestion: 'Wait for the page to load completely before interacting',
        example: 'chrome-cdp-cli wait "#element" && chrome-cdp-cli click "#element"',
        relatedCommands: ['wait']
      }
    ]);

    // Timeout errors
    this.contextualHelpers.set('timeout', [
      {
        error: 'timeout',
        suggestion: 'Increase the timeout value for slow operations',
        example: 'chrome-cdp-cli --timeout 60000 <command>',
        relatedCommands: ['help']
      },
      {
        error: 'timeout',
        suggestion: 'Check if the page is loading or if there are network issues',
        example: 'chrome-cdp-cli console_messages --filter error',
        relatedCommands: ['console_messages', 'network_requests']
      }
    ]);

    // Parse errors
    this.contextualHelpers.set('parse error', [
      {
        error: 'parse error',
        suggestion: 'Check command syntax and argument order',
        example: 'chrome-cdp-cli help <command-name>',
        relatedCommands: ['help']
      },
      {
        error: 'parse error',
        suggestion: 'Use quotes around arguments containing spaces or special characters',
        example: 'chrome-cdp-cli eval "document.querySelector(\'.my-class\')"',
        relatedCommands: ['help topic scripting']
      }
    ]);

    // Validation errors
    this.contextualHelpers.set('validation failed', [
      {
        error: 'validation failed',
        suggestion: 'Check required arguments and option types',
        example: 'chrome-cdp-cli help <command-name>',
        relatedCommands: ['help']
      },
      {
        error: 'validation failed',
        suggestion: 'Ensure file paths exist and URLs are valid',
        example: 'ls -la /path/to/file.js',
        relatedCommands: ['help topic debugging']
      }
    ]);

    // Permission errors
    this.contextualHelpers.set('permission denied', [
      {
        error: 'permission denied',
        suggestion: 'Check file permissions and directory access',
        example: 'chmod +r /path/to/file',
        relatedCommands: ['help topic debugging']
      },
      {
        error: 'permission denied',
        suggestion: 'Ensure the target directory exists and is writable',
        example: 'mkdir -p /path/to/directory && chmod +w /path/to/directory',
        relatedCommands: ['help topic installation']
      }
    ]);

    // Command-specific helpers
    this.contextualHelpers.set('command:eval', [
      {
        error: 'eval',
        suggestion: 'Use proper JavaScript syntax and escape quotes',
        example: 'chrome-cdp-cli eval "document.querySelector(\\"#id\\").textContent"',
        relatedCommands: ['help eval', 'help topic scripting']
      }
    ]);

    this.contextualHelpers.set('command:screenshot', [
      {
        error: 'screenshot',
        suggestion: 'Ensure the output directory exists and is writable',
        example: 'mkdir -p screenshots && chrome-cdp-cli screenshot --filename screenshots/page.png',
        relatedCommands: ['help screenshot']
      }
    ]);
  }

  /**
   * Get all available help topics
   */
  getAvailableTopics(): string[] {
    return Array.from(this.helpTopics.keys()).sort();
  }

  /**
   * Check if a help topic exists
   */
  hasHelpTopic(topicName: string): boolean {
    return this.helpTopics.has(topicName);
  }

  /**
   * Add a custom help topic
   */
  addHelpTopic(topic: HelpTopic): void {
    this.helpTopics.set(topic.name, topic);
  }

  /**
   * Add contextual help for specific errors
   */
  addContextualHelp(errorPattern: string, help: ContextualHelp): void {
    if (!this.contextualHelpers.has(errorPattern)) {
      this.contextualHelpers.set(errorPattern, []);
    }
    this.contextualHelpers.get(errorPattern)!.push(help);
  }
}
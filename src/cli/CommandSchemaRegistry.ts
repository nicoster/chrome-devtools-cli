import { CommandDefinition } from './interfaces/ArgumentParser';

/**
 * Registry for command schemas and definitions
 * Provides built-in command definitions for the Chrome DevTools CLI
 */
export class CommandSchemaRegistry {
  private static instance: CommandSchemaRegistry;
  private schemas: Map<string, CommandDefinition> = new Map();

  private constructor() {
    this.initializeBuiltInCommands();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): CommandSchemaRegistry {
    if (!CommandSchemaRegistry.instance) {
      CommandSchemaRegistry.instance = new CommandSchemaRegistry();
    }
    return CommandSchemaRegistry.instance;
  }

  /**
   * Get command definition by name
   */
  getCommand(name: string): CommandDefinition | undefined {
    return this.schemas.get(name);
  }

  /**
   * Get all command definitions
   */
  getAllCommands(): CommandDefinition[] {
    return Array.from(this.schemas.values());
  }

  /**
   * Register a new command definition
   */
  registerCommand(command: CommandDefinition): void {
    this.schemas.set(command.name, command);
  }

  /**
   * Check if command exists
   */
  hasCommand(name: string): boolean {
    return this.schemas.has(name);
  }

  /**
   * Initialize built-in command definitions
   */
  private initializeBuiltInCommands(): void {
    // Help command
    this.registerCommand({
      name: 'help',
      aliases: ['h'],
      description: 'Show help information for commands',
      usage: 'chrome-cdp-cli help [command]',
      examples: [
        { command: 'chrome-cdp-cli help', description: 'Show general help' },
        { command: 'chrome-cdp-cli help eval', description: 'Show help for eval command' }
      ],
      options: [],
      arguments: [
        {
          name: 'command',
          description: 'Command to show help for',
          type: 'string',
          required: false
        }
      ]
    });

    // Version command
    this.registerCommand({
      name: 'version',
      aliases: ['v'],
      description: 'Show version information',
      usage: 'chrome-cdp-cli version',
      examples: [
        { command: 'chrome-cdp-cli version', description: 'Display version number' }
      ],
      options: [],
      arguments: []
    });

    // Eval command
    this.registerCommand({
      name: 'eval',
      aliases: ['js', 'execute'],
      description: 'Execute JavaScript code in the browser',
      usage: 'chrome-cdp-cli [global-options] eval [options] <expression>',
      examples: [
        { command: 'chrome-cdp-cli eval "document.title"', description: 'Get page title' },
        { command: 'chrome-cdp-cli eval --file script.js', description: 'Execute JavaScript file' },
        { command: 'chrome-cdp-cli --format json eval "performance.timing"', description: 'Get performance data as JSON' },
        { command: 'chrome-cdp-cli --verbose eval "console.log(\'Debug info\')"', description: 'Execute with verbose logging' },
        { command: 'chrome-cdp-cli --config ~/.chrome-cdp-cli.yaml eval "document.readyState"', description: 'Use custom configuration' },
        { command: 'chrome-cdp-cli eval --no-await-promise "Promise.resolve(42)"', description: 'Execute without awaiting promises' }
      ],
      options: [
        {
          name: 'expression',
          short: 'e',
          description: 'JavaScript expression to execute',
          type: 'string',
          required: false
        },
        {
          name: 'file',
          short: 'f',
          description: 'JavaScript file to execute',
          type: 'string',
          required: false
        },
        {
          name: 'await-promise',
          description: 'Await promise results',
          type: 'boolean',
          default: true
        },
        {
          name: 'return-by-value',
          description: 'Return result by value instead of object reference',
          type: 'boolean',
          default: true
        }
      ],
      arguments: [
        {
          name: 'expression',
          description: 'JavaScript expression to execute (alternative to --expression)',
          type: 'string',
          required: false
        }
      ]
    });

    // Screenshot command
    this.registerCommand({
      name: 'screenshot',
      aliases: ['ss', 'capture'],
      description: 'Capture page screenshot',
      usage: 'chrome-cdp-cli [global-options] screenshot [options]',
      examples: [
        { command: 'chrome-cdp-cli screenshot', description: 'Take basic screenshot' },
        { command: 'chrome-cdp-cli screenshot --filename page.png --full-page', description: 'Full page screenshot' },
        { command: 'chrome-cdp-cli --quiet screenshot --filename result.png', description: 'Silent screenshot capture' },
        { command: 'chrome-cdp-cli --profile production screenshot --format jpeg --quality 90', description: 'Production screenshot with custom quality' },
        { command: 'chrome-cdp-cli screenshot --width 800 --height 600 --format jpeg --quality 90', description: 'Custom size and quality' },
        { command: 'chrome-cdp-cli screenshot --clip-x 100 --clip-y 100 --clip-width 400 --clip-height 300', description: 'Screenshot specific region' }
      ],
      options: [
        {
          name: 'filename',
          short: 'o',
          description: 'Output filename',
          type: 'string'
        },
        {
          name: 'width',
          short: 'w',
          description: 'Viewport width',
          type: 'number'
        },
        {
          name: 'height',
          short: 'h',
          description: 'Viewport height',
          type: 'number'
        },
        {
          name: 'format',
          description: 'Image format',
          type: 'string',
          choices: ['png', 'jpeg', 'webp'],
          default: 'png'
        },
        {
          name: 'quality',
          description: 'Image quality (0-100, JPEG/WebP only)',
          type: 'number'
        },
        {
          name: 'full-page',
          description: 'Capture full page',
          type: 'boolean',
          default: false
        },
        {
          name: 'clip-x',
          description: 'Clip rectangle X coordinate',
          type: 'number'
        },
        {
          name: 'clip-y',
          description: 'Clip rectangle Y coordinate',
          type: 'number'
        },
        {
          name: 'clip-width',
          description: 'Clip rectangle width',
          type: 'number'
        },
        {
          name: 'clip-height',
          description: 'Clip rectangle height',
          type: 'number'
        },
        {
          name: 'clip-scale',
          description: 'Clip rectangle scale',
          type: 'number',
          default: 1
        }
      ],
      arguments: []
    });

    // User interaction commands
    this.registerCommand({
      name: 'click',
      aliases: [],
      description: 'Click on an element',
      usage: 'chrome-cdp-cli [global-options] click [options] <selector>',
      examples: [
        { command: 'chrome-cdp-cli click "#submit-button"', description: 'Click element by ID' },
        { command: 'chrome-cdp-cli click ".nav-link:first-child"', description: 'Click first navigation link' },
        { command: 'chrome-cdp-cli --timeout 10000 click ".slow-loading-button"', description: 'Click with extended timeout' },
        { command: 'chrome-cdp-cli --verbose click "[data-testid=checkout]"', description: 'Click with verbose logging' }
      ],
      options: [],
      arguments: [
        {
          name: 'selector',
          description: 'CSS selector for element to click',
          type: 'string',
          required: true
        }
      ]
    });

    this.registerCommand({
      name: 'fill',
      aliases: ['type'],
      description: 'Fill a form field with text',
      usage: 'chrome-cdp-cli [global-options] fill [options] <selector> <text>',
      examples: [
        { command: 'chrome-cdp-cli fill "#username" "john@example.com"', description: 'Fill username field' },
        { command: 'chrome-cdp-cli fill "input[name=password]" "secret123"', description: 'Fill password field' },
        { command: 'chrome-cdp-cli fill "#country" "United States"', description: 'Select dropdown option by text' },
        { command: 'chrome-cdp-cli --debug fill "#notes" "Additional information"', description: 'Fill with debug logging' }
      ],
      options: [],
      arguments: [
        {
          name: 'selector',
          description: 'CSS selector for form field',
          type: 'string',
          required: true
        },
        {
          name: 'text',
          description: 'Text to fill in the field',
          type: 'string',
          required: true
        }
      ]
    });

    this.registerCommand({
      name: 'fill_form',
      aliases: [],
      description: 'Fill multiple form fields in batch',
      usage: 'chrome-cdp-cli [global-options] fill_form [options]',
      examples: [
        { command: 'chrome-cdp-cli fill_form --fields \'[{"selector":"#name","value":"John"},{"selector":"#email","value":"john@example.com"}]\'', description: 'Fill multiple fields' },
        { command: 'chrome-cdp-cli fill_form --fields-file form-data.json', description: 'Fill form from JSON file' },
        { command: 'chrome-cdp-cli --quiet fill_form --fields \'[{"selector":"#username","value":"testuser"}]\' --stop-on-error', description: 'Silent batch fill with error handling' }
      ],
      options: [
        {
          name: 'fields',
          description: 'JSON array of field objects with selector and value',
          type: 'string',
          required: true
        }
      ],
      arguments: []
    });

    this.registerCommand({
      name: 'hover',
      aliases: ['mouseover'],
      description: 'Hover over an element',
      usage: 'chrome-cdp-cli hover <selector>',
      examples: [
        { command: 'chrome-cdp-cli hover ".dropdown-trigger"', description: 'Hover over dropdown trigger' }
      ],
      options: [],
      arguments: [
        {
          name: 'selector',
          description: 'CSS selector for element to hover over',
          type: 'string',
          required: true
        }
      ]
    });

    this.registerCommand({
      name: 'drag',
      aliases: [],
      description: 'Perform drag and drop operations',
      usage: 'chrome-cdp-cli drag <fromSelector> <toSelector>',
      examples: [
        { command: 'chrome-cdp-cli drag "#item1" "#dropzone"', description: 'Drag item1 to dropzone' }
      ],
      options: [],
      arguments: [
        {
          name: 'fromSelector',
          description: 'CSS selector for element to drag from',
          type: 'string',
          required: true
        },
        {
          name: 'toSelector',
          description: 'CSS selector for element to drag to',
          type: 'string',
          required: true
        }
      ]
    });

    this.registerCommand({
      name: 'press_key',
      aliases: [],
      description: 'Simulate keyboard input with modifiers',
      usage: 'chrome-cdp-cli press_key <key> [options]',
      examples: [
        { command: 'chrome-cdp-cli press_key "Enter"', description: 'Press Enter key' },
        { command: 'chrome-cdp-cli press_key "s" --modifiers ctrl', description: 'Press Ctrl+S' }
      ],
      options: [
        {
          name: 'modifiers',
          description: 'Key modifiers (ctrl, alt, shift, meta)',
          type: 'string'
        }
      ],
      arguments: [
        {
          name: 'key',
          description: 'Key to press',
          type: 'string',
          required: true
        }
      ]
    });

    this.registerCommand({
      name: 'upload_file',
      aliases: [],
      description: 'Upload files to file input elements',
      usage: 'chrome-cdp-cli upload_file <selector> <filePath>',
      examples: [
        { command: 'chrome-cdp-cli upload_file "input[type=file]" "/path/to/file.txt"', description: 'Upload file to input' }
      ],
      options: [],
      arguments: [
        {
          name: 'selector',
          description: 'CSS selector for file input element',
          type: 'string',
          required: true
        },
        {
          name: 'filePath',
          description: 'Path to file to upload',
          type: 'file',
          required: true
        }
      ]
    });

    this.registerCommand({
      name: 'wait_for',
      aliases: [],
      description: 'Wait for elements to appear or meet conditions',
      usage: 'chrome-cdp-cli wait_for <selector> [options]',
      examples: [
        { command: 'chrome-cdp-cli wait_for "#loading"', description: 'Wait for loading element to appear' },
        { command: 'chrome-cdp-cli wait_for ".content" --timeout 10000', description: 'Wait up to 10 seconds' }
      ],
      options: [
        {
          name: 'timeout',
          description: 'Maximum wait time in milliseconds',
          type: 'number',
          default: 30000
        }
      ],
      arguments: [
        {
          name: 'selector',
          description: 'CSS selector for element to wait for',
          type: 'string',
          required: true
        }
      ]
    });

    this.registerCommand({
      name: 'handle_dialog',
      aliases: [],
      description: 'Handle browser dialogs (alert, confirm, prompt)',
      usage: 'chrome-cdp-cli handle_dialog <action> [options]',
      examples: [
        { command: 'chrome-cdp-cli handle_dialog accept', description: 'Accept dialog' },
        { command: 'chrome-cdp-cli handle_dialog dismiss', description: 'Dismiss dialog' },
        { command: 'chrome-cdp-cli handle_dialog accept --text "Hello"', description: 'Accept prompt with text' }
      ],
      options: [
        {
          name: 'text',
          description: 'Text to enter in prompt dialog',
          type: 'string'
        }
      ],
      arguments: [
        {
          name: 'action',
          description: 'Action to take (accept, dismiss)',
          type: 'string',
          required: true
        }
      ]
    });

    // Navigate command
    this.registerCommand({
      name: 'navigate',
      aliases: ['goto', 'open'],
      description: 'Navigate to a URL',
      usage: 'chrome-cdp-cli navigate <url>',
      examples: [
        { command: 'chrome-cdp-cli navigate "https://example.com"', description: 'Navigate to example.com' }
      ],
      options: [],
      arguments: [
        {
          name: 'url',
          description: 'URL to navigate to',
          type: 'url',
          required: true
        }
      ]
    });

    // Snapshot command
    this.registerCommand({
      name: 'snapshot',
      aliases: ['dom'],
      description: 'Capture DOM snapshot',
      usage: 'chrome-cdp-cli snapshot [options]',
      examples: [
        { command: 'chrome-cdp-cli snapshot', description: 'Basic DOM snapshot' },
        { command: 'chrome-cdp-cli snapshot --format html --filename dom.html', description: 'Save as HTML file' }
      ],
      options: [
        {
          name: 'filename',
          short: 'o',
          description: 'Output filename',
          type: 'string'
        },
        {
          name: 'format',
          description: 'Output format',
          type: 'string',
          choices: ['text', 'html', 'json'],
          default: 'text'
        },
        {
          name: 'include-styles',
          description: 'Include computed styles',
          type: 'boolean',
          default: true
        },
        {
          name: 'include-attributes',
          description: 'Include element attributes',
          type: 'boolean',
          default: true
        },
        {
          name: 'include-paint-order',
          description: 'Include paint order information',
          type: 'boolean',
          default: false
        },
        {
          name: 'include-text-index',
          description: 'Include text index information',
          type: 'boolean',
          default: false
        }
      ],
      arguments: []
    });

    // Console messages command
    this.registerCommand({
      name: 'console',
      aliases: [],
      description: 'List console messages',
      usage: 'chrome-cdp-cli console [options]',
      examples: [
        { command: 'chrome-cdp-cli console', description: 'Get all console messages' },
        { command: 'chrome-cdp-cli console --latest', description: 'Get the latest console message' },
        { command: 'chrome-cdp-cli console --types error,warn', description: 'Get only error and warning messages' }
      ],
      options: [
        {
          name: 'latest',
          description: 'Get only the latest message',
          type: 'boolean'
        },
        {
          name: 'types',
          description: 'Filter by message types (comma-separated: log,info,warn,error,debug)',
          type: 'string'
        },
        {
          name: 'textPattern',
          description: 'Filter by text pattern (regex)',
          type: 'string'
        },
        {
          name: 'maxMessages',
          description: 'Maximum number of messages to return',
          type: 'number'
        },
        {
          name: 'startTime',
          description: 'Filter messages after this timestamp',
          type: 'number'
        },
        {
          name: 'endTime',
          description: 'Filter messages before this timestamp',
          type: 'number'
        },
        {
          name: 'startMonitoring',
          description: 'Start monitoring if not already active',
          type: 'boolean'
        }
      ],
      arguments: []
    });

    // Network requests command
    this.registerCommand({
      name: 'network',
      aliases: [],
      description: 'List network requests',
      usage: 'chrome-cdp-cli network [options]',
      examples: [
        { command: 'chrome-cdp-cli network', description: 'Get all network requests' },
        { command: 'chrome-cdp-cli network --latest', description: 'Get the latest network request' },
        { command: 'chrome-cdp-cli network --filter methods=POST', description: 'Get only POST requests' }
      ],
      options: [
        {
          name: 'latest',
          description: 'Get only the latest request',
          type: 'boolean'
        },
        {
          name: 'filter',
          description: 'Filter requests (JSON string with methods, urlPattern, statusCodes, etc.)',
          type: 'string'
        }
      ],
      arguments: []
    });

    // Install commands
    this.registerCommand({
      name: 'install_cursor_command',
      aliases: ['install-cursor'],
      description: 'Install Cursor IDE commands for Chrome automation',
      usage: 'chrome-cdp-cli install_cursor_command [options]',
      examples: [
        { command: 'chrome-cdp-cli install_cursor_command', description: 'Install with default settings' },
        { command: 'chrome-cdp-cli install_cursor_command --target-directory ./commands --force', description: 'Install to custom directory' }
      ],
      options: [
        {
          name: 'target-directory',
          description: 'Target directory for installation',
          type: 'string'
        },
        {
          name: 'include-examples',
          description: 'Include example files',
          type: 'boolean',
          default: true
        },
        {
          name: 'force',
          description: 'Force overwrite existing files',
          type: 'boolean',
          default: false
        }
      ],
      arguments: []
    });

    this.registerCommand({
      name: 'install_claude_skill',
      aliases: ['install-claude'],
      description: 'Install Claude Code skill for Chrome automation',
      usage: 'chrome-cdp-cli install_claude_skill [options]',
      examples: [
        { command: 'chrome-cdp-cli install_claude_skill', description: 'Install with default settings' },
        { command: 'chrome-cdp-cli install_claude_skill --skill-type browser --include-references', description: 'Install browser skill with references' }
      ],
      options: [
        {
          name: 'skill-type',
          description: 'Type of skill to install',
          type: 'string',
          choices: ['browser', 'automation', 'testing'],
          default: 'browser'
        },
        {
          name: 'target-directory',
          description: 'Target directory for installation',
          type: 'string'
        },
        {
          name: 'include-examples',
          description: 'Include example files',
          type: 'boolean',
          default: true
        },
        {
          name: 'include-references',
          description: 'Include reference documentation',
          type: 'boolean',
          default: true
        },
        {
          name: 'force',
          description: 'Force overwrite existing files',
          type: 'boolean',
          default: false
        }
      ],
      arguments: []
    });
  }
}
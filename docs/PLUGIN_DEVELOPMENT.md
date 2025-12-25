# Plugin Development Guide

The Chrome DevTools CLI supports a powerful plugin architecture that allows you to extend the CLI with custom commands, handlers, and functionality. This guide covers everything you need to know to develop, test, and distribute plugins.

## Plugin Architecture Overview

### Core Concepts

- **Plugin**: A self-contained module that extends CLI functionality
- **Command Handler**: Implements specific command logic
- **Plugin Interface**: Standard API for plugin registration and lifecycle
- **Plugin Registry**: Manages plugin loading, validation, and conflict resolution
- **Plugin Configuration**: Settings and options specific to each plugin

### Plugin Structure

```
my-plugin/
├── package.json          # Plugin metadata and dependencies
├── plugin.js            # Main plugin entry point
├── commands/            # Command implementations
│   ├── custom-command.js
│   └── another-command.js
├── schemas/             # Command schemas and validation
│   ├── custom-command.json
│   └── another-command.json
├── docs/               # Plugin documentation
│   ├── README.md
│   └── examples.md
├── tests/              # Plugin tests
│   └── plugin.test.js
└── config/             # Default configuration
    └── default.yaml
```

## Plugin Interface

### Basic Plugin Structure

```javascript
// plugin.js
const { PluginBase } = require('chrome-cdp-cli');

class MyPlugin extends PluginBase {
  constructor() {
    super();
    this.name = 'my-plugin';
    this.version = '1.0.0';
    this.description = 'Custom automation commands for my project';
  }

  /**
   * Initialize plugin and register commands
   */
  async initialize(registry, config) {
    // Register custom commands
    await this.registerCommand(registry, 'custom-command', require('./commands/custom-command'));
    await this.registerCommand(registry, 'another-command', require('./commands/another-command'));
    
    // Set up plugin-specific configuration
    this.config = config.plugins?.[this.name] || {};
    
    console.log(`Plugin ${this.name} v${this.version} initialized`);
  }

  /**
   * Cleanup when plugin is unloaded
   */
  async cleanup() {
    console.log(`Plugin ${this.name} cleaned up`);
  }

  /**
   * Validate plugin compatibility
   */
  validateCompatibility(cliVersion) {
    // Check CLI version compatibility
    return this.isVersionCompatible(cliVersion, '>=1.0.0');
  }
}

module.exports = MyPlugin;
```

### Package.json Configuration

```json
{
  "name": "chrome-cdp-cli-plugin-my-plugin",
  "version": "1.0.0",
  "description": "Custom automation commands for Chrome DevTools CLI",
  "main": "plugin.js",
  "keywords": ["chrome-cdp-cli", "plugin", "automation"],
  "author": "Your Name <your.email@example.com>",
  "license": "MIT",
  "engines": {
    "node": ">=18.0.0"
  },
  "peerDependencies": {
    "chrome-cdp-cli": ">=1.0.0"
  },
  "cdpCliPlugin": {
    "name": "my-plugin",
    "version": "1.0.0",
    "apiVersion": "1.0",
    "category": "automation",
    "tags": ["forms", "testing", "custom"],
    "commands": [
      "custom-command",
      "another-command"
    ],
    "configuration": {
      "schema": "./config/schema.json",
      "defaults": "./config/default.yaml"
    }
  }
}
```

## Command Implementation

### Command Handler Structure

```javascript
// commands/custom-command.js
const { CommandHandler } = require('chrome-cdp-cli');

class CustomCommandHandler extends CommandHandler {
  constructor() {
    super();
    this.name = 'custom-command';
    this.description = 'Perform custom automation task';
  }

  /**
   * Get command definition for help and validation
   */
  getDefinition() {
    return {
      name: this.name,
      aliases: ['custom', 'cc'],
      description: this.description,
      usage: 'chrome-cdp-cli custom-command [options] <target>',
      examples: [
        {
          command: 'chrome-cdp-cli custom-command "#element"',
          description: 'Perform custom action on element'
        },
        {
          command: 'chrome-cdp-cli custom-command --mode advanced "#complex-element"',
          description: 'Advanced custom action'
        }
      ],
      options: [
        {
          name: 'mode',
          short: 'm',
          description: 'Operation mode',
          type: 'string',
          choices: ['basic', 'advanced'],
          default: 'basic'
        },
        {
          name: 'timeout',
          short: 't',
          description: 'Operation timeout in milliseconds',
          type: 'number',
          default: 5000
        },
        {
          name: 'retry',
          description: 'Number of retry attempts',
          type: 'number',
          default: 3
        }
      ],
      arguments: [
        {
          name: 'target',
          description: 'Target element selector or identifier',
          type: 'string',
          required: true
        }
      ]
    };
  }

  /**
   * Validate command arguments
   */
  async validateArguments(args) {
    const errors = [];
    
    if (!args.target) {
      errors.push({
        field: 'target',
        message: 'Target selector is required',
        code: 'MISSING_REQUIRED_ARGUMENT'
      });
    }
    
    if (args.timeout && (args.timeout < 1000 || args.timeout > 300000)) {
      errors.push({
        field: 'timeout',
        message: 'Timeout must be between 1000 and 300000 milliseconds',
        code: 'INVALID_RANGE'
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  /**
   * Execute the command
   */
  async execute(args, config, cdpClient) {
    try {
      console.log(`Executing custom command on target: ${args.target}`);
      
      // Implement your custom logic here
      const result = await this.performCustomAction(args, cdpClient);
      
      return {
        success: true,
        data: result,
        message: 'Custom command executed successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: 'CUSTOM_COMMAND_FAILED'
      };
    }
  }

  /**
   * Custom action implementation
   */
  async performCustomAction(args, cdpClient) {
    const { target, mode, timeout, retry } = args;
    
    // Example: Custom element interaction
    for (let attempt = 1; attempt <= retry; attempt++) {
      try {
        // Find element
        const element = await cdpClient.findElement(target, { timeout });
        
        if (mode === 'advanced') {
          // Advanced custom logic
          await this.advancedAction(element, cdpClient);
        } else {
          // Basic custom logic
          await this.basicAction(element, cdpClient);
        }
        
        return {
          target,
          mode,
          attempt,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        if (attempt === retry) {
          throw error;
        }
        console.log(`Attempt ${attempt} failed, retrying...`);
        await this.sleep(1000);
      }
    }
  }

  async basicAction(element, cdpClient) {
    // Implement basic action
    await cdpClient.click(element);
  }

  async advancedAction(element, cdpClient) {
    // Implement advanced action
    await cdpClient.hover(element);
    await this.sleep(500);
    await cdpClient.click(element);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = CustomCommandHandler;
```

### Command Schema Definition

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Custom Command Schema",
  "description": "Schema for custom-command validation",
  "type": "object",
  "properties": {
    "target": {
      "type": "string",
      "description": "CSS selector for target element",
      "minLength": 1
    },
    "mode": {
      "type": "string",
      "enum": ["basic", "advanced"],
      "default": "basic"
    },
    "timeout": {
      "type": "number",
      "minimum": 1000,
      "maximum": 300000,
      "default": 5000
    },
    "retry": {
      "type": "number",
      "minimum": 1,
      "maximum": 10,
      "default": 3
    }
  },
  "required": ["target"],
  "additionalProperties": false
}
```

## Plugin Configuration

### Default Configuration

```yaml
# config/default.yaml
enabled: true
timeout: 30000
retryAttempts: 3
logLevel: info

# Plugin-specific settings
customSettings:
  advancedMode: false
  cacheResults: true
  maxCacheSize: 100

# Command-specific defaults
commands:
  custom-command:
    timeout: 5000
    mode: basic
    retry: 3
  
  another-command:
    timeout: 10000
    batchSize: 10
```

### Configuration Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Plugin Configuration Schema",
  "type": "object",
  "properties": {
    "enabled": {
      "type": "boolean",
      "default": true
    },
    "timeout": {
      "type": "number",
      "minimum": 1000,
      "default": 30000
    },
    "retryAttempts": {
      "type": "number",
      "minimum": 1,
      "maximum": 10,
      "default": 3
    },
    "logLevel": {
      "type": "string",
      "enum": ["debug", "info", "warn", "error"],
      "default": "info"
    },
    "customSettings": {
      "type": "object",
      "properties": {
        "advancedMode": {
          "type": "boolean",
          "default": false
        },
        "cacheResults": {
          "type": "boolean",
          "default": true
        },
        "maxCacheSize": {
          "type": "number",
          "minimum": 10,
          "default": 100
        }
      }
    }
  }
}
```

## Plugin Testing

### Unit Tests

```javascript
// tests/plugin.test.js
const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const MyPlugin = require('../plugin');
const CustomCommandHandler = require('../commands/custom-command');

describe('MyPlugin', () => {
  let plugin;
  let mockRegistry;
  let mockConfig;

  beforeEach(() => {
    plugin = new MyPlugin();
    mockRegistry = {
      registerCommand: jest.fn(),
      unregisterCommand: jest.fn()
    };
    mockConfig = {
      plugins: {
        'my-plugin': {
          enabled: true,
          timeout: 30000
        }
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize plugin correctly', async () => {
      await plugin.initialize(mockRegistry, mockConfig);
      
      expect(mockRegistry.registerCommand).toHaveBeenCalledTimes(2);
      expect(plugin.config).toEqual(mockConfig.plugins['my-plugin']);
    });

    it('should handle missing configuration', async () => {
      const emptyConfig = { plugins: {} };
      await plugin.initialize(mockRegistry, emptyConfig);
      
      expect(plugin.config).toEqual({});
    });
  });

  describe('compatibility', () => {
    it('should validate compatible CLI version', () => {
      const isCompatible = plugin.validateCompatibility('1.2.0');
      expect(isCompatible).toBe(true);
    });

    it('should reject incompatible CLI version', () => {
      const isCompatible = plugin.validateCompatibility('0.9.0');
      expect(isCompatible).toBe(false);
    });
  });
});

describe('CustomCommandHandler', () => {
  let handler;
  let mockCdpClient;

  beforeEach(() => {
    handler = new CustomCommandHandler();
    mockCdpClient = {
      findElement: jest.fn(),
      click: jest.fn(),
      hover: jest.fn()
    };
  });

  describe('argument validation', () => {
    it('should validate correct arguments', async () => {
      const args = {
        target: '#test-element',
        mode: 'basic',
        timeout: 5000
      };
      
      const result = await handler.validateArguments(args);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing target', async () => {
      const args = { mode: 'basic' };
      
      const result = await handler.validateArguments(args);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('target');
    });

    it('should reject invalid timeout', async () => {
      const args = {
        target: '#test-element',
        timeout: 500 // Too low
      };
      
      const result = await handler.validateArguments(args);
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe('timeout');
    });
  });

  describe('command execution', () => {
    it('should execute basic command successfully', async () => {
      const args = {
        target: '#test-element',
        mode: 'basic',
        timeout: 5000,
        retry: 1
      };
      
      mockCdpClient.findElement.mockResolvedValue({ id: 'element-1' });
      mockCdpClient.click.mockResolvedValue(true);
      
      const result = await handler.execute(args, {}, mockCdpClient);
      
      expect(result.success).toBe(true);
      expect(result.data.target).toBe('#test-element');
      expect(mockCdpClient.findElement).toHaveBeenCalledWith('#test-element', { timeout: 5000 });
      expect(mockCdpClient.click).toHaveBeenCalled();
    });

    it('should handle execution errors', async () => {
      const args = {
        target: '#nonexistent-element',
        mode: 'basic',
        timeout: 5000,
        retry: 1
      };
      
      mockCdpClient.findElement.mockRejectedValue(new Error('Element not found'));
      
      const result = await handler.execute(args, {}, mockCdpClient);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Element not found');
    });

    it('should retry on failure', async () => {
      const args = {
        target: '#flaky-element',
        mode: 'basic',
        timeout: 5000,
        retry: 3
      };
      
      mockCdpClient.findElement
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue({ id: 'element-1' });
      mockCdpClient.click.mockResolvedValue(true);
      
      const result = await handler.execute(args, {}, mockCdpClient);
      
      expect(result.success).toBe(true);
      expect(mockCdpClient.findElement).toHaveBeenCalledTimes(3);
    });
  });
});
```

### Integration Tests

```javascript
// tests/integration.test.js
const { spawn } = require('child_process');
const path = require('path');

describe('Plugin Integration', () => {
  const cliPath = path.resolve(__dirname, '../../../bin/chrome-cdp-cli');
  
  it('should load plugin and execute custom command', (done) => {
    const child = spawn('node', [
      cliPath,
      '--plugin-dir', __dirname + '/..',
      'custom-command',
      '#test-element'
    ]);
    
    let output = '';
    child.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    child.on('close', (code) => {
      expect(code).toBe(0);
      expect(output).toContain('Custom command executed successfully');
      done();
    });
  });

  it('should show plugin commands in help', (done) => {
    const child = spawn('node', [
      cliPath,
      '--plugin-dir', __dirname + '/..',
      'help'
    ]);
    
    let output = '';
    child.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    child.on('close', (code) => {
      expect(code).toBe(0);
      expect(output).toContain('custom-command');
      expect(output).toContain('Perform custom automation task');
      done();
    });
  });
});
```

## Plugin Distribution

### NPM Package

```bash
# Prepare for publishing
npm version patch
npm publish

# Install plugin
npm install -g chrome-cdp-cli-plugin-my-plugin

# Plugin will be automatically discovered in:
# ~/.npm/lib/node_modules/chrome-cdp-cli-plugin-*/
```

### Local Development

```bash
# Link plugin for development
cd my-plugin
npm link

# Link to CLI
cd chrome-cdp-cli
npm link chrome-cdp-cli-plugin-my-plugin

# Test plugin
chrome-cdp-cli --plugin-dir ./plugins custom-command "#test"
```

### Plugin Directory Structure

```bash
# User plugins
~/.chrome-cdp-cli/plugins/
├── my-plugin/
├── company-automation/
└── testing-helpers/

# Project plugins
./plugins/
├── project-specific/
└── custom-commands/

# System plugins
/usr/local/share/chrome-cdp-cli/plugins/
├── official-extensions/
└── community-plugins/
```

## Advanced Plugin Features

### Plugin Dependencies

```javascript
// plugin.js
class MyPlugin extends PluginBase {
  getDependencies() {
    return [
      'chrome-cdp-cli-plugin-base-automation',
      'chrome-cdp-cli-plugin-selectors'
    ];
  }

  async initialize(registry, config) {
    // Access dependency plugins
    const baseAutomation = registry.getPlugin('base-automation');
    const selectors = registry.getPlugin('selectors');
    
    // Use dependency functionality
    this.selectorHelper = selectors.createHelper();
    this.automationBase = baseAutomation.getBaseClass();
  }
}
```

### Plugin Hooks

```javascript
// plugin.js
class MyPlugin extends PluginBase {
  getHooks() {
    return {
      'before-command': this.beforeCommand.bind(this),
      'after-command': this.afterCommand.bind(this),
      'on-error': this.onError.bind(this)
    };
  }

  async beforeCommand(commandName, args) {
    console.log(`Executing command: ${commandName}`);
    // Pre-command logic
  }

  async afterCommand(commandName, result) {
    console.log(`Command ${commandName} completed`);
    // Post-command logic
  }

  async onError(commandName, error) {
    console.error(`Command ${commandName} failed:`, error);
    // Error handling logic
  }
}
```

### Custom Validators

```javascript
// commands/custom-command.js
class CustomCommandHandler extends CommandHandler {
  getCustomValidators() {
    return {
      'css-selector': this.validateCssSelector.bind(this),
      'url-pattern': this.validateUrlPattern.bind(this)
    };
  }

  validateCssSelector(value) {
    try {
      document.querySelector(value);
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        message: 'Invalid CSS selector syntax'
      };
    }
  }

  validateUrlPattern(value) {
    const urlPattern = /^https?:\/\/.+/;
    return {
      valid: urlPattern.test(value),
      message: 'URL must start with http:// or https://'
    };
  }
}
```

## Best Practices

### 1. Plugin Naming

- Use descriptive names: `chrome-cdp-cli-plugin-form-automation`
- Follow npm naming conventions
- Include `chrome-cdp-cli-plugin-` prefix for discoverability

### 2. Error Handling

```javascript
async execute(args, config, cdpClient) {
  try {
    // Command logic
    return { success: true, data: result };
  } catch (error) {
    // Log error details
    console.error(`Plugin error in ${this.name}:`, error);
    
    // Return structured error
    return {
      success: false,
      error: error.message,
      code: 'PLUGIN_EXECUTION_FAILED',
      details: {
        plugin: this.name,
        command: this.commandName,
        timestamp: new Date().toISOString()
      }
    };
  }
}
```

### 3. Configuration Management

```javascript
class MyPlugin extends PluginBase {
  loadConfiguration(config) {
    const defaults = {
      timeout: 30000,
      retries: 3,
      logLevel: 'info'
    };
    
    return {
      ...defaults,
      ...config.plugins?.[this.name]
    };
  }
}
```

### 4. Documentation

- Include comprehensive README.md
- Provide usage examples
- Document configuration options
- Include troubleshooting guide

### 5. Testing

- Write unit tests for all commands
- Include integration tests
- Test error conditions
- Validate configuration schemas

## Plugin Examples

### Form Automation Plugin

```javascript
// A plugin for advanced form automation
class FormAutomationPlugin extends PluginBase {
  constructor() {
    super();
    this.name = 'form-automation';
    this.description = 'Advanced form filling and validation';
  }

  async initialize(registry, config) {
    await this.registerCommand(registry, 'fill-smart-form', require('./commands/fill-smart-form'));
    await this.registerCommand(registry, 'validate-form', require('./commands/validate-form'));
    await this.registerCommand(registry, 'submit-form', require('./commands/submit-form'));
  }
}
```

### Testing Utilities Plugin

```javascript
// A plugin for testing utilities
class TestingUtilitiesPlugin extends PluginBase {
  constructor() {
    super();
    this.name = 'testing-utilities';
    this.description = 'Utilities for automated testing';
  }

  async initialize(registry, config) {
    await this.registerCommand(registry, 'assert-element', require('./commands/assert-element'));
    await this.registerCommand(registry, 'wait-for-condition', require('./commands/wait-for-condition'));
    await this.registerCommand(registry, 'capture-test-evidence', require('./commands/capture-test-evidence'));
  }
}
```

## Troubleshooting

### Common Issues

1. **Plugin Not Loading**
   - Check plugin directory permissions
   - Verify package.json format
   - Ensure plugin entry point exists

2. **Command Registration Fails**
   - Validate command definition schema
   - Check for naming conflicts
   - Verify handler implementation

3. **Configuration Errors**
   - Validate configuration schema
   - Check default configuration format
   - Ensure required fields are present

### Debug Mode

```bash
# Enable plugin debugging
chrome-cdp-cli --debug --plugin-debug custom-command "#test"

# Show plugin loading information
chrome-cdp-cli --show-plugins

# Validate plugin configuration
chrome-cdp-cli --validate-plugins --plugin-dir ./plugins
```

For more information and examples, see:
- [Plugin API Reference](./PLUGIN_API.md)
- [Example Plugins Repository](https://github.com/chrome-cdp-cli/example-plugins)
- [Plugin Development Tutorial](./PLUGIN_TUTORIAL.md)
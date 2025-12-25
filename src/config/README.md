# Configuration Management System

This module provides a comprehensive configuration management system for the Chrome CDP CLI with support for multiple configuration sources, precedence handling, YAML configuration files, and profiles.

## Features

- **Multiple Configuration Sources**: CLI arguments, environment variables, configuration files, and defaults
- **Configuration Precedence**: CLI > Environment > File > Defaults
- **YAML Support**: Native YAML configuration file support with JSON fallback
- **Profile Support**: Multiple configuration profiles for different environments
- **Validation**: Comprehensive configuration validation with detailed error messages
- **Type Safety**: Full TypeScript support with type checking

## Usage

### Basic Usage

```typescript
import { ConfigurationManager } from './config';

const configManager = new ConfigurationManager();

// Create configuration sources from CLI options
const sources = await configManager.createConfigurationSources({
  verbose: true,
  port: 8080,
  outputFormat: 'json'
});

// Load and merge configuration
const config = await configManager.loadConfiguration(sources);

// Validate configuration
const validation = configManager.validateConfiguration(config);
if (!validation.valid) {
  console.error('Configuration errors:', validation.errors);
}
```

### Configuration File Example

Create a `.chrome-cdp-cli.yaml` file:

```yaml
# Active profile
profile: development

# Global defaults
host: localhost
port: 9222
timeout: 30000
outputFormat: text
verbose: false
quiet: false
debug: false

# Plugin configuration
plugins:
  directories:
    - ~/.chrome-cdp-cli/plugins
    - ./plugins

# Command aliases
aliases:
  ss: screenshot
  snap: snapshot
  js: eval

# Profile-specific configurations
profiles:
  development:
    host: localhost
    port: 9222
    debug: true
    verbose: true
  
  production:
    host: chrome-server
    port: 9222
    quiet: true
    timeout: 60000

# Command-specific defaults
commands:
  screenshot:
    timeout: 10000
    defaults:
      format: png
      quality: 90
      fullPage: false
```

### Environment Variables

Set environment variables with the `CHROME_CDP_CLI_` prefix:

```bash
export CHROME_CDP_CLI_HOST=localhost
export CHROME_CDP_CLI_PORT=8080
export CHROME_CDP_CLI_VERBOSE=true
export CHROME_CDP_CLI_PLUGIN_DIRS=dir1,dir2,dir3
```

### Configuration Precedence

Configuration values are resolved in the following order (highest to lowest priority):

1. **CLI Arguments** (highest priority)
2. **Environment Variables**
3. **Configuration Files** (profile-specific, then default)
4. **Default Values** (lowest priority)

## API Reference

### ConfigurationManager

The main class for managing configuration.

#### Methods

- `loadConfiguration(sources: ConfigSource[]): Promise<CLIConfig>`
- `validateConfiguration(config: CLIConfig): ValidationResult`
- `loadYAMLConfig(filePath: string): Promise<YAMLConfigFile>`
- `loadEnvironmentConfig(): ConfigSource`
- `resolveConfigValue<T>(key: string, type: ConfigValueType): T`
- `createConfigurationSources(cliOptions: Record<string, unknown>): Promise<ConfigSource[]>`

### Utility Functions

- `createDefaultConfigSources(cliOptions)`: Create default configuration sources
- `validateConfigFile(filePath)`: Validate a configuration file
- `getConfigTemplate(format)`: Get configuration file template
- `normalizeConfigPath(path)`: Normalize configuration file path
- `configFileExists(path)`: Check if configuration file exists
- `createConfigFile(path, format)`: Create new configuration file

## Configuration File Locations

The system searches for configuration files in the following locations:

1. Current working directory
2. User home directory
3. `/etc` directory

Supported file names:
- `.chrome-cdp-cli.yaml`
- `.chrome-cdp-cli.yml`
- `.chrome-cdp-cli.json`
- `chrome-cdp-cli.config.yaml`
- `chrome-cdp-cli.config.yml`
- `chrome-cdp-cli.config.json`

## Validation

The configuration system provides comprehensive validation with specific error codes:

- `INVALID_HOST`: Invalid host configuration
- `INVALID_PORT`: Invalid port number
- `INVALID_TIMEOUT`: Invalid timeout value
- `INVALID_OUTPUT_FORMAT`: Invalid output format
- `INVALID_BOOLEAN`: Invalid boolean value
- `CONFLICTING_OPTIONS`: Conflicting configuration options

## Requirements Satisfied

This implementation satisfies the following requirements:

- **2.1**: Configuration file loading and validation
- **2.2**: Environment variable fallback support
- **2.3**: Configuration precedence handling (CLI > env > config > defaults)
- **2.4**: Configuration profiles for different environments
- **2.5**: Detailed error messages for configuration validation failures
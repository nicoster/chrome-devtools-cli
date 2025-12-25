# Configuration Management Guide

The Chrome DevTools CLI supports a comprehensive configuration system with multiple sources, precedence handling, YAML configuration files, and profiles for different environments.

## Configuration Sources and Precedence

Configuration values are resolved in the following order (highest to lowest priority):

1. **Command-line arguments** (highest priority)
2. **Environment variables**
3. **Configuration files** (profile-specific, then default)
4. **Default values** (lowest priority)

This precedence system allows you to set global defaults in configuration files while overriding specific values through environment variables or command-line arguments as needed.

## Configuration File Formats

### YAML Configuration (Recommended)

Create a `.chrome-cdp-cli.yaml` file in your project root or home directory:

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
  click-submit: click "#submit-button"
  fill-login: fill_form --fields-file login-form.json

# Profile-specific configurations
profiles:
  development:
    host: localhost
    port: 9222
    debug: true
    verbose: true
    timeout: 60000
  
  testing:
    host: test-chrome
    port: 9223
    quiet: true
    outputFormat: json
    timeout: 45000
  
  production:
    host: prod-chrome-server
    port: 9222
    quiet: true
    timeout: 120000
    outputFormat: json

# Command-specific defaults
commands:
  screenshot:
    timeout: 10000
    defaults:
      format: png
      quality: 90
      fullPage: false
  
  eval:
    timeout: 15000
    defaults:
      awaitPromise: true
      returnByValue: true
  
  fill_form:
    timeout: 8000
    defaults:
      continueOnError: true
      clearFirst: true
```

### JSON Configuration (Alternative)

You can also use JSON format with `.chrome-cdp-cli.json`:

```json
{
  "profile": "development",
  "host": "localhost",
  "port": 9222,
  "timeout": 30000,
  "outputFormat": "text",
  "verbose": false,
  "quiet": false,
  "debug": false,
  "plugins": {
    "directories": [
      "~/.chrome-cdp-cli/plugins",
      "./plugins"
    ]
  },
  "aliases": {
    "ss": "screenshot",
    "snap": "snapshot",
    "js": "eval"
  },
  "profiles": {
    "development": {
      "host": "localhost",
      "port": 9222,
      "debug": true,
      "verbose": true
    },
    "production": {
      "host": "prod-chrome-server",
      "port": 9222,
      "quiet": true,
      "timeout": 60000
    }
  },
  "commands": {
    "screenshot": {
      "timeout": 10000,
      "defaults": {
        "format": "png",
        "quality": 90,
        "fullPage": false
      }
    }
  }
}
```

## Configuration File Locations

The CLI searches for configuration files in the following locations (in order):

1. **Current working directory**
   - `.chrome-cdp-cli.yaml`
   - `.chrome-cdp-cli.yml`
   - `.chrome-cdp-cli.json`

2. **User home directory**
   - `~/.chrome-cdp-cli.yaml`
   - `~/.chrome-cdp-cli.yml`
   - `~/.chrome-cdp-cli.json`

3. **System-wide configuration**
   - `/etc/chrome-cdp-cli.yaml`
   - `/etc/chrome-cdp-cli.yml`
   - `/etc/chrome-cdp-cli.json`

4. **Alternative naming conventions**
   - `chrome-cdp-cli.config.yaml`
   - `chrome-cdp-cli.config.yml`
   - `chrome-cdp-cli.config.json`

## Environment Variables

Set environment variables with the `CHROME_CDP_CLI_` prefix:

```bash
# Connection settings
export CHROME_CDP_CLI_HOST=localhost
export CHROME_CDP_CLI_PORT=8080
export CHROME_CDP_CLI_TIMEOUT=45000

# Output settings
export CHROME_CDP_CLI_OUTPUT_FORMAT=json
export CHROME_CDP_CLI_VERBOSE=true
export CHROME_CDP_CLI_QUIET=false
export CHROME_CDP_CLI_DEBUG=true

# Profile selection
export CHROME_CDP_CLI_PROFILE=production

# Plugin directories (comma-separated)
export CHROME_CDP_CLI_PLUGIN_DIRS=~/.chrome-cdp-cli/plugins,./custom-plugins

# Configuration file path
export CHROME_CDP_CLI_CONFIG=~/.config/chrome-cdp-cli.yaml
```

## Profiles

Profiles allow you to maintain different configuration sets for different environments:

### Using Profiles

```bash
# Use development profile
chrome-cdp-cli --profile development eval "document.title"

# Use production profile
chrome-cdp-cli --profile production screenshot --filename prod-screenshot.png

# Set profile via environment variable
export CHROME_CDP_CLI_PROFILE=testing
chrome-cdp-cli eval "console.log('Testing environment')"
```

### Profile Configuration

```yaml
profiles:
  development:
    host: localhost
    port: 9222
    debug: true
    verbose: true
    aliases:
      test-click: click "#test-button"
  
  staging:
    host: staging-chrome
    port: 9223
    timeout: 45000
    outputFormat: json
    
  production:
    host: prod-chrome-cluster
    port: 9222
    quiet: true
    timeout: 120000
    outputFormat: json
    aliases:
      health-check: eval "document.readyState === 'complete'"
```

## Command Aliases

Define custom aliases for frequently used commands:

### Simple Aliases

```yaml
aliases:
  # Simple command shortcuts
  ss: screenshot
  snap: snapshot
  js: eval
  
  # Command with options
  full-screenshot: screenshot --full-page --format png
  
  # Complex commands
  login-form: fill_form --fields-file login-credentials.json
  health-check: eval "document.readyState === 'complete' && performance.timing.loadEventEnd > 0"
```

### Using Aliases

```bash
# Use simple alias
chrome-cdp-cli ss --filename page.png

# Use complex alias
chrome-cdp-cli login-form

# Aliases work with additional options
chrome-cdp-cli full-screenshot --filename full-page.png
```

## Command-Specific Defaults

Set default options for specific commands:

```yaml
commands:
  screenshot:
    timeout: 15000
    defaults:
      format: png
      quality: 95
      fullPage: true
  
  eval:
    timeout: 10000
    defaults:
      awaitPromise: true
      returnByValue: true
  
  fill_form:
    timeout: 8000
    defaults:
      continueOnError: true
      clearFirst: true
      waitForElements: true
  
  click:
    timeout: 5000
    defaults:
      waitForElement: true
```

## Plugin Configuration

Configure plugin directories and settings:

```yaml
plugins:
  directories:
    - ~/.chrome-cdp-cli/plugins
    - ./project-plugins
    - /usr/local/share/chrome-cdp-cli/plugins
  
  # Plugin-specific configuration
  settings:
    custom-automation:
      enabled: true
      timeout: 30000
    
    advanced-selectors:
      enabled: true
      strictMode: false
```

## Validation and Error Handling

The configuration system provides comprehensive validation:

### Configuration Validation

```bash
# Validate configuration file
chrome-cdp-cli --config ~/.chrome-cdp-cli.yaml --validate-config

# Check configuration precedence
chrome-cdp-cli --debug --show-config eval "1+1"
```

### Common Validation Errors

1. **Invalid Host Configuration**
   ```
   Error: INVALID_HOST - Host 'invalid-host' is not reachable
   Suggestion: Use 'localhost' for local Chrome or verify remote host connectivity
   ```

2. **Invalid Port Number**
   ```
   Error: INVALID_PORT - Port must be between 1 and 65535
   Suggestion: Use default port 9222 or check Chrome startup arguments
   ```

3. **Invalid Profile**
   ```
   Error: INVALID_PROFILE - Profile 'nonexistent' not found in configuration
   Suggestion: Available profiles: development, staging, production
   ```

## Configuration Examples

### Basic Development Setup

```yaml
# ~/.chrome-cdp-cli.yaml
profile: development
host: localhost
port: 9222
verbose: true
debug: true

aliases:
  test: eval "console.log('Test successful')"
  check: eval "document.readyState"
```

### CI/CD Configuration

```yaml
# .chrome-cdp-cli.yaml (project root)
profile: ci
host: chrome-headless
port: 9222
quiet: true
outputFormat: json
timeout: 60000

profiles:
  ci:
    host: chrome-headless
    port: 9222
    quiet: true
    outputFormat: json
    timeout: 60000
  
  local-ci:
    host: localhost
    port: 9222
    debug: true
    outputFormat: json

commands:
  screenshot:
    defaults:
      format: png
      fullPage: true
  
  eval:
    defaults:
      awaitPromise: true
      returnByValue: true
```

### Multi-Environment Setup

```yaml
# Global configuration
host: localhost
port: 9222
timeout: 30000

profiles:
  development:
    host: localhost
    port: 9222
    debug: true
    verbose: true
    
  staging:
    host: staging-chrome.company.com
    port: 9222
    timeout: 45000
    outputFormat: json
    
  production:
    host: prod-chrome.company.com
    port: 9222
    quiet: true
    timeout: 120000
    outputFormat: json

aliases:
  dev-test: eval "console.log('Development test')"
  staging-health: eval "fetch('/health').then(r => r.status)"
  prod-check: eval "document.readyState === 'complete'"
```

## Best Practices

### 1. Use Profiles for Different Environments

```yaml
profiles:
  development:
    debug: true
    verbose: true
    timeout: 60000
    
  production:
    quiet: true
    timeout: 30000
    outputFormat: json
```

### 2. Set Reasonable Timeouts

```yaml
# Global timeout
timeout: 30000

# Command-specific timeouts
commands:
  screenshot:
    timeout: 15000  # Screenshots may take longer
  
  eval:
    timeout: 10000  # JavaScript execution
  
  click:
    timeout: 5000   # User interactions should be fast
```

### 3. Use Aliases for Complex Commands

```yaml
aliases:
  # Form automation
  login: fill_form --fields-file credentials.json
  
  # Testing workflows
  test-suite: eval --file test-automation.js
  
  # Monitoring
  check-errors: eval "console.error.length || 0"
```

### 4. Organize Plugin Directories

```yaml
plugins:
  directories:
    - ~/.chrome-cdp-cli/plugins     # User plugins
    - ./project-plugins             # Project-specific plugins
    - /opt/company/cdp-plugins      # Company-wide plugins
```

### 5. Use Environment Variables for Secrets

```bash
# Don't put secrets in config files
export CHROME_CDP_CLI_AUTH_TOKEN=secret-token
export CHROME_CDP_CLI_API_KEY=api-key

# Reference in commands
chrome-cdp-cli eval "fetch('/api', {headers: {'Authorization': 'Bearer ' + process.env.CHROME_CDP_CLI_AUTH_TOKEN}})"
```

## Troubleshooting Configuration

### Debug Configuration Loading

```bash
# Show effective configuration
chrome-cdp-cli --debug --show-config help

# Validate configuration file
chrome-cdp-cli --validate-config --config ~/.chrome-cdp-cli.yaml

# Test configuration precedence
CHROME_CDP_CLI_VERBOSE=true chrome-cdp-cli --quiet eval "1+1"
```

### Common Issues

1. **Configuration File Not Found**
   - Check file path and permissions
   - Verify file format (YAML/JSON syntax)
   - Use `--config` to specify explicit path

2. **Profile Not Loading**
   - Verify profile name exists in configuration
   - Check profile-specific settings syntax
   - Use `--debug` to see profile resolution

3. **Environment Variables Not Working**
   - Ensure correct `CHROME_CDP_CLI_` prefix
   - Check variable names match configuration keys
   - Verify environment variable values and types

4. **Alias Not Found**
   - Check alias definition in active profile
   - Verify alias syntax and target command
   - Use `--debug` to see alias resolution

For more help with configuration issues, use:
```bash
chrome-cdp-cli help topic configuration
chrome-cdp-cli help topic debugging
```
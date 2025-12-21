# Chrome DevTools CLI

A powerful command-line tool for controlling Chrome browser instances via the Chrome DevTools Protocol (CDP). This tool provides programmatic access to browser automation, debugging, and inspection capabilities without requiring a graphical interface.

## Features

- 🔗 **Connection Management**: Connect to local or remote Chrome instances
- 📄 **Page Management**: Navigate, create, close, and manage browser tabs
- ⚡ **JavaScript Execution**: Execute JavaScript code in browser context with full async support
- 📸 **Visual Capture**: Take screenshots and capture HTML content
- 🖱️ **Element Interaction**: Click, hover, fill forms, and interact with page elements
- 📊 **Monitoring**: Monitor console messages and network requests in real-time
- 🚀 **Performance Analysis**: Profile page performance and analyze metrics
- 📱 **Device Emulation**: Simulate different devices and network conditions
- 🔧 **Flexible Output**: Support for JSON and human-readable text output formats

## Installation

### From npm (Recommended)

```bash
npm install -g chrome-cdp-cli
```

### Using npx (No Installation Required)

```bash
# Run directly with npx
npx chrome-cdp-cli eval "document.title"

# All commands work with npx
npx chrome-cdp-cli eval "Math.PI * 2"
npx chrome-cdp-cli eval --file script.js
npx chrome-cdp-cli --help
```

### From Source

```bash
git clone https://github.com/nickxiao42/chrome-devtools-cli.git
cd chrome-devtools-cli
npm install
npm run build
npm link
```

## Prerequisites

- **Node.js**: Version 18.0.0 or higher
- **Chrome Browser**: Any recent version with DevTools support
- **Chrome DevTools**: Must be enabled with remote debugging

### Starting Chrome with DevTools

Before using the CLI, start Chrome with remote debugging enabled:

```bash
# Default port (9222)
chrome --remote-debugging-port=9222

# Custom port
chrome --remote-debugging-port=9223

# Headless mode
chrome --headless --remote-debugging-port=9222

# With additional flags for automation
chrome --remote-debugging-port=9222 --no-first-run --no-default-browser-check
```

## Quick Start

```bash
# Connect and execute JavaScript
chrome-cdp-cli eval "document.title"

# Or use with npx (no installation needed)
npx chrome-cdp-cli eval "document.title"

# Navigate to a website
chrome-cdp-cli navigate_page "https://example.com"

# Take a screenshot
chrome-cdp-cli screenshot --filename screenshot.png

# Click an element
chrome-cdp-cli click "#submit-button"

# Fill a form field
chrome-cdp-cli fill "#email" "user@example.com"

# Get help for all commands
chrome-cdp-cli --help

# Get help for a specific command
chrome-cdp-cli eval --help
```

## Command Reference

### Connection Options

All commands support these connection options:

- `--host <host>`: Chrome host (default: localhost)
- `--port <port>`: DevTools port (default: 9222)
- `--timeout <ms>`: Command timeout in milliseconds (default: 30000)

### Output Options

- `--format <format>`: Output format - 'json' or 'text' (default: text)
- `--quiet`: Suppress non-essential output
- `--verbose`: Enable detailed logging

### Core Commands

#### JavaScript Execution
```bash
# Execute JavaScript expression
chrome-cdp-cli eval "console.log('Hello World')"

# Execute from file
chrome-cdp-cli eval --file script.js

# Execute with timeout
chrome-cdp-cli eval "await new Promise(r => setTimeout(r, 5000))" --timeout 10000

# Using npx (no installation required)
npx chrome-cdp-cli eval "document.title"
npx chrome-cdp-cli eval --file script.js
```

#### Page Management
```bash
# Navigate to URL
chrome-cdp-cli navigate_page "https://example.com"

# Create new tab
chrome-cdp-cli new_page

# List all pages
chrome-cdp-cli list_pages

# Close current page
chrome-cdp-cli close_page

# Switch to specific page
chrome-cdp-cli select_page --id "page-id"
```

#### Element Interaction
```bash
# Click element
chrome-cdp-cli click "#button"

# Fill input field
chrome-cdp-cli fill "#email" "user@example.com"

# Hover over element
chrome-cdp-cli hover ".menu-item"

# Wait for element
chrome-cdp-cli wait_for "#loading" --timeout 5000
```

#### Visual Capture
```bash
# Take screenshot
chrome-cdp-cli screenshot --filename screenshot.png

# Full page screenshot  
chrome-cdp-cli screenshot --full-page --filename fullpage.png

# DOM snapshot
chrome-cdp-cli snapshot --filename dom-snapshot.json

# Custom dimensions
chrome-cdp-cli screenshot --width 1920 --height 1080 --filename custom.png

# Get HTML content
chrome-cdp-cli get_html --output page.html
```

## Configuration

### Configuration File

Create a `.chrome-cdp-cli.json` file in your project root or home directory:

```json
{
  "host": "localhost",
  "port": 9222,
  "timeout": 30000,
  "outputFormat": "text",
  "verbose": false,
  "quiet": false
}
```

### Environment Variables

- `CHROME_CLI_HOST`: Default Chrome host
- `CHROME_CLI_PORT`: Default DevTools port
- `CHROME_CLI_TIMEOUT`: Default command timeout
- `CHROME_CLI_FORMAT`: Default output format

## Development

### Setup

```bash
# Clone repository
git clone https://github.com/nickxiao42/chrome-devtools-cli.git
cd chrome-devtools-cli

# Install dependencies
npm install

# Run in development mode
npm run dev -- eval "console.log('Development mode')"
```

### Build Scripts

```bash
# Development build (with source maps and declarations)
npm run build

# Production build (optimized, no source maps)
npm run build:prod

# Watch mode for development
npm run build:watch

# Clean build artifacts
npm run clean
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run tests for CI (no watch, with coverage)
npm run test:ci
```

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Verify everything (lint + test + build)
npm run verify
```

### Packaging

```bash
# Create npm package
npm run package

# Prepare for publishing
npm run prepublishOnly
```

## Project Structure

```
chrome-devtools-cli/
├── src/
│   ├── cli/              # CLI interface and command routing
│   ├── client/           # CDP client implementation
│   ├── connection/       # Connection management
│   ├── handlers/         # Command handlers
│   ├── interfaces/       # TypeScript interfaces
│   ├── types/           # Type definitions
│   ├── utils/           # Utility functions
│   ├── test/            # Test setup and utilities
│   └── index.ts         # Main entry point
├── scripts/             # Build and utility scripts
├── dist/               # Compiled JavaScript output
├── coverage/           # Test coverage reports
├── tsconfig.json       # TypeScript configuration
├── tsconfig.prod.json  # Production TypeScript config
├── jest.config.js      # Jest test configuration
├── package.json        # Package configuration
└── README.md          # This file
```

## API Documentation

### TypeScript Support

The package includes full TypeScript definitions. Import types for programmatic usage:

```typescript
import { 
  CDPClient, 
  CommandResult, 
  CLIConfig,
  BrowserTarget 
} from 'chrome-cdp-cli';
```

### Programmatic Usage

```typescript
import { CLIApplication } from 'chrome-cdp-cli';

const app = new CLIApplication();
const result = await app.run(['eval', 'document.title']);
console.log(result);
```

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Ensure Chrome is running with `--remote-debugging-port=9222`
   - Check if the port is correct and not blocked by firewall

2. **Command Timeout**
   - Increase timeout with `--timeout` option
   - Check if the page is responsive

3. **Element Not Found**
   - Verify CSS selectors are correct
   - Use `wait_for` command to wait for dynamic elements

4. **Permission Denied**
   - Ensure Chrome has necessary permissions
   - Check file system permissions for screenshot output

### Debug Mode

Enable verbose logging for troubleshooting:

```bash
chrome-cdp-cli --verbose eval "console.log('debug')"
```

### Packaging

```bash
# Create npm package
npm run package

# Prepare for publishing
npm run prepublishOnly
```

## Publishing to npm

To make this tool available via `npx`, you need to publish it to npm:

```bash
# 1. Login to npm (one time setup)
npm login

# 2. Publish the package
npm publish

# 3. Users can then use it with npx
npx chrome-cdp-cli eval "document.title"
```

**Note**: The package name `chrome-cdp-cli` uses a clean, descriptive approach. This approach:

- ✅ **Professional naming** that clearly indicates Chrome DevTools Protocol CLI
- ✅ **Works with npx**: `npx chrome-cdp-cli eval "document.title"`
- ✅ **Simple installation**: `npm install -g chrome-cdp-cli`
- ✅ **Short and memorable** compared to longer alternatives

Alternative naming examples:
1. **Scoped name**: `@nickxiao42/chrome-devtools-cli`
2. **Longer descriptive**: `chrome-automation-cli`

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Run the verification suite: `npm run verify`
5. Commit your changes: `git commit -am 'Add feature'`
6. Push to the branch: `git push origin feature-name`
7. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](https://github.com/nickxiao42/chrome-devtools-cli/wiki)
- 🐛 [Issue Tracker](https://github.com/nickxiao42/chrome-devtools-cli/issues)
- 💬 [Discussions](https://github.com/nickxiao42/chrome-devtools-cli/discussions)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and updates.
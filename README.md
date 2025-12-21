# Chrome DevTools CLI

A powerful command-line tool for controlling Chrome browser instances via the Chrome DevTools Protocol (CDP). This tool provides programmatic access to browser automation, debugging, and inspection capabilities without requiring a graphical interface.

## Implementation Status

### ✅ Fully Implemented Features

- 🔗 **Connection Management**: Connect to local or remote Chrome instances with auto-discovery
- ⚡ **JavaScript Execution**: Execute JavaScript code in browser context with full async support and file execution
- 📸 **Visual Capture**: Take screenshots and capture complete DOM snapshots with layout information
- 📊 **Console Monitoring**: Real-time console message capture with filtering and storage
- 🌐 **Network Monitoring**: Real-time network request/response monitoring with comprehensive filtering
- 🔧 **CLI Interface**: Full command-line interface with argument parsing and routing
- 🛠️ **IDE Integration**: Install Cursor commands and Claude skills with directory validation and --force option
- 📦 **Build System**: Complete TypeScript build pipeline with testing framework

### 🚧 Eval Workaround Available

These features are not directly implemented but can be achieved using the `eval` command:

- 📄 **Page Navigation**: `eval "window.location.href = 'https://example.com'"`
- 🖱️ **Element Interaction**: `eval "document.querySelector('#btn').click()"`
- 📝 **Form Filling**: `eval "document.querySelector('#input').value = 'text'"`
- 📄 **HTML Content**: `eval "document.documentElement.outerHTML"`
- 🚀 **Performance Data**: `eval "performance.now()"` or `eval "performance.getEntriesByType('navigation')"`
- 📱 **User Agent**: `eval "navigator.userAgent"`
- 🌐 **Network Requests**: `eval "fetch('/api').then(r => r.json())"`

### ⏳ Not Yet Implemented

- 📄 **Direct Page Management**: Native commands for creating, closing, listing, and selecting tabs
- 🖱️ **Direct Element Interaction**: Native click, hover, drag, and form filling commands
- 🚀 **Performance Analysis**: Native performance profiling and metrics collection
- 📱 **Device Emulation**: Native device and network condition simulation
- 📊 **Output Formatting**: Advanced JSON/text formatting with quiet/verbose modes

## Features

- 🔗 **Connection Management**: Connect to local or remote Chrome instances
- ⚡ **JavaScript Execution**: Execute JavaScript code in browser context with full async support
- 📸 **Visual Capture**: Take screenshots and capture HTML content
- 📊 **Monitoring**: Monitor console messages and network requests in real-time
- 🔧 **Flexible Output**: Support for JSON and human-readable text output formats
- 🚧 **Eval Workarounds**: Many advanced features available through JavaScript execution

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

# Navigate to a website (via eval)
chrome-cdp-cli eval "window.location.href = 'https://example.com'"

# Take a screenshot
chrome-cdp-cli screenshot --filename screenshot.png

# Capture DOM snapshot
chrome-cdp-cli snapshot --filename dom-snapshot.json

# Click an element (via eval)
chrome-cdp-cli eval "document.querySelector('#submit-button').click()"

# Fill a form field (via eval)
chrome-cdp-cli eval "document.querySelector('#email').value = 'user@example.com'"

# Monitor console messages
chrome-cdp-cli get_console_message

# Monitor network requests
chrome-cdp-cli get_network_request

# Install IDE integrations
chrome-cdp-cli install-cursor-command
chrome-cdp-cli install-claude-skill --skill-type personal

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

### ✅ Implemented Commands

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

#### Visual Capture
```bash
# Take screenshot
chrome-cdp-cli screenshot --filename screenshot.png

# Full page screenshot  
chrome-cdp-cli screenshot --full-page --filename fullpage.png

# DOM snapshot with complete layout information
chrome-cdp-cli snapshot --filename dom-snapshot.json

# Custom dimensions
chrome-cdp-cli screenshot --width 1920 --height 1080 --filename custom.png
```

#### Console Monitoring
```bash
# Get latest console message
chrome-cdp-cli get_console_message

# List all console messages
chrome-cdp-cli list_console_messages

# Filter console messages
chrome-cdp-cli list_console_messages --filter '{"types":["error","warn"]}'
```

#### Network Monitoring
```bash
# Get latest network request
chrome-cdp-cli get_network_request

# List all network requests
chrome-cdp-cli list_network_requests

# Filter network requests
chrome-cdp-cli list_network_requests --filter '{"methods":["POST"],"statusCodes":[200,201]}'
```

#### IDE Integration
```bash
# Install Cursor command (creates .cursor/commands/cdp-cli.md)
chrome-cdp-cli install-cursor-command

# Install Cursor command with --force (bypasses directory validation)
chrome-cdp-cli install-cursor-command --force

# Install Claude skill for project (creates .claude/skills/cdp-cli/SKILL.md)
chrome-cdp-cli install-claude-skill

# Install Claude skill for personal use (creates ~/.claude/skills/cdp-cli/SKILL.md)
chrome-cdp-cli install-claude-skill --skill-type personal

# Install Claude skill with examples and references
chrome-cdp-cli install-claude-skill --include-examples --include-references

# Install with custom directory
chrome-cdp-cli install-cursor-command --target-directory /custom/path/.cursor/commands
chrome-cdp-cli install-claude-skill --target-directory /custom/path/.claude/skills

# Force install (bypasses directory validation)
chrome-cdp-cli install-cursor-command --force
chrome-cdp-cli install-claude-skill --force
```

### 🚧 Available via Eval Workarounds

#### Page Management
```bash
# Navigate to URL
chrome-cdp-cli eval "window.location.href = 'https://example.com'"

# Get current URL
chrome-cdp-cli eval "window.location.href"

# Reload page
chrome-cdp-cli eval "window.location.reload()"

# Go back
chrome-cdp-cli eval "window.history.back()"

# Go forward
chrome-cdp-cli eval "window.history.forward()"
```

#### Element Interaction
```bash
# Click element
chrome-cdp-cli eval "document.querySelector('#button').click()"

# Fill input field
chrome-cdp-cli eval "document.querySelector('#email').value = 'user@example.com'"

# Hover over element (trigger mouseover event)
chrome-cdp-cli eval "document.querySelector('.menu-item').dispatchEvent(new MouseEvent('mouseover'))"

# Check if element exists
chrome-cdp-cli eval "!!document.querySelector('#element')"

# Get element text
chrome-cdp-cli eval "document.querySelector('#element').textContent"

# Get element attributes
chrome-cdp-cli eval "document.querySelector('#element').getAttribute('class')"
```

#### Form Handling
```bash
# Fill multiple form fields
chrome-cdp-cli eval "
document.querySelector('#name').value = 'John Doe';
document.querySelector('#email').value = 'john@example.com';
document.querySelector('#phone').value = '123-456-7890';
"

# Submit form
chrome-cdp-cli eval "document.querySelector('#myform').submit()"

# Select dropdown option
chrome-cdp-cli eval "document.querySelector('#dropdown').value = 'option1'"

# Check checkbox
chrome-cdp-cli eval "document.querySelector('#checkbox').checked = true"
```

#### Content Extraction
```bash
# Get page HTML
chrome-cdp-cli eval "document.documentElement.outerHTML"

# Get page title
chrome-cdp-cli eval "document.title"

# Get all links
chrome-cdp-cli eval "Array.from(document.querySelectorAll('a')).map(a => a.href)"

# Get all images
chrome-cdp-cli eval "Array.from(document.querySelectorAll('img')).map(img => img.src)"

# Extract table data
chrome-cdp-cli eval "Array.from(document.querySelectorAll('table tr')).map(row => Array.from(row.cells).map(cell => cell.textContent))"
```

#### Performance Monitoring
```bash
# Get performance timing
chrome-cdp-cli eval "performance.timing"

# Get navigation entries
chrome-cdp-cli eval "performance.getEntriesByType('navigation')"

# Get resource entries
chrome-cdp-cli eval "performance.getEntriesByType('resource')"

# Get current timestamp
chrome-cdp-cli eval "performance.now()"

# Measure performance
chrome-cdp-cli eval "
performance.mark('start');
// ... some operation ...
performance.mark('end');
performance.measure('operation', 'start', 'end');
performance.getEntriesByName('operation')[0].duration;
"
```

#### Network Operations
```bash
# Make HTTP request
chrome-cdp-cli eval "fetch('/api/data').then(r => r.json())"

# POST data
chrome-cdp-cli eval "
fetch('/api/users', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({name: 'John', email: 'john@example.com'})
}).then(r => r.json())
"

# Check network connectivity
chrome-cdp-cli eval "navigator.onLine"
```

#### Browser Information
```bash
# Get user agent
chrome-cdp-cli eval "navigator.userAgent"

# Get viewport size
chrome-cdp-cli eval "{width: window.innerWidth, height: window.innerHeight}"

# Get screen resolution
chrome-cdp-cli eval "{width: screen.width, height: screen.height}"

# Get browser language
chrome-cdp-cli eval "navigator.language"

# Get cookies
chrome-cdp-cli eval "document.cookie"
```

### ⏳ Not Yet Implemented

These features require dedicated handlers and are not yet available:

- Native page management commands (new_page, close_page, list_pages, select_page)
- Native element interaction commands (click, hover, fill, drag)
- Native performance profiling commands
- Native device emulation commands
- Advanced output formatting options

## The Power of Eval

The `eval` command is the most powerful feature of this CLI tool. It allows you to execute any JavaScript code in the browser context, making it possible to achieve almost any browser automation task. Here are some advanced examples:

### Advanced Automation Examples

```bash
# Wait for element to appear
chrome-cdp-cli eval "
new Promise(resolve => {
  const check = () => {
    const element = document.querySelector('#dynamic-content');
    if (element) resolve(element.textContent);
    else setTimeout(check, 100);
  };
  check();
})
"

# Scroll to element
chrome-cdp-cli eval "
document.querySelector('#target').scrollIntoView({behavior: 'smooth'});
"

# Take element screenshot (get element bounds for screenshot)
chrome-cdp-cli eval "
const element = document.querySelector('#target');
const rect = element.getBoundingClientRect();
({x: rect.x, y: rect.y, width: rect.width, height: rect.height})
"

# Simulate complex user interactions
chrome-cdp-cli eval "
const element = document.querySelector('#button');
element.dispatchEvent(new MouseEvent('mousedown'));
setTimeout(() => element.dispatchEvent(new MouseEvent('mouseup')), 100);
"

# Extract structured data
chrome-cdp-cli eval "
Array.from(document.querySelectorAll('.product')).map(product => ({
  name: product.querySelector('.name').textContent,
  price: product.querySelector('.price').textContent,
  image: product.querySelector('img').src
}))
"

# Monitor page changes
chrome-cdp-cli eval "
new Promise(resolve => {
  const observer = new MutationObserver(mutations => {
    resolve(mutations.length + ' changes detected');
    observer.disconnect();
  });
  observer.observe(document.body, {childList: true, subtree: true});
  setTimeout(() => {
    observer.disconnect();
    resolve('No changes in 5 seconds');
  }, 5000);
})
"
```

## Current Limitations & Roadmap

### Current Limitations

- **No native page management**: Creating, closing, and switching between tabs requires manual implementation
- **No native element interaction**: Clicking, hovering, and form filling must be done via eval
- **No performance profiling**: Advanced performance analysis requires manual JavaScript
- **No device emulation**: Mobile/tablet simulation not yet implemented
- **Basic output formatting**: Advanced JSON/text formatting options not available

### Upcoming Features

1. **Native Page Management Commands**
   - `new_page`, `close_page`, `list_pages`, `select_page`
   - Direct CDP Target domain integration

2. **Native Element Interaction**
   - `click`, `hover`, `fill`, `drag` commands
   - CSS selector-based element targeting

3. **Performance Analysis**
   - `performance_start_trace`, `performance_stop_trace`
   - Built-in performance metrics and analysis

4. **Device Emulation**
   - `emulate` command for device simulation
   - Network condition simulation

5. **Advanced Output Formatting**
   - Enhanced JSON/text formatting
   - Quiet and verbose modes
   - Custom output templates

### Why Use Eval Workarounds?

The eval approach offers several advantages:

- **Immediate availability**: No waiting for feature implementation
- **Maximum flexibility**: Any JavaScript operation is possible
- **Learning opportunity**: Better understanding of browser APIs
- **Custom solutions**: Tailor automation to specific needs
- **Future-proof**: Works with any web technology

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
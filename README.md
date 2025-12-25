# Chrome DevTools CLI

A command-line tool for browser automation via Chrome DevTools Protocol (CDP). Designed for developers who need reliable, scriptable browser control with both dedicated commands and flexible JavaScript execution.

## 🚀 Enhanced CLI Features

**New in v2.0:** The CLI now includes a comprehensive refactored parameter system with:

- 🔧 **Advanced Configuration Management**: YAML/JSON config files with profiles and precedence handling
- ⚙️ **Enhanced Argument Parser**: Consistent option handling with validation and schema support  
- 📚 **Comprehensive Help System**: Contextual help, advanced topics, and detailed examples
- 🎯 **Standardized Output**: JSON/text formats with quiet/verbose modes and custom templates
- 🔗 **Command Aliasing**: Built-in and custom aliases for efficient workflows
- 🧩 **Plugin Architecture**: Extensible system for custom commands and functionality
- 🖥️ **Interactive Mode**: Command prompt with tab completion and session management
- ⚡ **Performance Optimizations**: Configuration caching and connection reuse

## 🤔 Why This Tool Exists

**The honest story:** I started using `chrome-devtools-mcp` like everyone else. It worked great... until it didn't. One day it just stopped working - Cursor showed 26 tools available, everything looked normal, but every single tool call threw errors. Classic black box problem: you can't debug what you can't see inside.

**The MCP reality check:** Model Context Protocol sounded promising, but let's be real - it's not exactly taking the world by storm. Meanwhile, Anthropic introduced the SKILL concept, which actually makes sense for how LLMs work. And what pairs perfectly with Skills? Good old-fashioned command-line tools. They're debuggable, efficient, and you can actually see what's happening when things go wrong.

**The pragmatic solution:** Instead of wrestling with mysterious MCP failures, why not build a CLI that just works? One that you can debug, extend, and actually understand. Plus, when your AI assistant needs to automate a browser, it can just write the command and execute it - no black boxes, no mysterious failures, just straightforward automation.

**The result:** A tool that's both powerful enough for complex automation and simple enough that you (and your AI assistant) can actually use it without pulling your hair out.

## Implementation Status

### ✅ Fully Implemented Features

- 🔗 **Connection Management**: Connect to local or remote Chrome instances with auto-discovery
- ⚡ **JavaScript Execution**: Execute JavaScript code in browser context with full async support and file execution
- 📸 **Visual Capture**: Take screenshots and capture complete DOM snapshots with layout information
- 📊 **Console Monitoring**: Real-time console message capture with filtering and storage
- 🌐 **Network Monitoring**: Real-time network request/response monitoring with comprehensive filtering
- 🖱️ **Element Interaction**: Complete native interaction commands (click, hover, fill, drag, press_key, upload_file, wait_for, handle_dialog)
- 🔄 **Proxy Management**: Restart proxy server to refresh stale console and network logs
- 🔧 **CLI Interface**: Full command-line interface with argument parsing and routing
- 🛠️ **IDE Integration**: Install Cursor commands and Claude skills with directory validation and --force option
- 📦 **Build System**: Complete TypeScript build pipeline with testing framework

### 🚧 Available via JavaScript Execution

For maximum flexibility, many advanced features are available through the `eval` command. This approach is particularly powerful for AI assistants and complex automation scenarios:

- 📄 **Page Navigation**: `eval "window.location.href = 'https://example.com'"`
- 🚀 **Performance Data**: `eval "performance.now()"` or `eval "performance.getEntriesByType('navigation')"`
- 📱 **User Agent**: `eval "navigator.userAgent"`
- 🌐 **Network Requests**: `eval "fetch('/api').then(r => r.json())"`

**Why JavaScript execution is powerful:**

1. **Universal capability**: Any browser API, any complexity level, any scenario
2. **Rapid prototyping**: Write → Execute → See Results → Refine
3. **AI-friendly**: Perfect for AI assistants that excel at JavaScript
4. **No waiting**: Accomplish tasks immediately without waiting for feature implementations
5. **Maximum flexibility**: Handle edge cases and custom scenarios easily

**This provides both dedicated commands for common tasks and unlimited flexibility through JavaScript execution.**

### 🎯 IDE Integration - Built for Modern Development

**Why we support Cursor Commands & Claude Skills:**

This tool integrates seamlessly with modern AI-powered development environments. The IDE integrations (`install-cursor-command` and `install-claude-skill`) bring browser automation directly into your workflow:

- **🔄 Seamless Workflow**: AI assistants can write and execute browser automation scripts directly in your IDE
- **🧠 Natural Integration**: JavaScript execution means AI can accomplish any browser task
- **⚡ Instant Execution**: Write scripts → execute via commands → see results → refine in real-time
- **📚 Context-Aware**: AI understands your project context and generates relevant automation
- **🎯 Natural Language → Automation**: Ask "click the submit button" → AI generates and executes the solution
- **🤖 Perfect for AI Assistants**: Claude and Cursor can use browser automation as part of their toolset

**The integration exists because modern development is AI-assisted - these tools work together to enable efficient browser automation.**

### ⏳ Not Yet Implemented

- 📄 **Direct Page Management**: Native commands for creating, closing, listing, and selecting tabs
- 🚀 **Performance Analysis**: Native performance profiling and metrics collection
- 📱 **Device Emulation**: Native device and network condition simulation
- 📊 **Output Formatting**: Advanced JSON/text formatting with quiet/verbose modes

## Features

- 🔗 **Connection Management**: Connect to local or remote Chrome instances
- ⚡ **JavaScript Execution**: Execute JavaScript code in browser context with full async support
- 📸 **Visual Capture**: Take screenshots and capture HTML content
- 📊 **Monitoring**: Monitor console messages and network requests in real-time
- 🖱️ **Element Interaction**: Complete native interaction commands (click, hover, fill, drag, press_key, upload_file, wait_for, handle_dialog)
- 📝 **Form Automation**: Single field and batch form filling with comprehensive options
- 🔄 **Proxy Management**: Restart proxy server to refresh stale logs
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
# Default port (9222) - IMPORTANT: --user-data-dir is required for security
chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug-profile

# Custom port
chrome --remote-debugging-port=9223 --user-data-dir=/tmp/chrome-debug-profile

# Headless mode
chrome --headless --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug-profile

# With additional flags for automation
chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug-profile --no-first-run --no-default-browser-check

# macOS example with full path and logging
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir=/Users/$USER/chrome-profile-debug > /tmp/chrome.log 2>&1 &
```

**Important Notes:**
- **Always use `--user-data-dir`**: This is **required for security**. Chrome will not enable the debugging port without a specified user data directory to prevent unauthorized access to your default profile
- **Choose a dedicated directory**: Use a path like `/tmp/chrome-debug-profile` or `/Users/$USER/chrome-profile-debug`
- **Security requirement**: Without `--user-data-dir`, Chrome will refuse to enable remote debugging to protect your default browser profile

For more details, see the [Chrome Remote Debugging documentation](https://developer.chrome.com/blog/remote-debugging-port).

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

# Capture DOM snapshot (default: text format)
chrome-cdp-cli snapshot --filename dom-snapshot.txt

# Element interactions
chrome-cdp-cli click "#submit-button"
chrome-cdp-cli hover ".menu-item"
chrome-cdp-cli fill "#email" "user@example.com"

# Advanced interactions
chrome-cdp-cli drag "#draggable" "#dropzone"
chrome-cdp-cli press_key "Enter"
chrome-cdp-cli press_key "a" --modifiers Ctrl
chrome-cdp-cli upload_file "input[type='file']" "./document.pdf"
chrome-cdp-cli wait_for "#loading" --condition hidden
chrome-cdp-cli handle_dialog accept

# Batch form filling
chrome-cdp-cli fill_form --fields '[{"selector":"#username","value":"john"},{"selector":"#password","value":"secret"}]'

# Monitor console and network
chrome-cdp-cli console --latest
chrome-cdp-cli network --latest

# Restart proxy server when logs are stale
chrome-cdp-cli restart

# Install IDE integrations
chrome-cdp-cli install_cursor_command
chrome-cdp-cli install_claude_skill --skill-type personal

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

# DOM snapshot with complete layout information (default: text format)
chrome-cdp-cli snapshot --filename dom-snapshot.txt

# Custom dimensions
chrome-cdp-cli screenshot --width 1920 --height 1080 --filename custom.png
```

#### Element Interaction
```bash
# Click on an element using CSS selector
chrome-cdp-cli click "#submit-button"

# Click with custom timeout
chrome-cdp-cli click ".slow-loading-button" --timeout 10000

# Click without waiting for element (fail immediately if not found)
chrome-cdp-cli click "#optional-element" --no-wait

# Hover over an element
chrome-cdp-cli hover "#menu-item"

# Hover over a dropdown trigger
chrome-cdp-cli hover ".dropdown-trigger"

# Fill a single form field
chrome-cdp-cli fill "#username" "john@example.com"

# Fill a password field
chrome-cdp-cli fill "input[type='password']" "secret123"

# Fill a textarea
chrome-cdp-cli fill "#message" "Hello, this is a test message"

# Select an option in a dropdown (by value or text)
chrome-cdp-cli fill "#country" "US"
chrome-cdp-cli fill "#country" "United States"

# Fill without clearing existing content
chrome-cdp-cli fill "#notes" " - Additional note" --no-clear

# Fill multiple form fields in batch
chrome-cdp-cli fill_form --fields '[
  {"selector":"#username","value":"john@example.com"},
  {"selector":"#password","value":"secret123"},
  {"selector":"#country","value":"United States"}
]'

# Fill form from JSON file
echo '[
  {"selector":"#firstName","value":"John"},
  {"selector":"#lastName","value":"Doe"},
  {"selector":"#email","value":"john.doe@example.com"}
]' > form-data.json
chrome-cdp-cli fill_form --fields-file form-data.json

# Fill form with custom options
chrome-cdp-cli fill_form --fields '[
  {"selector":"#notes","value":"Additional information"}
]' --no-clear --timeout 10000 --stop-on-error

# Fill form and continue on errors (default behavior)
chrome-cdp-cli fill_form --fields '[
  {"selector":"#field1","value":"value1"},
  {"selector":"#nonexistent","value":"value2"},
  {"selector":"#field3","value":"value3"}
]' --continue-on-error
```

#### Advanced Interactions
```bash
# Drag and drop operations
chrome-cdp-cli drag "#draggable-item" "#drop-zone"

# Drag with custom timeout
chrome-cdp-cli drag ".file-item" ".upload-area" --timeout 10000

# Keyboard input simulation
chrome-cdp-cli press_key "Enter"
chrome-cdp-cli press_key "Escape"
chrome-cdp-cli press_key "Tab"

# Keyboard input with modifiers
chrome-cdp-cli press_key "a" --modifiers Ctrl  # Ctrl+A (Select All)
chrome-cdp-cli press_key "s" --modifiers Ctrl  # Ctrl+S (Save)
chrome-cdp-cli press_key "c" --modifiers Ctrl,Shift  # Ctrl+Shift+C

# Target specific elements for keyboard input
chrome-cdp-cli press_key "Enter" --selector "#search-input"
chrome-cdp-cli press_key "ArrowDown" --selector "#dropdown"

# File upload to file input elements
chrome-cdp-cli upload_file "input[type='file']" "./document.pdf"
chrome-cdp-cli upload_file "#file-input" "/path/to/image.jpg"
chrome-cdp-cli upload_file ".upload-field" "./test-data.csv"

# Wait for elements to appear or meet conditions
chrome-cdp-cli wait_for "#loading-spinner"  # Wait for element to exist
chrome-cdp-cli wait_for "#modal" --condition visible  # Wait for element to be visible
chrome-cdp-cli wait_for "#loading" --condition hidden  # Wait for element to be hidden
chrome-cdp-cli wait_for "#submit-btn" --condition enabled  # Wait for element to be enabled
chrome-cdp-cli wait_for "#processing-btn" --condition disabled  # Wait for element to be disabled
chrome-cdp-cli wait_for "#slow-element" --timeout 30000  # Custom timeout

# Handle browser dialogs (alert, confirm, prompt)
chrome-cdp-cli handle_dialog accept  # Accept dialog
chrome-cdp-cli handle_dialog dismiss  # Dismiss dialog
chrome-cdp-cli handle_dialog accept --text "John Doe"  # Handle prompt with text input
chrome-cdp-cli handle_dialog accept --text ""  # Handle prompt with empty input
chrome-cdp-cli handle_dialog accept --timeout 10000  # Wait for dialog to appear
```

#### Console Monitoring
```bash
# Get latest console message
chrome-cdp-cli console --latest

# List all console messages
chrome-cdp-cli console

# Filter console messages by type
chrome-cdp-cli console --types error,warn

# Filter by text pattern
chrome-cdp-cli console --textPattern "error|warning"

# Limit number of messages
chrome-cdp-cli console --maxMessages 10
```

**Note**: Console monitoring only captures messages generated *after* monitoring starts. For historical messages or immediate console operations, use the eval-first approach:

```bash
# Generate and capture console messages in one command
chrome-cdp-cli eval "console.log('Test message'); console.warn('Warning'); 'Messages logged'"

# Check for existing console history (if page maintains it)
chrome-cdp-cli eval "window.consoleHistory || window._console_logs || 'No custom console history'"
```

See [Console Monitoring Documentation](docs/CONSOLE_MONITORING.md) for detailed solutions and workarounds.

#### Network Monitoring
```bash
# Get latest network request
chrome-cdp-cli network --latest

# List all network requests
chrome-cdp-cli network

# Filter network requests by method
chrome-cdp-cli network --filter '{"methods":["POST"],"statusCodes":[200,201]}'
```

#### Proxy Management
```bash
# Restart proxy server when console or network logs become stale
chrome-cdp-cli restart

# Force restart even if proxy is healthy
chrome-cdp-cli restart --force
```

#### IDE Integration
```bash
# Install Cursor command (creates .cursor/commands/cdp-cli.md)
chrome-cdp-cli install_cursor_command

# Install Cursor command with --force (bypasses directory validation)
chrome-cdp-cli install_cursor_command --force

# Install Claude skill for project (creates .claude/skills/cdp-cli/SKILL.md)
chrome-cdp-cli install_claude_skill

# Install Claude skill for personal use (creates ~/.claude/skills/cdp-cli/SKILL.md)
chrome-cdp-cli install_claude_skill --skill-type personal

# Install Claude skill with examples and references
chrome-cdp-cli install_claude_skill --include-examples --include-references

# Install with custom directory
chrome-cdp-cli install_cursor_command --target-directory /custom/path/.cursor/commands
chrome-cdp-cli install_claude_skill --target-directory /custom/path/.claude/skills

# Force install (bypasses directory validation)
chrome-cdp-cli install_cursor_command --force
chrome-cdp-cli install_claude_skill --force
```

### 🚧 Available via JavaScript Execution

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
# Native commands (recommended)
chrome-cdp-cli click "#button"
chrome-cdp-cli hover ".menu-item"
chrome-cdp-cli fill "#email" "user@example.com"

# Via JavaScript execution (flexible for complex scenarios)
chrome-cdp-cli eval "document.querySelector('#button').click()"
chrome-cdp-cli eval "document.querySelector('.menu-item').dispatchEvent(new MouseEvent('mouseover'))"
chrome-cdp-cli eval "document.querySelector('#email').value = 'user@example.com'"

# Check if element exists
chrome-cdp-cli eval "!!document.querySelector('#element')"

# Get element text
chrome-cdp-cli eval "document.querySelector('#element').textContent"

# Get element attributes
chrome-cdp-cli eval "document.querySelector('#element').getAttribute('class')"
```

#### Form Handling
```bash
# Native batch form filling (recommended)
chrome-cdp-cli fill_form --fields '[
  {"selector":"#name","value":"John Doe"},
  {"selector":"#email","value":"john@example.com"},
  {"selector":"#phone","value":"123-456-7890"}
]'

# Native single field filling
chrome-cdp-cli fill "#name" "John Doe"
chrome-cdp-cli fill "#email" "john@example.com"

# Via JavaScript execution (for complex form operations)
chrome-cdp-cli eval "
document.querySelector('#name').value = 'John Doe';
document.querySelector('#email').value = 'john@example.com';
document.querySelector('#phone').value = '123-456-7890';
"

# Submit form
chrome-cdp-cli eval "document.querySelector('#myform').submit()"

# Select dropdown option (native)
chrome-cdp-cli fill "#dropdown" "option1"

# Select dropdown option (via JavaScript execution)
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
- **No performance profiling**: Advanced performance analysis requires manual JavaScript
- **No device emulation**: Mobile/tablet simulation not yet implemented
- **Basic output formatting**: Advanced JSON/text formatting options not available

### Upcoming Features

1. **Native Page Management Commands**
   - `new_page`, `close_page`, `list_pages`, `select_page`
   - Direct CDP Target domain integration

2. **Performance Analysis**
   - `performance_start_trace`, `performance_stop_trace`
   - Built-in performance metrics and analysis

3. **Device Emulation**
   - `emulate` command for device simulation
   - Network condition simulation

4. **Advanced Output Formatting**
   - Enhanced JSON/text formatting
   - Quiet and verbose modes
   - Custom output templates

### Why JavaScript Execution? (Built for Modern Development)

**This is not a workaround - it's a core design philosophy optimized for modern development workflows:**

1. **🧠 Universal Language**: JavaScript is the language of the web. Developers and AI assistants alike excel at writing JavaScript for browser automation.

2. **⚡ Rapid Prototyping**: The perfect workflow: Write JavaScript → Execute → See Results → Refine. This iterative loop is ideal for both human developers and AI assistants.

3. **🔄 Maximum Flexibility**: Any browser task, any complexity, any scenario - all through JavaScript. No waiting for specific command implementations.

4. **🤖 AI-Native Workflow**: When you ask Claude or Cursor to automate something, they naturally write JavaScript - exactly what the `eval` command executes.

5. **📚 Natural Language → Automation**: "Click the submit button" → AI generates `document.querySelector('#submit').click()` → Executes instantly.

6. **🎯 Context-Aware**: AI understands your project and can write automation scripts that fit your specific needs.

7. **⚡ Instant Iteration**: Both developers and AI can adjust scripts based on results immediately - no need to wait for feature releases.

**This tool bridges the gap between dedicated commands for common tasks and unlimited flexibility through JavaScript execution, making it perfect for both traditional development and AI-assisted workflows.**

## Form Filling & Element Interaction

The CLI now includes native commands for element interaction and form filling, designed to work seamlessly with both simple and complex automation scenarios.

### Single Field Filling

```bash
# Fill a text input
chrome-cdp-cli fill "#username" "john@example.com"

# Fill a password field
chrome-cdp-cli fill "input[type='password']" "secret123"

# Fill a textarea
chrome-cdp-cli fill "#message" "Hello, this is a test message"

# Select dropdown option (by value or text)
chrome-cdp-cli fill "#country" "US"
chrome-cdp-cli fill "#country" "United States"

# Fill without clearing existing content
chrome-cdp-cli fill "#notes" " - Additional note" --no-clear

# Fill with custom timeout
chrome-cdp-cli fill ".slow-loading-field" "value" --timeout 10000
```

### Batch Form Filling

```bash
# Fill multiple fields at once
chrome-cdp-cli fill_form --fields '[
  {"selector":"#firstName","value":"John"},
  {"selector":"#lastName","value":"Doe"},
  {"selector":"#email","value":"john.doe@example.com"},
  {"selector":"#country","value":"United States"}
]'

# Fill form from JSON file
echo '[
  {"selector":"#username","value":"testuser"},
  {"selector":"#password","value":"testpass"},
  {"selector":"#confirmPassword","value":"testpass"}
]' > login-form.json
chrome-cdp-cli fill_form --fields-file login-form.json

# Advanced options
chrome-cdp-cli fill_form --fields '[
  {"selector":"#field1","value":"value1"},
  {"selector":"#field2","value":"value2"}
]' --no-clear --timeout 15000 --stop-on-error
```

### Element Interaction

```bash
# Click elements
chrome-cdp-cli click "#submit-button"
chrome-cdp-cli click ".menu-item" --timeout 5000

# Hover over elements
chrome-cdp-cli hover "#dropdown-trigger"
chrome-cdp-cli hover ".tooltip-element" --no-wait
```

### Form Filling Options

**Single Field Options (`fill` command):**
- `--wait-for-element` / `--no-wait`: Wait for element to appear (default: true)
- `--timeout <ms>`: Timeout for waiting (default: 5000ms)
- `--clear-first` / `--no-clear`: Clear field before filling (default: true)

**Batch Form Options (`fill_form` command):**
- `--fields <json>`: JSON array of field objects
- `--fields-file <file>`: JSON file containing field array
- `--wait-for-elements` / `--no-wait`: Wait for all elements (default: true)
- `--timeout <ms>`: Timeout for each field (default: 5000ms)
- `--clear-first` / `--no-clear`: Clear all fields before filling (default: true)
- `--continue-on-error` / `--stop-on-error`: Continue if field fails (default: continue)

### Supported Form Elements

**Input Types:**
- Text inputs (`<input type="text">`)
- Email inputs (`<input type="email">`)
- Password inputs (`<input type="password">`)
- Number inputs (`<input type="number">`)
- Search inputs (`<input type="search">`)
- URL inputs (`<input type="url">`)

**Other Elements:**
- Textareas (`<textarea>`)
- Select dropdowns (`<select>`) - matches by value or text content

### Error Handling

The form filling commands include comprehensive error handling:

```bash
# Continue filling other fields if one fails (default)
chrome-cdp-cli fill_form --fields '[
  {"selector":"#valid-field","value":"works"},
  {"selector":"#invalid-field","value":"fails"},
  {"selector":"#another-field","value":"also works"}
]' --continue-on-error

# Stop on first error
chrome-cdp-cli fill_form --fields '[
  {"selector":"#field1","value":"value1"},
  {"selector":"#nonexistent","value":"value2"}
]' --stop-on-error
```

### Integration with Eval

For complex scenarios, combine native commands with eval:

```bash
# Use native commands for standard operations
chrome-cdp-cli fill "#username" "john@example.com"
chrome-cdp-cli fill "#password" "secret123"

# Use eval for complex validation or custom logic
chrome-cdp-cli eval "
// Validate form before submission
const username = document.querySelector('#username').value;
const password = document.querySelector('#password').value;
if (username && password && password.length >= 8) {
  document.querySelector('#submit').click();
  return 'Form submitted successfully';
} else {
  return 'Validation failed';
}
"
```

## Quick Reference

### Form Filling Commands

```bash
# Single field filling
chrome-cdp-cli fill "#username" "john@example.com"
chrome-cdp-cli fill "#country" "United States"  # Works with dropdowns

# Batch form filling
chrome-cdp-cli fill_form --fields '[
  {"selector":"#username","value":"john"},
  {"selector":"#password","value":"secret"}
]'

# From JSON file
chrome-cdp-cli fill_form --fields-file form-data.json
```

### Element Interaction Commands

```bash
# Click and hover
chrome-cdp-cli click "#submit-button"
chrome-cdp-cli hover ".dropdown-trigger"

# With options
chrome-cdp-cli fill "#field" "value" --timeout 10000 --no-clear
chrome-cdp-cli click "#button" --no-wait
```

### Core Commands

```bash
# JavaScript execution
chrome-cdp-cli eval "document.title"
chrome-cdp-cli eval --file script.js

# Visual capture
chrome-cdp-cli screenshot --filename page.png
chrome-cdp-cli snapshot --filename dom.txt

# Monitoring
chrome-cdp-cli console --latest
chrome-cdp-cli network

# Proxy management
chrome-cdp-cli restart
```

For detailed documentation, see the [Form Filling Guide](docs/FORM_FILLING.md).

## Configuration

The CLI supports comprehensive configuration management with multiple sources and precedence handling.

### Quick Configuration

Create a `.chrome-cdp-cli.yaml` file in your project root or home directory:

```yaml
# Basic configuration
host: localhost
port: 9222
timeout: 30000
outputFormat: text
verbose: false

# Profiles for different environments
profiles:
  development:
    debug: true
    verbose: true
  production:
    quiet: true
    outputFormat: json

# Command aliases
aliases:
  ss: screenshot
  js: eval
  health: eval "document.readyState === 'complete'"

# Command-specific defaults
commands:
  screenshot:
    defaults:
      format: png
      quality: 90
```

### Environment Variables

```bash
export CHROME_CDP_CLI_HOST=localhost
export CHROME_CDP_CLI_PORT=9222
export CHROME_CDP_CLI_TIMEOUT=30000
export CHROME_CDP_CLI_VERBOSE=true
export CHROME_CDP_CLI_PROFILE=development
```

### Configuration Precedence

Configuration values are resolved in order (highest to lowest priority):
1. **Command-line arguments** (highest)
2. **Environment variables**
3. **Configuration files** (profile-specific, then default)
4. **Default values** (lowest)

### Advanced Configuration

For comprehensive configuration options, see the [Configuration Guide](docs/CONFIGURATION.md).

## Enhanced Help System

The CLI includes a comprehensive help system with contextual assistance:

```bash
# General help with categorized commands
chrome-cdp-cli help

# Command-specific help with examples
chrome-cdp-cli help eval
chrome-cdp-cli help screenshot

# Advanced help topics
chrome-cdp-cli help topic configuration
chrome-cdp-cli help topic selectors
chrome-cdp-cli help topic automation
chrome-cdp-cli help topic debugging

# Contextual help (shown automatically on errors)
chrome-cdp-cli click "#nonexistent"  # Shows selector help
```

## Plugin System

Extend the CLI with custom commands and functionality:

```bash
# Install plugins
npm install -g chrome-cdp-cli-plugin-form-automation

# Load plugins from directory
chrome-cdp-cli --plugin-dir ./plugins custom-command

# List available plugins
chrome-cdp-cli --show-plugins
```

For plugin development, see the [Plugin Development Guide](docs/PLUGIN_DEVELOPMENT.md).

## Development

### Setup

```bash
# Clone repository
git clone https://github.com/nicoster/chrome-devtools-cli.git
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
   - Ensure Chrome is running with `--remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug`
   - **Always include `--user-data-dir`** - it's required for security (Chrome won't enable debugging port without it)
   - Check if the port is correct and not blocked by firewall
   - Verify no other Chrome instances are using the same debugging port

2. **Chrome Won't Start Debugging Port**
   - **Most common cause**: Missing `--user-data-dir` parameter
   - **Solution**: Use a dedicated profile directory: `--user-data-dir=/tmp/chrome-debug-profile`
   - **Why needed**: Chrome requires `--user-data-dir` for security - it will not enable the debugging port without it to protect your default browser profile
   - See [Chrome Remote Debugging documentation](https://developer.chrome.com/blog/remote-debugging-port) for details

3. **Command Timeout**
   - Increase timeout with `--timeout` option
   - Check if the page is responsive

4. **Element Not Found**
   - Verify CSS selectors are correct
   - Use `wait_for` command to wait for dynamic elements

5. **Permission Denied**
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
- 📝 [Form Filling Guide](docs/FORM_FILLING.md)
- 🐛 [Issue Tracker](https://github.com/nickxiao42/chrome-devtools-cli/issues)
- 💬 [Discussions](https://github.com/nickxiao42/chrome-devtools-cli/discussions)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and updates.
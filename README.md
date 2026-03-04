# CDP — Chrome DevTools Protocol CLI

A command-line tool for browser automation via Chrome DevTools Protocol. Designed for developers and AI assistants who need reliable, scriptable browser control with dedicated commands for common tasks and unlimited flexibility through JavaScript execution.

```bash
npm install -g chrome-cdp-cli
cdp eval "document.title"
```

## Why This Tool Exists

**The honest story:** I started using `chrome-devtools-mcp` like everyone else. It worked great… until it didn't. One day it just stopped working — Cursor showed 26 tools available, everything looked normal, but every tool call threw errors. Classic black box problem: you can't debug what you can't see inside.

Meanwhile, Anthropic introduced the SKILL concept, which makes much more sense for how LLMs work. And what pairs perfectly with Skills? Good old-fashioned command-line tools. They're debuggable, composable, and you can actually see what's happening when things go wrong.

**The result:** A tool that's both powerful enough for complex automation and simple enough that you (and your AI assistant) can use it without pulling your hair out.

---

## Installation

```bash
# Install globally
npm install -g chrome-cdp-cli

# Use without installing
npx chrome-cdp-cli eval "document.title"
```

After installation, both `cdp` and `chrome-cdp-cli` are available as entry points:

```bash
cdp eval "document.title"
chrome-cdp-cli eval "document.title"   # backward-compatible alias
```

---

## Prerequisites

- **Node.js** 18.0.0 or higher
- **Chrome** with remote debugging enabled

### Starting Chrome with Remote Debugging

**From Chrome 136, `--user-data-dir` is required** alongside `--remote-debugging-port`. See [Chrome's announcement](https://developer.chrome.com/blog/remote-debugging-port).

```bash
# Standard launch (use a dedicated profile directory)
chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug

# Headless
chrome --headless --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug

# macOS full path
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug &
```

---

## Quick Start

```bash
# Execute JavaScript in the browser
cdp eval "document.title"
cdp eval "window.location.href = 'https://example.com'"

# Take a screenshot (saves to file)
cdp screenshot --filename page.png

# Screenshot to stdout (pipe to another tool)
cdp screenshot | feh -

# Capture DOM snapshot
cdp dom --filename dom.txt

# Follow console logs in real time (like tail -f)
cdp log -f

# Follow network requests in real time
cdp network -f

# Element interactions
cdp click "#submit-button"
cdp fill "#email" "user@example.com"
cdp hover ".menu-item"
```

---

## Global Options

All commands accept these options, which can appear **before or after** the command name:

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--host` | `-h` | `localhost` | Chrome host |
| `--port` | `-p` | `9222` | DevTools port |
| `--format` | `-f` | `text` | Output format: `json` or `text` |
| `--timeout` | `-t` | `30000` | Command timeout (ms) |
| `--target-index` | `-i` | — | Select Chrome page by index (1-based) |
| `--verbose` | `-v` | `false` | Enable verbose logging |
| `--quiet` | `-q` | `false` | Suppress non-essential output |
| `--debug` | `-d` | `false` | Enable debug logging |
| `--config` | `-c` | — | Configuration file path |

### Selecting a Chrome Page

When multiple Chrome pages are open, CDP shows an interactive selector:

```
Select a Chrome page  (↑↓ navigate, Enter select, q quit)
──────────────────────────────────────────────────────
 ❯ [1] My App
       http://localhost:3000/
   [2] GitHub
       https://github.com/
──────────────────────────────────────────────────────
Tip: skip this prompt with  cdp -i <number> <command>
     or close other tabs until only one remains.
```

Use arrow keys to navigate, Enter to select, `q`/ESC/Ctrl+C to cancel (exits cleanly with code 0).

To skip the prompt, pass `-i` before or after the command:

```bash
cdp -i 1 eval "document.title"
cdp eval "document.title" -i 1    # also works
```

---

## Command Reference

### `eval` — JavaScript Execution

Execute any JavaScript in the browser context.

```bash
cdp eval "document.title"
cdp eval "window.location.href"
cdp eval --file script.js
cdp eval "await fetch('/api').then(r => r.json())"
cdp eval "await new Promise(r => setTimeout(r, 5000))" --timeout 10000
```

### `screenshot` — Take Screenshots

```bash
# Save to file
cdp screenshot --filename page.png
cdp screenshot --filename page.jpg --image-format jpeg --quality 85
cdp screenshot --full-page --filename fullpage.png
cdp screenshot --width 1920 --height 1080 --filename custom.png

# Output raw binary to stdout (pipe to another tool)
cdp screenshot > page.png
cdp screenshot | open -f -a Preview        # macOS
cdp screenshot | display                   # Linux (ImageMagick)
cdp -i 2 screenshot | feh -               # second tab, pipe to feh
```

> **Note:** `--image-format` controls the image encoding (`png`/`jpeg`). The global `--format` flag (`json`/`text`) does not apply to screenshot output.

> **Warning:** Running `cdp screenshot` without `--filename` in a terminal will print binary data to your terminal. The CLI detects this and shows an error instead.

### `dom` — DOM Snapshot (alias: `snapshot`)

Capture a full DOM snapshot with layout information.

```bash
cdp dom --filename dom.txt
cdp dom --filename dom.json --format json
cdp snapshot --filename dom.txt    # alias
```

### `log` — Follow Console Messages (alias: `console`)

Stream console messages in real time directly from the browser. This command runs until you press Ctrl+C.

```bash
# Follow all console messages
cdp log -f

# Filter by message type
cdp log -f --types error,warn

# Filter by text pattern (regex)
cdp log -f --text-pattern "api|fetch"

# Output as JSON
cdp log -f --format json
```

> **Note:** `log` streams events directly via CDP — no background process required. Since it follows live events, historical messages (before the command started) are not shown.

**Filter options:**

| Option | Description |
|--------|-------------|
| `--types <list>` | Comma-separated types: `log,info,warn,error,debug` |
| `--text-pattern <regex>` | Filter messages matching this pattern |

### `network` — Follow Network Requests (alias: `net`)

Stream network requests in real time directly from the browser. Runs until Ctrl+C.

```bash
# Follow all requests
cdp network -f

# Filter by HTTP method
cdp network -f --methods POST,PUT

# Filter by URL pattern (regex)
cdp network -f --url-pattern "api|graphql"

# Filter by status code
cdp network -f --status-codes 200,201,404

# Combine filters
cdp network -f --methods POST --url-pattern "/api" --status-codes 200,201

# JSON output
cdp network -f --format json
```

**Filter options:**

| Option | Description |
|--------|-------------|
| `--methods <list>` | Comma-separated HTTP methods: `GET,POST,PUT,DELETE,…` |
| `--url-pattern <regex>` | Filter URLs matching this pattern |
| `--status-codes <list>` | Comma-separated status codes: `200,404,500` |

### `click` — Click an Element

```bash
cdp click "#submit-button"
cdp click ".slow-button" --timeout 10000
cdp click "#optional" --no-wait
```

### `hover` — Hover over an Element

```bash
cdp hover "#menu-item"
cdp hover ".dropdown-trigger"
```

### `fill` — Fill a Form Field

Works with text inputs, email inputs, password inputs, textareas, and `<select>` dropdowns (matches by value or visible text).

```bash
cdp fill "#username" "john@example.com"
cdp fill "input[type='password']" "secret123"
cdp fill "#country" "United States"      # select dropdown by text
cdp fill "#country" "US"                 # select dropdown by value
cdp fill "#notes" " - extra" --no-clear  # append, don't clear first
```

### `fill_form` — Batch Form Fill

```bash
# Inline JSON
cdp fill_form --fields '[
  {"selector":"#firstName","value":"John"},
  {"selector":"#lastName","value":"Doe"},
  {"selector":"#email","value":"john@example.com"}
]'

# From JSON file
cdp fill_form --fields-file form-data.json

# Stop on first error (default: continue on error)
cdp fill_form --fields '[...]' --stop-on-error
```

### `drag` — Drag and Drop

```bash
cdp drag "#draggable-item" "#drop-zone"
cdp drag ".file-item" ".upload-area" --timeout 10000
```

### `press_key` — Keyboard Input

```bash
cdp press_key "Enter"
cdp press_key "Escape"
cdp press_key "Tab"
cdp press_key "a" --modifiers Ctrl          # Ctrl+A
cdp press_key "s" --modifiers Ctrl          # Ctrl+S
cdp press_key "c" --modifiers Ctrl,Shift    # Ctrl+Shift+C
cdp press_key "ArrowDown" --selector "#dropdown"
```

### `upload_file` — File Upload

```bash
cdp upload_file "input[type='file']" "./document.pdf"
cdp upload_file "#file-input" "/path/to/image.jpg"
```

### `wait_for` — Wait for Element State

```bash
cdp wait_for "#loading-spinner"              # exists
cdp wait_for "#modal" --condition visible
cdp wait_for "#loading" --condition hidden
cdp wait_for "#submit-btn" --condition enabled
cdp wait_for "#processing" --condition disabled
cdp wait_for "#slow-element" --timeout 30000
```

### `handle_dialog` — Handle Browser Dialogs

```bash
cdp handle_dialog accept
cdp handle_dialog dismiss
cdp handle_dialog accept --text "John Doe"   # prompt with text
cdp handle_dialog accept --timeout 10000
```

### `install_cursor_command` — Install Cursor Integration

```bash
cdp install_cursor_command
cdp install_cursor_command --force
cdp install_cursor_command --target-directory /custom/.cursor/commands
```

### `install_claude_skill` — Install Claude Skill

```bash
cdp install_claude_skill                              # project scope
cdp install_claude_skill --skill-type personal        # user home scope
cdp install_claude_skill --include-examples --include-references
```

---

## The Power of `eval`

`eval` is the most powerful command — it runs any JavaScript in the browser, making virtually any automation task possible without waiting for dedicated command implementations.

```bash
# Navigation
cdp eval "window.location.href = 'https://example.com'"
cdp eval "window.history.back()"
cdp eval "window.location.reload()"

# Content extraction
cdp eval "document.title"
cdp eval "Array.from(document.querySelectorAll('a')).map(a => a.href)"
cdp eval "Array.from(document.querySelectorAll('.product')).map(p => ({
  name: p.querySelector('.name').textContent,
  price: p.querySelector('.price').textContent
}))"

# Wait for dynamic content
cdp eval "new Promise(resolve => {
  const check = () => {
    const el = document.querySelector('#dynamic-content');
    if (el) resolve(el.textContent);
    else setTimeout(check, 100);
  };
  check();
})"

# Make HTTP requests from browser context
cdp eval "fetch('/api/data').then(r => r.json())"
cdp eval "fetch('/api/users', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({name: 'John'})
}).then(r => r.json())"

# Performance data
cdp eval "performance.getEntriesByType('navigation')"
cdp eval "performance.getEntriesByType('resource').length"

# Browser info
cdp eval "navigator.userAgent"
cdp eval "{width: window.innerWidth, height: window.innerHeight}"
```

---

## Configuration

### Config File

Create `.chrome-cdp-cli.yaml` in your project root or home directory:

```yaml
host: localhost
port: 9222
timeout: 30000
outputFormat: text
verbose: false

profiles:
  development:
    debug: true
    verbose: true
  production:
    quiet: true
    outputFormat: json

aliases:
  ss: screenshot
  js: eval
```

### Environment Variables

```bash
export CHROME_CDP_CLI_HOST=localhost
export CHROME_CDP_CLI_PORT=9222
export CHROME_CDP_CLI_TIMEOUT=30000
export CHROME_CDP_CLI_VERBOSE=true
```

### Precedence

1. Command-line arguments (highest)
2. Environment variables
3. Config file values
4. Built-in defaults (lowest)

---

## Help System

```bash
cdp help                        # all commands, categorized
cdp help eval                   # command-specific help with examples
cdp help screenshot
cdp help log
cdp help network
cdp help topic configuration
cdp help topic selectors
cdp help topic automation
```

---

## Scripting & Automation

### Shell Pipelines

```bash
# Screenshot to file via redirect
cdp screenshot > page.png

# Get page title as plain text
cdp eval "document.title" --format text

# Extract data as JSON for processing
cdp eval "Array.from(document.links).map(l => l.href)" --format json | jq '.[]'

# Capture logs from a specific tab
cdp -i 2 log -f --types error 2>&1 | tee errors.log
```

### Scripting with Multiple Commands

```bash
#!/bin/bash
# Navigate and capture
cdp eval "window.location.href = 'https://example.com'"
sleep 1
cdp screenshot --filename after-nav.png
cdp dom --filename after-nav.txt
```

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success (including user-cancelled interactive selector) |
| `1` | General error |
| `3` | Chrome connection error |
| `8` | Invalid arguments |

---

## Troubleshooting

### Chrome Won't Enable Remote Debugging

**Most common cause:** missing `--user-data-dir`.

```bash
# Wrong (Chrome 136+ will ignore this)
chrome --remote-debugging-port=9222

# Correct
chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug
```

See [Chrome's announcement](https://developer.chrome.com/blog/remote-debugging-port) for details.

### Connection Refused

- Verify Chrome is running with the correct flags
- Check the port matches (`--port` option, default 9222)
- Ensure no firewall is blocking the port

### Multiple Pages / Tab Selector Appears

If you have multiple Chrome tabs open, CDP shows an interactive selector. To avoid it:

```bash
cdp -i 1 eval "document.title"   # select tab by index
```

Or close unneeded tabs, leaving only the one you want to automate.

### Command Timeout

```bash
cdp eval "await longOperation()" --timeout 60000
```

### Element Not Found

```bash
cdp wait_for "#dynamic-element" --timeout 10000
cdp click "#dynamic-element"
```

### Debug Mode

```bash
cdp --debug eval "document.title"
cdp --verbose screenshot --filename page.png
```

---

## Development

```bash
git clone https://github.com/nicoster/chrome-devtools-cli.git
cd chrome-devtools-cli
npm install

# Development run
npm run dev -- eval "document.title"

# Build
npm run build         # development (with source maps)
npm run build:prod    # production (optimized)
npm run build:watch   # watch mode

# Test
npm test
npm run test:watch
npm run test:ci       # CI mode with coverage

# Lint
npm run lint
npm run lint:fix

# Verify everything
npm run verify
```

### Project Structure

```
chrome-devtools-cli/
├── src/
│   ├── cli/              # ArgumentParser, CommandRouter, HelpSystem, CLIApplication
│   ├── client/           # CDP client
│   ├── connection/       # Connection management & target discovery
│   ├── handlers/         # One file per command
│   ├── monitors/         # ConsoleMonitor, NetworkMonitor (real-time event streams)
│   ├── proxy/            # Background proxy server (used by IDE integrations)
│   ├── config/           # Configuration management
│   └── index.ts          # Entry point
├── dist/                 # Compiled output
└── package.json
```

---

## Changelog

### v2.1.0

- **`cdp` alias**: `cdp` is now the primary command name (`chrome-cdp-cli` still works)
- **`log` command**: renamed from `console` (`console` kept as alias); follow-only real-time streaming via CDP, no background proxy required
- **`network` command**: follow-only real-time streaming; filter flags (`--methods`, `--url-pattern`, `--status-codes`) are now top-level instead of nested under `--filter`
- **`dom` command**: renamed from `snapshot` (`snapshot` kept as alias)
- **`screenshot` binary output**: omit `--filename` to write raw PNG/JPEG bytes to stdout for piping; `--format` renamed to `--image-format` to avoid conflict with the global `--format`
- **Interactive target selector**: when multiple Chrome pages are open, an arrow-key menu lets you pick one; pass `-i <n>` to skip it
- **`-i` global option**: `--target-index` / `-i` now works before or after the command name
- **Removed `restart` command**: proxy-based log collection has been removed entirely
- **Better error messages**: connection errors now include the `--user-data-dir` tip and a link to Chrome's announcement

### v2.0.x

- Enhanced argument parser with schema validation
- Comprehensive help system with contextual assistance
- Configuration management with YAML/JSON support and profiles
- Standardized output formatting (JSON/text)
- Full element interaction suite: click, hover, fill, drag, press_key, upload_file, wait_for, handle_dialog
- Batch form filling with `fill_form`
- IDE integrations: Cursor commands, Claude skills

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Add tests for your changes
4. Run `npm run verify`
5. Commit and open a pull request

## License

MIT — see [LICENSE](LICENSE).

## Support

- [Issue Tracker](https://github.com/nicoster/chrome-devtools-cli/issues)
- [Discussions](https://github.com/nicoster/chrome-devtools-cli/discussions)

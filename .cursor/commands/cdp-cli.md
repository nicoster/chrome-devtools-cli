# Chrome DevTools Protocol CLI Tool

Control Chrome browser through Chrome DevTools Protocol for browser automation.

## Available Commands

### JavaScript Execution
- **eval** - Execute JavaScript code and return results
  `chrome-cdp-cli eval "document.title"`
  `chrome-cdp-cli eval "fetch('/api/data').then(r => r.json())"`

### Screenshots and Snapshots
- **screenshot** - Capture page screenshot
  `chrome-cdp-cli screenshot --filename page.png`
  `chrome-cdp-cli screenshot --filename fullpage.png --full-page`

- **snapshot** - Capture complete DOM snapshot
  `chrome-cdp-cli snapshot`
  `chrome-cdp-cli snapshot --filename dom-snapshot.txt`

### Element Interaction
- **click** - Click page elements
  `chrome-cdp-cli click "#submit-button"`
  `chrome-cdp-cli click ".menu-item" --timeout 10000`

- **hover** - Mouse hover over elements
  `chrome-cdp-cli hover "#dropdown-trigger"`

- **fill** - Fill form fields
  `chrome-cdp-cli fill "#username" "john@example.com"`
  `chrome-cdp-cli fill "input[name='password']" "secret123"`

- **fill_form** - Batch fill forms
  `chrome-cdp-cli fill_form '{"#username": "john", "#password": "secret"}'`

### Advanced Interactions
- **drag** - Drag and drop operations
  `chrome-cdp-cli drag "#draggable" "#dropzone"`

- **press_key** - Simulate keyboard input
  `chrome-cdp-cli press_key "Enter"`
  `chrome-cdp-cli press_key "a" --modifiers Ctrl --selector "#input"`

- **upload_file** - File upload
  `chrome-cdp-cli upload_file "input[type='file']" "./document.pdf"`

- **wait_for** - Wait for elements to appear or meet conditions
  `chrome-cdp-cli wait_for "#loading" --condition hidden`
  `chrome-cdp-cli wait_for "#submit-btn" --condition enabled`

- **handle_dialog** - Handle browser dialogs
  `chrome-cdp-cli handle_dialog accept`
  `chrome-cdp-cli handle_dialog accept --text "user input"`

### Monitoring
- **console** - List console messages or get latest
  `chrome-cdp-cli console --latest`
  `chrome-cdp-cli console --types error`

- **network** - List network requests or get latest
  `chrome-cdp-cli network --latest`
  `chrome-cdp-cli network --filter '{"methods":["POST"]}'`

## Common Options

- `--host <hostname>`: Chrome DevTools host (default: localhost)
- `--port <number>`: Chrome DevTools port (default: 9222)
- `--timeout <ms>`: Command timeout

## Common Workflows

### Form Testing
```bash
chrome-cdp-cli wait_for "#login-form" --condition visible
chrome-cdp-cli fill "#email" "test@example.com"
chrome-cdp-cli fill "#password" "password123"
chrome-cdp-cli click "#submit-button"
chrome-cdp-cli wait_for "#success-message" --condition visible
chrome-cdp-cli screenshot --filename login-success.png
chrome-cdp-cli console --types error
```

### File Upload
```bash
chrome-cdp-cli click "#upload-trigger"
chrome-cdp-cli upload_file "input[type='file']" "./test-document.pdf"
chrome-cdp-cli wait_for ".upload-success" --condition visible
chrome-cdp-cli eval "document.querySelector('.file-name').textContent"
```

### Drag and Drop
```bash
chrome-cdp-cli wait_for "#draggable-item" --condition visible
chrome-cdp-cli wait_for "#drop-zone" --condition visible
chrome-cdp-cli drag "#draggable-item" "#drop-zone"
chrome-cdp-cli eval "document.querySelector('#drop-zone').children.length"
```

### Keyboard Input
```bash
chrome-cdp-cli click "#search-input"
chrome-cdp-cli press_key "t"
chrome-cdp-cli press_key "e"
chrome-cdp-cli press_key "s"
chrome-cdp-cli press_key "t"
chrome-cdp-cli press_key "a" --modifiers Ctrl
chrome-cdp-cli press_key "Enter"
chrome-cdp-cli handle_dialog accept
```

## Usage Examples

- chrome-cdp-cli eval "document.title"
- chrome-cdp-cli screenshot --filename page.png
- chrome-cdp-cli click "#submit-button"
- chrome-cdp-cli fill "#username" "test@example.com"
- chrome-cdp-cli drag "#item" "#target"
- chrome-cdp-cli press_key "Enter"
- chrome-cdp-cli upload_file "input[type=file]" "./doc.pdf"
- chrome-cdp-cli wait_for "#loading" --condition hidden
- chrome-cdp-cli handle_dialog accept
- chrome-cdp-cli console --latest
- chrome-cdp-cli network

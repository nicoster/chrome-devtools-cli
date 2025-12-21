# Chrome DevTools CLI

A command-line tool for controlling Chrome browser instances via the Chrome DevTools Protocol (CDP).

## Features

- Connect to Chrome instances via DevTools Protocol
- Execute JavaScript in browser context
- Manage pages and tabs
- Capture screenshots and HTML content
- Monitor console messages and network requests
- Performance analysis and profiling
- Device and browser emulation
- Flexible output formats (JSON/text)

## Installation

```bash
npm install
npm run build
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Run tests with coverage
npm test:coverage

# Build for production
npm run build

# Lint code
npm run lint
```

## Usage

```bash
# Connect to Chrome and execute JavaScript
chrome-cli evaluate_script "console.log('Hello World')"

# Navigate to a URL
chrome-cli navigate_page "https://example.com"

# Take a screenshot
chrome-cli take_screenshot --output screenshot.png

# Get help
chrome-cli --help
```

## Requirements

- Node.js 18+
- Chrome browser with DevTools enabled
- Start Chrome with: `chrome --remote-debugging-port=9222`

## Project Structure

```
src/
├── types/          # TypeScript type definitions
├── interfaces/     # Interface definitions
├── utils/          # Utility functions
├── test/           # Test setup and utilities
└── index.ts        # Main entry point
```

## Testing

This project uses Jest for unit testing and fast-check for property-based testing.

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm test:coverage
```

## License

MIT
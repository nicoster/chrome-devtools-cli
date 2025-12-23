# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.7.4] - 2024-12-23

### Fixed
- **npm Registry**: Force refresh of README.md display on npm website
  - Previous version 1.7.3 had updated README but npm registry was showing cached old version
  - This patch version ensures the new README content is properly displayed

## [1.7.3] - 2024-12-23

### Enhanced
- **Documentation**: Rewrote README.md with improved messaging and clearer positioning
  - Added honest "Why This Tool Exists" section explaining the motivation behind the project
  - Removed excessive "eval-first" emphasis in favor of balanced approach
  - Repositioned as a tool for modern development (both human and AI-assisted)
  - Improved tone with natural, humorous English while maintaining technical accuracy
  - Better explanation of JavaScript execution as a feature, not a workaround

### Changed
- **Package Description**: Updated to reflect balanced approach between dedicated commands and flexible JavaScript execution
- **Messaging**: Shifted from "LLM-first" to "developer and AI assistant friendly"
- **Positioning**: Emphasized reliability, debuggability, and practical automation over theoretical AI optimization

## [1.7.2] - 2024-12-23

### Enhanced
- **Installation Experience**: Added postinstall script with welcome message and quick start guide
  - Users now see installation success confirmation with emoji indicators
  - Includes essential quick start steps (Chrome setup, first command, help)
  - Provides GitHub repository link for additional documentation
  - Improves first-time user experience with clear next steps

### Changed
- **User Experience**: Enhanced npm install output with helpful information
  - Clear visual confirmation of successful installation
  - Immediate guidance on how to get started
  - Reduces friction for new users getting started with the CLI

## [1.7.1] - 2024-12-23

### Enhanced
- **Internationalization**: Converted all Cursor commands content to English
  - Updated `InstallCursorCommandHandler.generateCursorCommands()` function to return pure English text
  - Translated all command descriptions, instructions, and examples from Chinese to English
  - Updated `CURSOR_COMMANDS.md` documentation to English
  - Improved accessibility for international developers using Cursor IDE integration

### Changed
- **Documentation**: All generated Cursor command files now use English language
  - Command descriptions and workflow examples are now in English
  - Maintains all technical functionality while improving international usability

## [1.7.0] - 2024-12-23

### Fixed
- **Critical Fix**: Resolved eval command timeout issues by changing default proxy usage strategy
  - `EvaluateScriptHandler` now defaults to `useProxy = false` for direct CDP connection
  - Eliminates timeout issues that occurred with HTTP-based command execution through proxy
  - Maintains proxy usage for console/network monitoring commands that benefit from historical data
  - Provides faster, more reliable JavaScript execution for eval commands

### Enhanced
- **Proxy Usage Strategy**: Optimized proxy usage for better performance and reliability
  - Only console messages and network requests use proxy server (for historical data)
  - All other features (eval, click, fill, etc.) connect directly to CDP/Chrome
  - Simplified architecture reduces complexity and improves response times
  - Maintains backward compatibility with existing functionality

### Added
- **Comprehensive Test Suite**: Added extensive CLI command testing
  - `test-cli-quick.js` - Quick basic functionality verification
  - `test-cli-extended.js` - Extended functionality with file operations
  - `test-cli-commands.js` - Comprehensive test with timeout handling
  - `test-cli-final.js` - Final comprehensive test with proper error handling
  - 95.5% test success rate across all CLI commands
  - Automated verification of all major command categories

### Technical Details
- Modified `EvaluateScriptHandler` constructor to default `useProxy = false`
- Updated proxy strategy documentation and implementation
- Comprehensive test coverage for all CLI subcommands
- Verified functionality across JavaScript evaluation, file operations, DOM interaction, and monitoring

## [1.6.0] - 2024-12-23

### Added
- **Persistent Connection Proxy Server**: Revolutionary proxy architecture for maintaining persistent Chrome connections
  - Automatic proxy server startup and management via ProxyManager
  - Persistent connection pooling with automatic reconnection
  - Historical data capture for console messages and network requests
  - WebSocket proxy for real-time CDP command forwarding
  - RESTful API for data retrieval with comprehensive filtering
  - Health monitoring and connection status tracking
  - Security features including rate limiting and request validation
  - Performance monitoring with metrics collection
  - File system security with path validation and access controls

- **Enhanced Console and Network Monitoring**: 
  - Historical console message access from connection establishment
  - Network request history with full request/response capture
  - Advanced filtering by type, pattern, time range, and more
  - Proxy-first approach with automatic fallback to direct CDP
  - Comprehensive message storage and retrieval system

- **Proxy Integration**:
  - Seamless integration with existing CLI commands
  - Automatic proxy detection and usage
  - Graceful fallback to direct CDP when proxy unavailable
  - Enhanced `list_console_messages` and `list_network_requests` commands
  - Real-time data streaming via WebSocket connections

### Enhanced
- **Architecture**: Dual-mode operation (proxy + direct CDP) for maximum reliability
- **Data Persistence**: Historical data access beyond session boundaries  
- **Performance**: Optimized connection management and data retrieval
- **Security**: Comprehensive security measures for proxy operations
- **Testing**: Complete test coverage including integration tests and property-based testing
- **Documentation**: Extensive documentation for proxy architecture and usage

### Fixed
- **Test Suite**: Fixed ListConsoleMessagesHandler tests with proper proxy mocking
- **Connection Management**: Improved connection stability and error handling
- **Memory Management**: Optimized message storage with automatic cleanup

### Technical Details
- Express.js-based proxy server with WebSocket support
- Connection pooling with automatic lifecycle management
- Message store with efficient filtering and pagination
- Security manager with comprehensive validation
- Performance monitoring with detailed metrics
- File system security with sandboxed access controls
- Comprehensive error handling and logging throughout proxy system

## [1.2.5] - 2024-12-21

### Added
- **Form Filling Commands**: Native form filling functionality with comprehensive options
  - `fill` command for single form field filling with CSS selector support
  - `fill_form` command for batch form filling with JSON input
  - Support for input, textarea, and select elements
  - Automatic event triggering (input/change events)
  - Element waiting with configurable timeouts
  - Clear-before-fill option (configurable)
  - Continue-on-error vs stop-on-error modes for batch operations
  - Comprehensive error handling and detailed result reporting

- **Element Interaction Commands**: Native element interaction capabilities
  - `click` command for clicking elements with CSS selectors
  - `hover` command for hovering over elements
  - CDP-first approach with JavaScript eval fallback
  - Element waiting and timeout handling
  - Automatic scrolling into view

### Enhanced
- **CLI Interface**: Updated command registration to include new form filling handlers
- **Help System**: Comprehensive help text for all new commands with examples
- **Documentation**: Updated README with detailed form filling examples and usage patterns
- **Testing**: Complete test coverage for all new form filling functionality
  - Unit tests for individual handlers
  - Integration tests for batch operations
  - Error handling and edge case testing

### Technical Details
- Dual implementation approach: CDP DOM.querySelector + Runtime.callFunctionOn with eval fallback
- Smart select element handling: matches by value first, then by text content
- Proper event simulation for form validation compatibility
- TypeScript interfaces for all new command arguments
- Comprehensive input validation and error messages

## [1.0.0] - 2024-01-XX

### Added
- Initial release of Chrome DevTools CLI
- Core CDP client implementation with WebSocket connection management
- JavaScript execution with full async/await support
- Page and tab management (navigate, create, close, list, select)
- Element interaction (click, hover, fill forms, drag & drop)
- Visual capture (screenshots, HTML content)
- Console and network monitoring
- Performance analysis and profiling
- Device and browser emulation
- Flexible CLI interface with JSON and text output formats
- Comprehensive error handling and connection recovery
- Property-based testing with fast-check
- Full TypeScript support with type definitions
- Extensive documentation and examples

### Features
- **Connection Management**: Auto-discovery of Chrome instances, reconnection with exponential backoff
- **Command System**: Extensible command handler architecture
- **Output Formatting**: JSON and human-readable text formats
- **Configuration**: File-based and environment variable configuration
- **Testing**: Unit tests and property-based tests for reliability
- **Build System**: Development and production build configurations
- **Packaging**: NPM package with executable binary

### Technical Details
- Built with TypeScript for type safety
- Uses Jest for unit testing and fast-check for property-based testing
- WebSocket-based communication with Chrome DevTools Protocol
- Commander.js for CLI argument parsing
- Comprehensive error handling and logging
- Cross-platform compatibility (Windows, macOS, Linux)

## [Unreleased]

### Planned
- Plugin system for custom commands
- Configuration file validation
- Interactive mode for command sequences
- Batch command execution
- Enhanced device emulation presets
- Performance optimization recommendations
- Integration with popular testing frameworks
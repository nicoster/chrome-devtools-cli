import { ICommandHandler } from '../interfaces/CommandHandler';
import { CommandResult, CDPClient } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../utils/logger';

interface ClaudeSkillConfig {
  name: string;
  description: string;
  instructions: string;
  allowedTools?: string[];
}

interface InstallClaudeSkillArgs {
  skillType?: 'personal' | 'project';
  targetDirectory?: string;
  includeExamples?: boolean;
  includeReferences?: boolean;
  force?: boolean;
}

export class InstallClaudeSkillHandler implements ICommandHandler {
  name = 'install_claude_skill';

  async execute(_client: CDPClient, args: InstallClaudeSkillArgs): Promise<CommandResult> {
    try {
      const skillType = args.skillType || 'project';
      const targetDir = args.targetDirectory || this.getDefaultSkillDirectory(skillType);
      const skillDir = path.join(targetDir, 'cdp-cli');
      
      // 检查是否在合适的目录
      if (!args.targetDirectory && !args.force) {
        if (skillType === 'project') {
          const claudeDirExists = await this.checkDirectoryExists('.claude');
          if (!claudeDirExists) {
            return {
              success: false,
              error: `Warning: No .claude directory found in current directory. This may not be a project root directory.

To install Claude skills:
1. Navigate to your project root directory (where .claude folder should be), or
2. Use --skill-type personal to install to your home directory, or  
3. Use --target-directory to specify a custom location, or
4. Use --force to install anyway

Examples:
  chrome-cdp-cli install-claude-skill --skill-type personal
  chrome-cdp-cli install-claude-skill --target-directory /path/to/.claude/skills
  chrome-cdp-cli install-claude-skill --force`
            };
          }
        }
      }
      
      // 确保技能目录存在 - 改进逻辑以检查 .claude/skills 路径
      await this.ensureSkillDirectoryPath(targetDir, skillDir);
      
      // 生成 SKILL.md
      const skillConfig = this.generateClaudeSkill();
      const skillPath = path.join(skillDir, 'SKILL.md');
      await fs.writeFile(skillPath, this.generateSkillMarkdown(skillConfig), 'utf8');
      logger.info(`Created Claude skill: ${skillPath}`);
      
      const createdFiles = ['SKILL.md'];
      
      // 生成可选文件
      if (args.includeExamples) {
        const examplesPath = path.join(skillDir, 'examples.md');
        await fs.writeFile(examplesPath, this.generateExamplesMarkdown(), 'utf8');
        createdFiles.push('examples.md');
        logger.info(`Created examples file: ${examplesPath}`);
      }
      
      if (args.includeReferences) {
        const referencePath = path.join(skillDir, 'reference.md');
        await fs.writeFile(referencePath, this.generateReferenceMarkdown(), 'utf8');
        createdFiles.push('reference.md');
        logger.info(`Created reference file: ${referencePath}`);
      }
      
      return {
        success: true,
        data: {
          skillType,
          directory: skillDir,
          files: createdFiles,
          skillName: skillConfig.name
        }
      };
    } catch (error) {
      logger.error('Failed to install Claude skill:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private async checkDirectoryExists(dirPath: string): Promise<boolean> {
    try {
      await fs.access(dirPath);
      return true;
    } catch {
      return false;
    }
  }

  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
      logger.info(`Created directory: ${dirPath}`);
    }
  }

  private async ensureSkillDirectoryPath(targetDir: string, skillDir: string): Promise<void> {
    // 检查路径是否包含 .claude/skills
    if (targetDir.includes('.claude/skills') || targetDir.endsWith('.claude/skills')) {
      // 确保 .claude 目录存在
      const claudeDir = targetDir.includes('.claude/skills') 
        ? targetDir.substring(0, targetDir.indexOf('.claude') + 7)  // 包含 .claude
        : path.dirname(targetDir);
      
      await this.ensureDirectory(claudeDir);
      
      // 确保 skills 子目录存在
      const skillsDir = path.join(claudeDir, 'skills');
      await this.ensureDirectory(skillsDir);
      
      // 确保具体技能目录存在
      await this.ensureDirectory(skillDir);
    } else {
      // 对于自定义路径，直接创建整个路径
      await this.ensureDirectory(skillDir);
    }
  }

  private getDefaultSkillDirectory(skillType: 'personal' | 'project'): string {
    return skillType === 'personal' 
      ? path.join(os.homedir(), '.claude', 'skills')
      : '.claude/skills';
  }

  private generateClaudeSkill(): ClaudeSkillConfig {
    return {
      name: 'cdp-cli-enhanced',
      description: 'Advanced Chrome browser automation using enhanced DevTools CLI v2.0 with configuration management, error handling, contextual help, and comprehensive testing workflows. Use for complex web automation, testing, form handling, performance monitoring, and CI/CD integration.',
      instructions: `# Enhanced Chrome Browser Automation

## Instructions
Use this skill when the user needs advanced browser automation with:
- Configuration-driven workflows with profiles and aliases
- Enhanced error handling with contextual help and recovery
- Comprehensive testing with evidence capture
- Performance monitoring and metrics collection
- CI/CD integration with structured reporting
- Plugin-based extensibility for custom commands

## Enhanced CLI Features (v2.0)

### Configuration Management
Use YAML/JSON configuration files with profiles for different environments:

\`\`\`yaml
# .chrome-cdp-cli.yaml
profiles:
  development:
    host: localhost
    port: 9222
    debug: true
    verbose: true
  
  testing:
    host: test-chrome
    port: 9223
    quiet: true
    outputFormat: json
  
  production:
    host: prod-chrome
    port: 9222
    quiet: true
    timeout: 60000

aliases:
  health-check: eval "document.readyState === 'complete'"
  capture-evidence: screenshot --filename evidence-$(date +%s).png
  check-console: console --types error

commands:
  screenshot:
    defaults:
      format: png
      quality: 95
      fullPage: true
\`\`\`

### Enhanced Global Options
- \`--profile <name>\`: Use configuration profile
- \`--config <path>\`: Specify configuration file
- \`--debug\`: Enable debug mode with detailed logging
- \`--verbose\`: Enable verbose output with timing
- \`--quiet\`: Silent mode for CI/CD
- \`--format <json|text|yaml>\`: Enhanced output formats
- \`--help topic <topic>\`: Get contextual help on topics

### Advanced Error Handling
The CLI provides contextual help and suggestions when commands fail:

\`\`\`bash
# Automatic contextual help on errors
chrome-cdp-cli click "#nonexistent-element"
# Shows: selector validation tips, alternatives, related help topics

# Debug mode for detailed error information
chrome-cdp-cli --debug --verbose click "#problematic-element"
# Shows: execution logs, CDP messages, timing information
\`\`\`

## Complete Command Reference

### JavaScript Execution
- **eval**: Execute JavaScript code with enhanced error handling
  \`chrome-cdp-cli --profile development eval "document.title"\`
  \`chrome-cdp-cli --format json eval "performance.timing"\`
  \`chrome-cdp-cli eval --file automation-script.js\`

### Visual Capture with Enhanced Options
- **screenshot**: Advanced screenshot capture
  \`chrome-cdp-cli --profile testing screenshot --filename test-result.png\`
  \`chrome-cdp-cli screenshot --full-page --format jpeg --quality 90\`
- **snapshot**: Complete DOM snapshots with metadata
  \`chrome-cdp-cli --format json snapshot --filename dom-analysis.json\`

### Enhanced Element Interaction
- **click**: Click with retry and error recovery
  \`chrome-cdp-cli --debug click "#submit-button"\`
  \`chrome-cdp-cli click ".slow-loading-button" --timeout 15000\`
- **hover**: Hover with timing control
  \`chrome-cdp-cli hover "#dropdown-trigger" --timeout 5000\`
- **fill**: Form filling with validation
  \`chrome-cdp-cli fill "#username" "john@example.com" --no-clear\`
- **fill_form**: Batch form operations with error handling
  \`chrome-cdp-cli fill_form --fields-file form-data.json --continue-on-error\`

### Advanced Interactions
- **drag**: Enhanced drag and drop
  \`chrome-cdp-cli --verbose drag "#draggable" "#dropzone"\`
- **press_key**: Keyboard simulation with element targeting
  \`chrome-cdp-cli press_key "Enter" --selector "#search-input"\`
  \`chrome-cdp-cli press_key "s" --modifiers Ctrl,Shift\`
- **upload_file**: File upload with validation
  \`chrome-cdp-cli upload_file "input[type='file']" "./document.pdf"\`
- **wait_for**: Advanced waiting with conditions
  \`chrome-cdp-cli wait_for "#loading" --condition hidden --timeout 30000\`
  \`chrome-cdp-cli wait_for "#submit-btn" --condition enabled\`
- **handle_dialog**: Dialog handling with text input
  \`chrome-cdp-cli handle_dialog accept --text "confirmation text"\`

### Enhanced Monitoring
- **console**: Console monitoring with filtering
  \`chrome-cdp-cli --format json console --latest\`
  \`chrome-cdp-cli console --types error,warn\`
- **network**: Network monitoring with filters
  \`chrome-cdp-cli --format json network --latest\`
  \`chrome-cdp-cli network --filter '{"methods":["POST"],"statusCodes":[200,201]}'\`

### Help System
- **help**: Comprehensive help with topics
  \`chrome-cdp-cli help\` - General help with categorized commands
  \`chrome-cdp-cli help eval\` - Command-specific help with examples
  \`chrome-cdp-cli help topic configuration\` - Configuration management
  \`chrome-cdp-cli help topic selectors\` - CSS selector guide
  \`chrome-cdp-cli help topic automation\` - Best practices
  \`chrome-cdp-cli help topic debugging\` - Troubleshooting guide

## Enhanced Automation Workflows

### Configuration-Driven Testing
\`\`\`bash
# Load testing profile
chrome-cdp-cli --profile testing --config test-config.yaml

# Execute test suite with error recovery
chrome-cdp-cli eval --file test-suite.js || {
  echo "Test failed, capturing evidence..."
  chrome-cdp-cli capture-evidence
  chrome-cdp-cli check-console
  exit 1
}

# Generate structured report
chrome-cdp-cli --format json eval "generateTestReport()" > test-results.json
\`\`\`

### Performance Monitoring Workflow
\`\`\`bash
# Set up performance monitoring
chrome-cdp-cli --profile performance --verbose

# Navigate and collect metrics
chrome-cdp-cli eval "window.location.href = 'https://example.com'"
chrome-cdp-cli wait_for "#main-content" --timeout 30000

# Collect comprehensive performance data
chrome-cdp-cli --format json eval "
  const timing = performance.timing;
  const navigation = performance.getEntriesByType('navigation')[0];
  const resources = performance.getEntriesByType('resource');
  
  return {
    loadTime: timing.loadEventEnd - timing.navigationStart,
    domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
    firstPaint: navigation.loadEventEnd,
    resourceCount: resources.length,
    resourceSizes: resources.map(r => ({name: r.name, size: r.transferSize}))
  };
" > performance-metrics.json
\`\`\`

### Advanced Form Testing
\`\`\`bash
# Configure for form testing
chrome-cdp-cli --profile development --debug

# Batch form filling with comprehensive error handling
chrome-cdp-cli fill_form --fields-file form-test-data.json --continue-on-error --timeout 15000

# Validate form submission with evidence capture
chrome-cdp-cli click "#submit-button"
chrome-cdp-cli wait_for ".success-message, .error-message" --timeout 10000

# Capture validation results
chrome-cdp-cli --format json eval "
  const form = document.querySelector('#test-form');
  const errors = Array.from(form.querySelectorAll('.error')).map(e => e.textContent);
  const success = document.querySelector('.success-message');
  return { 
    errors, 
    success: !!success, 
    timestamp: new Date().toISOString(),
    formData: new FormData(form)
  };
" > validation-results.json
\`\`\`

### CI/CD Integration
\`\`\`bash
# Headless Chrome setup for CI
chrome --headless --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-ci &

# Execute tests with CI profile
chrome-cdp-cli --profile ci --quiet eval --file ci-test-suite.js

# Generate JUnit-compatible reports
chrome-cdp-cli --format json eval "generateJUnitReport()" > test-results.xml

# Capture evidence on failures
if [ $? -ne 0 ]; then
  chrome-cdp-cli screenshot --filename failure-evidence.png
  chrome-cdp-cli console --types error > console-errors.json
fi
\`\`\`

## Enhanced Prerequisites

### Chrome Setup with Security
\`\`\`bash
# Always use --user-data-dir for security (required)
chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug

# Headless mode for CI/CD
chrome --headless --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-ci

# With additional automation flags
chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug --no-first-run --no-default-browser-check
\`\`\`

### Configuration File Setup
Create \`.chrome-cdp-cli.yaml\` in your project root with appropriate profiles for your environments.

## Documentation and Support

### Available Help Topics
- \`configuration\` - YAML configuration, profiles, environment setup
- \`selectors\` - CSS selector guide and best practices
- \`automation\` - Browser automation workflows and patterns
- \`debugging\` - Troubleshooting and error resolution
- \`scripting\` - Integration with scripts and CI/CD
- \`performance\` - Performance monitoring and optimization

### Contextual Help
Commands automatically provide contextual help when they fail, including:
- Specific error analysis and suggestions
- Alternative approaches and workarounds
- Related commands and help topics
- Configuration recommendations

### Plugin System
Extend functionality with plugins:
\`chrome-cdp-cli --plugin-dir ./plugins custom-command\`

For comprehensive documentation, see:
- Configuration Guide: docs/CONFIGURATION.md
- Plugin Development: docs/PLUGIN_DEVELOPMENT.md
- Advanced Help Topics: \`chrome-cdp-cli help topic <topic>\`
- \`--verbose\`: Enable detailed logging
- \`--timeout <ms>\`: Operation timeout`,
      allowedTools: ['Execute', 'Read', 'Write']
    };
  }

  private generateSkillMarkdown(skill: ClaudeSkillConfig): string {
    const frontmatter = `---
name: ${skill.name}
description: ${skill.description}
version: 2.0.0
category: browser-automation
tools: [chrome-cdp-cli]
${skill.allowedTools ? `allowedTools: [${skill.allowedTools.map(t => `"${t}"`).join(', ')}]` : ''}
---

`;
    
    return frontmatter + skill.instructions;
  }

  private generateExamplesMarkdown(): string {
    return `# Chrome Automation Examples

## JavaScript Execution

### Get Page Information
\`\`\`bash
chrome-cdp-cli eval "document.title"
chrome-cdp-cli eval "window.location.href"
chrome-cdp-cli eval "document.querySelectorAll('a').length"
chrome-cdp-cli eval "({title: document.title, url: location.href, links: document.links.length})"
\`\`\`

### Interact with Elements
\`\`\`bash
chrome-cdp-cli eval "document.querySelector('#button').click()"
chrome-cdp-cli eval "document.querySelector('#input').value = 'Hello World'"
chrome-cdp-cli eval "document.querySelector('#form').submit()"
\`\`\`

### Async Operations
\`\`\`bash
chrome-cdp-cli eval "fetch('/api/data').then(r => r.json())"
chrome-cdp-cli eval "new Promise(resolve => setTimeout(() => resolve('Done'), 1000))"
\`\`\`

## Element Interaction Commands

### Clicking Elements
\`\`\`bash
chrome-cdp-cli click "#submit-button"
chrome-cdp-cli click ".menu-item"
chrome-cdp-cli click "button[type='submit']"
chrome-cdp-cli click "#slow-button" --timeout 10000
\`\`\`

### Hovering Over Elements
\`\`\`bash
chrome-cdp-cli hover "#dropdown-trigger"
chrome-cdp-cli hover ".tooltip-element"
chrome-cdp-cli hover "#menu-item" --timeout 5000
\`\`\`

### Form Filling
\`\`\`bash
# Single field
chrome-cdp-cli fill "#username" "john@example.com"
chrome-cdp-cli fill "input[name='password']" "secret123"
chrome-cdp-cli fill "#message" "This is a test message"

# Multiple fields at once
chrome-cdp-cli fill_form '{
  "#username": "john@example.com",
  "#password": "secret123",
  "#confirm-password": "secret123",
  "#email": "john@example.com"
}'
\`\`\`

### Drag and Drop
\`\`\`bash
chrome-cdp-cli drag "#draggable-item" "#drop-zone"
chrome-cdp-cli drag ".file-item" ".upload-area"
chrome-cdp-cli drag "#source-element" "#target-container"
\`\`\`

### Keyboard Input
\`\`\`bash
# Basic key presses
chrome-cdp-cli press_key "Enter"
chrome-cdp-cli press_key "Escape"
chrome-cdp-cli press_key "Tab"

# With modifiers
chrome-cdp-cli press_key "a" --modifiers Ctrl  # Ctrl+A (Select All)
chrome-cdp-cli press_key "s" --modifiers Ctrl  # Ctrl+S (Save)
chrome-cdp-cli press_key "c" --modifiers Ctrl,Shift  # Ctrl+Shift+C

# Target specific elements
chrome-cdp-cli press_key "Enter" --selector "#search-input"
chrome-cdp-cli press_key "ArrowDown" --selector "#dropdown"
\`\`\`

### File Upload
\`\`\`bash
chrome-cdp-cli upload_file "input[type='file']" "./document.pdf"
chrome-cdp-cli upload_file "#file-input" "/path/to/image.jpg"
chrome-cdp-cli upload_file ".upload-field" "./test-data.csv"
\`\`\`

### Waiting for Elements
\`\`\`bash
# Wait for element to exist
chrome-cdp-cli wait_for "#loading-spinner"

# Wait for element to be visible
chrome-cdp-cli wait_for "#modal" --condition visible

# Wait for element to be hidden
chrome-cdp-cli wait_for "#loading" --condition hidden

# Wait for element to be enabled
chrome-cdp-cli wait_for "#submit-btn" --condition enabled

# Wait for element to be disabled
chrome-cdp-cli wait_for "#processing-btn" --condition disabled

# Custom timeout
chrome-cdp-cli wait_for "#slow-element" --timeout 30000
\`\`\`

### Dialog Handling
\`\`\`bash
# Accept dialogs
chrome-cdp-cli handle_dialog accept

# Dismiss dialogs
chrome-cdp-cli handle_dialog dismiss

# Handle prompt with text input
chrome-cdp-cli handle_dialog accept --text "John Doe"
chrome-cdp-cli handle_dialog accept --text ""  # Empty input

# Wait for dialog to appear
chrome-cdp-cli handle_dialog accept --timeout 10000
\`\`\`

## Visual Capture

### Screenshots
\`\`\`bash
chrome-cdp-cli screenshot --filename homepage.png
chrome-cdp-cli screenshot --filename fullpage.png --fullpage
chrome-cdp-cli screenshot --filename reports/test-result.png
\`\`\`

### DOM Snapshots
\`\`\`bash
chrome-cdp-cli snapshot --filename page-structure.json
chrome-cdp-cli snapshot --filename form-state.json
\`\`\`

## Monitoring

### Console Messages
\`\`\`bash
chrome-cdp-cli console --latest
chrome-cdp-cli console
chrome-cdp-cli console --types error
chrome-cdp-cli console --types warn
\`\`\`

### Network Requests
\`\`\`bash
chrome-cdp-cli network --latest
chrome-cdp-cli network
chrome-cdp-cli network --filter '{"methods":["POST"]}'
chrome-cdp-cli network --filter '{"methods":["GET"]}'
\`\`\`

## Complete Workflow Examples

### Login Form Testing
\`\`\`bash
# 1. Wait for login form to be visible
chrome-cdp-cli wait_for "#login-form" --condition visible

# 2. Fill login credentials
chrome-cdp-cli fill "#email" "test@example.com"
chrome-cdp-cli fill "#password" "password123"

# 3. Submit form
chrome-cdp-cli click "#login-button"

# 4. Wait for redirect or success message
chrome-cdp-cli wait_for "#dashboard" --condition visible --timeout 10000

# 5. Capture success state
chrome-cdp-cli screenshot --filename login-success.png

# 6. Check for any errors
chrome-cdp-cli console --types error
\`\`\`

### File Upload Workflow
\`\`\`bash
# 1. Navigate to upload page
chrome-cdp-cli eval "window.location.href = '/upload'"

# 2. Wait for upload form
chrome-cdp-cli wait_for "#upload-form" --condition visible

# 3. Click upload button to open file dialog
chrome-cdp-cli click "#upload-trigger"

# 4. Upload file
chrome-cdp-cli upload_file "input[type='file']" "./test-document.pdf"

# 5. Wait for upload completion
chrome-cdp-cli wait_for ".upload-success" --condition visible

# 6. Verify uploaded file name
chrome-cdp-cli eval "document.querySelector('.file-name').textContent"

# 7. Capture final state
chrome-cdp-cli screenshot --filename upload-complete.png
\`\`\`

### E-commerce Shopping Flow
\`\`\`bash
# 1. Search for product
chrome-cdp-cli fill "#search-input" "laptop"
chrome-cdp-cli press_key "Enter" --selector "#search-input"

# 2. Wait for search results
chrome-cdp-cli wait_for ".search-results" --condition visible

# 3. Click on first product
chrome-cdp-cli click ".product-item:first-child"

# 4. Wait for product page
chrome-cdp-cli wait_for "#product-details" --condition visible

# 5. Add to cart
chrome-cdp-cli click "#add-to-cart"

# 6. Handle any confirmation dialogs
chrome-cdp-cli handle_dialog accept

# 7. Go to cart
chrome-cdp-cli click "#cart-icon"

# 8. Proceed to checkout
chrome-cdp-cli click "#checkout-button"

# 9. Fill shipping information
chrome-cdp-cli fill_form '{
  "#first-name": "John",
  "#last-name": "Doe",
  "#address": "123 Main St",
  "#city": "Anytown",
  "#zip": "12345"
}'

# 10. Capture checkout page
chrome-cdp-cli screenshot --filename checkout-form.png
\`\`\`

### Form Validation Testing
\`\`\`bash
# 1. Try to submit empty form
chrome-cdp-cli click "#submit-button"

# 2. Check for validation errors
chrome-cdp-cli eval "document.querySelectorAll('.error-message').length"

# 3. Fill invalid email
chrome-cdp-cli fill "#email" "invalid-email"
chrome-cdp-cli click "#submit-button"

# 4. Check specific error message
chrome-cdp-cli eval "document.querySelector('#email-error').textContent"

# 5. Fill valid data
chrome-cdp-cli fill "#email" "valid@example.com"
chrome-cdp-cli fill "#phone" "555-1234"

# 6. Submit and verify success
chrome-cdp-cli click "#submit-button"
chrome-cdp-cli wait_for "#success-message" --condition visible

# 7. Capture final state
chrome-cdp-cli screenshot --filename form-success.png
\`\`\`

### Drag and Drop Testing
\`\`\`bash
# 1. Wait for drag source and target
chrome-cdp-cli wait_for "#draggable-item" --condition visible
chrome-cdp-cli wait_for "#drop-zone" --condition visible

# 2. Capture initial state
chrome-cdp-cli screenshot --filename before-drag.png

# 3. Perform drag and drop
chrome-cdp-cli drag "#draggable-item" "#drop-zone"

# 4. Wait for drop animation to complete
chrome-cdp-cli wait_for "#drop-zone .dropped-item" --condition visible

# 5. Verify drop result
chrome-cdp-cli eval "document.querySelector('#drop-zone').children.length"

# 6. Capture final state
chrome-cdp-cli screenshot --filename after-drag.png
\`\`\`

### Keyboard Navigation Testing
\`\`\`bash
# 1. Focus on first input
chrome-cdp-cli click "#first-input"

# 2. Navigate using Tab
chrome-cdp-cli press_key "Tab"
chrome-cdp-cli press_key "Tab"

# 3. Use arrow keys in dropdown
chrome-cdp-cli press_key "ArrowDown" --selector "#dropdown"
chrome-cdp-cli press_key "ArrowDown"
chrome-cdp-cli press_key "Enter"

# 4. Use keyboard shortcuts
chrome-cdp-cli press_key "a" --modifiers Ctrl  # Select all
chrome-cdp-cli press_key "c" --modifiers Ctrl  # Copy

# 5. Submit with Enter
chrome-cdp-cli press_key "Enter" --selector "#submit-button"
\`\`\`
`;
  }

  private generateReferenceMarkdown(): string {
    return `# Chrome DevTools CLI Reference

## Complete Command Reference

### JavaScript Execution

#### eval
Execute JavaScript code in the browser context.

**Syntax:** \`chrome-cdp-cli eval <expression>\`

**Options:**
- \`--timeout <ms>\`: Execution timeout in milliseconds
- \`--await-promise\`: Wait for Promise resolution (default: true)

**Examples:**
- \`chrome-cdp-cli eval "document.title"\`
- \`chrome-cdp-cli eval "fetch('/api').then(r => r.text())"\`

### Visual Capture

#### screenshot
Capture a screenshot of the current page.

**Syntax:** \`chrome-cdp-cli screenshot [options]\`

**Options:**
- \`--filename <path>\`: Output filename (default: screenshot.png)
- \`--fullpage\`: Capture full page instead of viewport
- \`--quality <0-100>\`: JPEG quality (default: 90)

#### snapshot
Capture a complete DOM snapshot with layout information.

**Syntax:** \`chrome-cdp-cli snapshot [options]\`

**Options:**
- \`--filename <path>\`: Output filename (default: snapshot.json)
- \`--include-styles\`: Include computed styles (default: true)
- \`--include-layout\`: Include layout information (default: true)

### Element Interaction

#### click
Click on an element using CSS selector.

**Syntax:** \`chrome-cdp-cli click <selector> [options]\`

**Options:**
- \`--wait-for-element\`: Wait for element to be available (default: true)
- \`--timeout <ms>\`: Timeout for waiting for element (default: 5000ms)

**Examples:**
- \`chrome-cdp-cli click "#submit-button"\`
- \`chrome-cdp-cli click ".menu-item" --timeout 10000\`

#### hover
Hover over an element using CSS selector.

**Syntax:** \`chrome-cdp-cli hover <selector> [options]\`

**Options:**
- \`--wait-for-element\`: Wait for element to be available (default: true)
- \`--timeout <ms>\`: Timeout for waiting for element (default: 5000ms)

#### fill
Fill a form field with text using CSS selector.

**Syntax:** \`chrome-cdp-cli fill <selector> <text> [options]\`

**Options:**
- \`--wait-for-element\`: Wait for element to be available (default: true)
- \`--timeout <ms>\`: Timeout for waiting for element (default: 5000ms)
- \`--clear-first\`: Clear field before filling (default: true)

**Examples:**
- \`chrome-cdp-cli fill "#username" "john@example.com"\`
- \`chrome-cdp-cli fill "input[name='password']" "secret123"\`

#### fill_form
Fill multiple form fields at once.

**Syntax:** \`chrome-cdp-cli fill_form <json> [options]\`

**Options:**
- \`--wait-for-elements\`: Wait for all elements to be available (default: true)
- \`--timeout <ms>\`: Timeout for waiting for elements (default: 5000ms)

**Examples:**
- \`chrome-cdp-cli fill_form '{"#username": "john", "#password": "secret"}'\`

### Advanced Interactions

#### drag
Perform drag and drop operation from source to target element.

**Syntax:** \`chrome-cdp-cli drag <sourceSelector> <targetSelector> [options]\`

**Options:**
- \`--wait-for-element\`: Wait for elements to be available (default: true)
- \`--timeout <ms>\`: Timeout for waiting for elements (default: 5000ms)

**Examples:**
- \`chrome-cdp-cli drag "#draggable" "#dropzone"\`

#### press_key
Simulate keyboard input.

**Syntax:** \`chrome-cdp-cli press_key <key> [options]\`

**Options:**
- \`--selector <selector>\`: CSS selector to focus element first
- \`--modifiers <list>\`: Comma-separated modifiers: Ctrl, Alt, Shift, Meta
- \`--wait-for-element\`: Wait for element if selector provided (default: true)
- \`--timeout <ms>\`: Timeout for waiting for element (default: 5000ms)

**Examples:**
- \`chrome-cdp-cli press_key "Enter"\`
- \`chrome-cdp-cli press_key "a" --modifiers Ctrl\`
- \`chrome-cdp-cli press_key "Enter" --selector "#input-field"\`

#### upload_file
Upload a file to a file input element.

**Syntax:** \`chrome-cdp-cli upload_file <selector> <filePath> [options]\`

**Options:**
- \`--wait-for-element\`: Wait for element to be available (default: true)
- \`--timeout <ms>\`: Timeout for waiting for element (default: 5000ms)

**Examples:**
- \`chrome-cdp-cli upload_file "input[type='file']" "./document.pdf"\`

#### wait_for
Wait for an element to appear or meet specific conditions.

**Syntax:** \`chrome-cdp-cli wait_for <selector> [options]\`

**Options:**
- \`--timeout <ms>\`: Maximum time to wait (default: 10000ms)
- \`--condition <type>\`: Condition to wait for (default: exists)
- \`--poll-interval <ms>\`: Polling interval (default: 100ms)

**Conditions:**
- \`exists\`: Element exists in DOM
- \`visible\`: Element exists and is visible
- \`hidden\`: Element is hidden or does not exist
- \`enabled\`: Element exists and is not disabled
- \`disabled\`: Element exists and is disabled

**Examples:**
- \`chrome-cdp-cli wait_for "#loading" --condition hidden\`
- \`chrome-cdp-cli wait_for "#submit-btn" --condition enabled\`

#### handle_dialog
Handle browser dialogs (alert, confirm, prompt).

**Syntax:** \`chrome-cdp-cli handle_dialog <action> [options]\`

**Arguments:**
- \`<action>\`: Action to take: "accept" or "dismiss"

**Options:**
- \`--text <string>\`: Text to enter for prompt dialogs (when accepting)
- \`--wait-for-dialog\`: Wait for dialog to appear (default: true)
- \`--timeout <ms>\`: Timeout for waiting for dialog (default: 5000ms)

**Examples:**
- \`chrome-cdp-cli handle_dialog accept\`
- \`chrome-cdp-cli handle_dialog accept --text "John Doe"\`

### Monitoring

#### console
List console messages or get the latest message.

**Syntax:** \`chrome-cdp-cli console [options]\`

**Options:**
- \`--latest\`: Get only the latest message
- \`--types <types>\`: Filter by message types (comma-separated: log,info,warn,error,debug)
- \`--textPattern <pattern>\`: Filter by text pattern (regex)
- \`--maxMessages <count>\`: Maximum number of messages to return

#### network
List network requests or get the latest request.

**Syntax:** \`chrome-cdp-cli network [options]\`

**Options:**
- \`--latest\`: Get only the latest request
- \`--filter <json>\`: Filter requests (JSON string with methods, urlPattern, statusCodes, etc.)

### IDE Integration

#### install_cursor_command
Install Cursor IDE commands for Chrome browser automation.

**Syntax:** \`chrome-cdp-cli install_cursor_command [options]\`

**Options:**
- \`--target-directory <path>\`: Custom installation directory (default: .cursor/commands)
- \`--force\`: Force installation without directory validation

#### install_claude_skill
Install Claude Code skill for Chrome browser automation.

**Syntax:** \`chrome-cdp-cli install_claude_skill [options]\`

**Options:**
- \`--skill-type <type>\`: Installation type: 'project' or 'personal' (default: project)
- \`--target-directory <path>\`: Custom installation directory
- \`--include-examples\`: Include examples.md file
- \`--include-references\`: Include reference.md file
- \`--force\`: Force installation without directory validation

## Global Options

All commands support these global options:

- \`--host <hostname>\`: Chrome DevTools host (default: localhost)
- \`--port <number>\`: Chrome DevTools port (default: 9222)
- \`--output-format <json|text>\`: Output format (default: json)
- \`--verbose\`: Enable verbose logging
- \`--quiet\`: Suppress non-error output
- \`--timeout <ms>\`: Global timeout for operations

## Chrome Setup

### Starting Chrome with DevTools
\`\`\`bash
# Linux/Windows
chrome --remote-debugging-port=9222

# macOS
/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222

# With additional options
chrome --remote-debugging-port=9222 --disable-web-security --user-data-dir=/tmp/chrome-debug
\`\`\`

### Headless Mode
\`\`\`bash
chrome --headless --remote-debugging-port=9222
\`\`\`

## Supported Keys for press_key Command

### Letters and Numbers
- Letters: a-z, A-Z
- Numbers: 0-9

### Special Keys
- \`Enter\`: Enter key
- \`Escape\`: Escape key
- \`Tab\`: Tab key
- \`Backspace\`: Backspace key
- \`Delete\`: Delete key
- \`Space\`: Space bar

### Arrow Keys
- \`ArrowUp\`: Up arrow
- \`ArrowDown\`: Down arrow
- \`ArrowLeft\`: Left arrow
- \`ArrowRight\`: Right arrow

### Navigation Keys
- \`Home\`: Home key
- \`End\`: End key
- \`PageUp\`: Page Up key
- \`PageDown\`: Page Down key

### Modifier Keys
- \`Ctrl\`: Control key
- \`Alt\`: Alt key
- \`Shift\`: Shift key
- \`Meta\`: Meta/Cmd key (macOS)

## Wait Conditions Explained

### exists
Element is present in the DOM, regardless of visibility.

### visible
Element is present in the DOM and visible to the user:
- Has non-zero dimensions (width > 0 and height > 0)
- \`visibility\` is not 'hidden'
- \`display\` is not 'none'
- \`opacity\` is not '0'

### hidden
Element is either not present in the DOM or is hidden:
- Not in DOM, or
- Has zero dimensions, or
- \`visibility\` is 'hidden', or
- \`display\` is 'none', or
- \`opacity\` is '0'

### enabled
Element is present and not disabled (for form elements):
- Element exists in DOM
- \`disabled\` property is false
- No \`disabled\` attribute

### disabled
Element is present and disabled (for form elements):
- Element exists in DOM
- \`disabled\` property is true or \`disabled\` attribute is present

## Error Handling

### Common Errors
- **Connection refused**: Chrome is not running or DevTools port is incorrect
- **Target not found**: No active tab or page available
- **Element not found**: CSS selector doesn't match any elements
- **JavaScript error**: Syntax error or runtime exception in eval expression
- **Timeout**: Operation took longer than specified timeout
- **File not found**: File path for upload_file doesn't exist
- **Dialog not found**: No dialog present when trying to handle_dialog

### Debugging Tips
- Use \`--verbose\` flag for detailed logging
- Check Chrome DevTools at \`http://localhost:9222\` for available targets
- Verify CSS selectors using browser developer tools
- Test JavaScript expressions in browser console before using eval
- Use shorter timeouts for testing, longer for complex operations
- Check file paths are correct and files exist for upload operations

## Integration Examples

### CI/CD Pipeline
\`\`\`yaml
# GitHub Actions example
- name: Test web application
  run: |
    # Start Chrome
    google-chrome --headless --remote-debugging-port=9222 &
    
    # Wait for Chrome to start
    sleep 2
    
    # Navigate to application
    chrome-cdp-cli eval "window.location.href = 'http://localhost:3000'"
    
    # Run comprehensive tests
    chrome-cdp-cli wait_for "#app" --condition visible
    chrome-cdp-cli fill "#username" "testuser"
    chrome-cdp-cli fill "#password" "testpass"
    chrome-cdp-cli click "#login-button"
    chrome-cdp-cli wait_for "#dashboard" --condition visible
    chrome-cdp-cli screenshot --filename test-result.png
    
    # Check for errors
    chrome-cdp-cli console --types error
\`\`\`

### Automated Testing Script
\`\`\`bash
#!/bin/bash
# comprehensive-test.sh

# Start Chrome in background
chrome --headless --remote-debugging-port=9222 &
CHROME_PID=$!

# Wait for Chrome to start
sleep 2

# Test suite
echo "Running comprehensive web tests..."

# Navigation test
chrome-cdp-cli eval "window.location.href = 'http://localhost:3000'"
chrome-cdp-cli wait_for "#app" --condition visible

# Form interaction test
chrome-cdp-cli fill "#search-input" "test query"
chrome-cdp-cli press_key "Enter" --selector "#search-input"
chrome-cdp-cli wait_for ".search-results" --condition visible

# File upload test
chrome-cdp-cli click "#upload-button"
chrome-cdp-cli upload_file "input[type='file']" "./test-file.pdf"
chrome-cdp-cli wait_for ".upload-success" --condition visible

# Dialog handling test
chrome-cdp-cli click "#delete-button"
chrome-cdp-cli handle_dialog accept

# Drag and drop test
chrome-cdp-cli drag "#draggable" "#dropzone"
chrome-cdp-cli wait_for "#dropzone .dropped-item" --condition visible

# Capture final state
chrome-cdp-cli screenshot --filename final-state.png
chrome-cdp-cli snapshot --filename final-dom.json

# Check for errors
ERROR_COUNT=$(chrome-cdp-cli console --types error | jq length)
if [ "$ERROR_COUNT" -gt 0 ]; then
  echo "Test failed: $ERROR_COUNT console errors found"
  exit 1
fi

echo "All tests passed!"

# Cleanup
kill $CHROME_PID
\`\`\`
`;
  }

  /**
   * Get command help text
   */
  getHelp(): string {
    return `
install-claude-skill - Install Claude Code skill for Chrome browser automation

Usage:
  install-claude-skill
  install-claude-skill --skill-type personal
  install-claude-skill --target-directory /path/to/.claude/skills
  install-claude-skill --include-examples --include-references

Arguments:
  --skill-type <type>         Installation type: 'project' or 'personal' (default: project)
  --target-directory <path>   Custom installation directory
  --include-examples          Include examples.md file with usage examples
  --include-references        Include reference.md file with detailed API documentation
  --force                     Force installation without directory validation

Description:
  Installs a Claude Code skill that provides Chrome browser automation capabilities
  within Claude IDE. The skill enables Claude to help with:

  • Browser automation and testing
  • JavaScript execution and debugging
  • Web scraping and data extraction
  • UI testing and interaction
  • Performance monitoring

Installation Types:
  project  - Install in current project (.claude/skills/cdp-cli/)
  personal - Install in user home directory (~/.claude/skills/cdp-cli/)

Directory Validation:
  For project installation, the command checks for a .claude directory to ensure
  you're in a project root. Use --force to bypass this validation or 
  --target-directory to specify a custom location.

Examples:
  # Install in current project (requires .claude directory)
  install-claude-skill

  # Install for personal use (in home directory)
  install-claude-skill --skill-type personal

  # Install with examples and references
  install-claude-skill --include-examples --include-references

  # Install with custom directory
  install-claude-skill --target-directory /path/to/.claude/skills

  # Force install without validation
  install-claude-skill --force

Note:
  The installed skill leverages the eval command approach, which is particularly
  powerful for LLM-assisted development. Claude can write and test JavaScript
  automation scripts dynamically, making it ideal for rapid prototyping and
  complex browser automation tasks.
`;
  }
}
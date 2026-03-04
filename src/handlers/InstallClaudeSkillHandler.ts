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
  cdp install-claude-skill --skill-type personal
  cdp install-claude-skill --target-directory /path/to/.claude/skills
  cdp install-claude-skill --force`
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
# .cdp.yaml
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
cdp click "#nonexistent-element"
# Shows: selector validation tips, alternatives, related help topics

# Debug mode for detailed error information
cdp --debug --verbose click "#problematic-element"
# Shows: execution logs, CDP messages, timing information
\`\`\`

## Complete Command Reference

### JavaScript Execution
- **eval**: Execute JavaScript code with enhanced error handling
  \`cdp --profile development eval "document.title"\`
  \`cdp --format json eval "performance.timing"\`
  \`cdp eval --file automation-script.js\`

### Visual Capture with Enhanced Options
- **screenshot**: Advanced screenshot capture
  \`cdp --profile testing screenshot --filename test-result.png\`
  \`cdp screenshot --full-page --format jpeg --quality 90\`
- **snapshot**: Complete DOM snapshots with metadata
  \`cdp --format json snapshot --filename dom-analysis.json\`

### Enhanced Element Interaction
- **click**: Click with retry and error recovery
  \`cdp --debug click "#submit-button"\`
  \`cdp click ".slow-loading-button" --timeout 15000\`
- **hover**: Hover with timing control
  \`cdp hover "#dropdown-trigger" --timeout 5000\`
- **fill**: Form filling with validation
  \`cdp fill "#username" "john@example.com" --no-clear\`
- **fill_form**: Batch form operations with error handling
  \`cdp fill_form --fields-file form-data.json --continue-on-error\`

### Advanced Interactions
- **drag**: Enhanced drag and drop
  \`cdp --verbose drag "#draggable" "#dropzone"\`
- **press_key**: Keyboard simulation with element targeting
  \`cdp press_key "Enter" --selector "#search-input"\`
  \`cdp press_key "s" --modifiers Ctrl,Shift\`
- **upload_file**: File upload with validation
  \`cdp upload_file "input[type='file']" "./document.pdf"\`
- **wait_for**: Advanced waiting with conditions
  \`cdp wait_for "#loading" --condition hidden --timeout 30000\`
  \`cdp wait_for "#submit-btn" --condition enabled\`
- **handle_dialog**: Dialog handling with text input
  \`cdp handle_dialog accept --text "confirmation text"\`

### Enhanced Monitoring
- **console**: Console monitoring with filtering
  \`cdp --format json console --latest\`
  \`cdp console --types error,warn\`
- **network**: Network monitoring with filters
  \`cdp --format json network --latest\`
  \`cdp network --filter '{"methods":["POST"],"statusCodes":[200,201]}'\`

### Help System
- **help**: Comprehensive help with topics
  \`cdp help\` - General help with categorized commands
  \`cdp help eval\` - Command-specific help with examples
  \`cdp help topic configuration\` - Configuration management
  \`cdp help topic selectors\` - CSS selector guide
  \`cdp help topic automation\` - Best practices
  \`cdp help topic debugging\` - Troubleshooting guide

## Enhanced Automation Workflows

### Configuration-Driven Testing
\`\`\`bash
# Load testing profile
cdp --profile testing --config test-config.yaml

# Execute test suite with error recovery
cdp eval --file test-suite.js || {
  echo "Test failed, capturing evidence..."
  cdp capture-evidence
  cdp check-console
  exit 1
}

# Generate structured report
cdp --format json eval "generateTestReport()" > test-results.json
\`\`\`

### Performance Monitoring Workflow
\`\`\`bash
# Set up performance monitoring
cdp --profile performance --verbose

# Navigate and collect metrics
cdp eval "window.location.href = 'https://example.com'"
cdp wait_for "#main-content" --timeout 30000

# Collect comprehensive performance data
cdp --format json eval "
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
cdp --profile development --debug

# Batch form filling with comprehensive error handling
cdp fill_form --fields-file form-test-data.json --continue-on-error --timeout 15000

# Validate form submission with evidence capture
cdp click "#submit-button"
cdp wait_for ".success-message, .error-message" --timeout 10000

# Capture validation results
cdp --format json eval "
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
cdp --profile ci --quiet eval --file ci-test-suite.js

# Generate JUnit-compatible reports
cdp --format json eval "generateJUnitReport()" > test-results.xml

# Capture evidence on failures
if [ $? -ne 0 ]; then
  cdp screenshot --filename failure-evidence.png
  cdp console --types error > console-errors.json
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
Create \`.cdp.yaml\` in your project root with appropriate profiles for your environments.

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
\`cdp --plugin-dir ./plugins custom-command\`

For comprehensive documentation, see:
- Configuration Guide: docs/CONFIGURATION.md
- Plugin Development: docs/PLUGIN_DEVELOPMENT.md
- Advanced Help Topics: \`cdp help topic <topic>\`
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
tools: [cdp]
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
cdp eval "document.title"
cdp eval "window.location.href"
cdp eval "document.querySelectorAll('a').length"
cdp eval "({title: document.title, url: location.href, links: document.links.length})"
\`\`\`

### Interact with Elements
\`\`\`bash
cdp eval "document.querySelector('#button').click()"
cdp eval "document.querySelector('#input').value = 'Hello World'"
cdp eval "document.querySelector('#form').submit()"
\`\`\`

### Async Operations
\`\`\`bash
cdp eval "fetch('/api/data').then(r => r.json())"
cdp eval "new Promise(resolve => setTimeout(() => resolve('Done'), 1000))"
\`\`\`

## Element Interaction Commands

### Clicking Elements
\`\`\`bash
cdp click "#submit-button"
cdp click ".menu-item"
cdp click "button[type='submit']"
cdp click "#slow-button" --timeout 10000
\`\`\`

### Hovering Over Elements
\`\`\`bash
cdp hover "#dropdown-trigger"
cdp hover ".tooltip-element"
cdp hover "#menu-item" --timeout 5000
\`\`\`

### Form Filling
\`\`\`bash
# Single field
cdp fill "#username" "john@example.com"
cdp fill "input[name='password']" "secret123"
cdp fill "#message" "This is a test message"

# Multiple fields at once
cdp fill_form '{
  "#username": "john@example.com",
  "#password": "secret123",
  "#confirm-password": "secret123",
  "#email": "john@example.com"
}'
\`\`\`

### Drag and Drop
\`\`\`bash
cdp drag "#draggable-item" "#drop-zone"
cdp drag ".file-item" ".upload-area"
cdp drag "#source-element" "#target-container"
\`\`\`

### Keyboard Input
\`\`\`bash
# Basic key presses
cdp press_key "Enter"
cdp press_key "Escape"
cdp press_key "Tab"

# With modifiers
cdp press_key "a" --modifiers Ctrl  # Ctrl+A (Select All)
cdp press_key "s" --modifiers Ctrl  # Ctrl+S (Save)
cdp press_key "c" --modifiers Ctrl,Shift  # Ctrl+Shift+C

# Target specific elements
cdp press_key "Enter" --selector "#search-input"
cdp press_key "ArrowDown" --selector "#dropdown"
\`\`\`

### File Upload
\`\`\`bash
cdp upload_file "input[type='file']" "./document.pdf"
cdp upload_file "#file-input" "/path/to/image.jpg"
cdp upload_file ".upload-field" "./test-data.csv"
\`\`\`

### Waiting for Elements
\`\`\`bash
# Wait for element to exist
cdp wait_for "#loading-spinner"

# Wait for element to be visible
cdp wait_for "#modal" --condition visible

# Wait for element to be hidden
cdp wait_for "#loading" --condition hidden

# Wait for element to be enabled
cdp wait_for "#submit-btn" --condition enabled

# Wait for element to be disabled
cdp wait_for "#processing-btn" --condition disabled

# Custom timeout
cdp wait_for "#slow-element" --timeout 30000
\`\`\`

### Dialog Handling
\`\`\`bash
# Accept dialogs
cdp handle_dialog accept

# Dismiss dialogs
cdp handle_dialog dismiss

# Handle prompt with text input
cdp handle_dialog accept --text "John Doe"
cdp handle_dialog accept --text ""  # Empty input

# Wait for dialog to appear
cdp handle_dialog accept --timeout 10000
\`\`\`

## Visual Capture

### Screenshots
\`\`\`bash
cdp screenshot --filename homepage.png
cdp screenshot --filename fullpage.png --fullpage
cdp screenshot --filename reports/test-result.png
\`\`\`

### DOM Snapshots
\`\`\`bash
cdp snapshot --filename page-structure.json
cdp snapshot --filename form-state.json
\`\`\`

## Monitoring

### Console Messages
\`\`\`bash
cdp console --latest
cdp console
cdp console --types error
cdp console --types warn
\`\`\`

### Network Requests
\`\`\`bash
cdp network --latest
cdp network
cdp network --filter '{"methods":["POST"]}'
cdp network --filter '{"methods":["GET"]}'
\`\`\`

## Complete Workflow Examples

### Login Form Testing
\`\`\`bash
# 1. Wait for login form to be visible
cdp wait_for "#login-form" --condition visible

# 2. Fill login credentials
cdp fill "#email" "test@example.com"
cdp fill "#password" "password123"

# 3. Submit form
cdp click "#login-button"

# 4. Wait for redirect or success message
cdp wait_for "#dashboard" --condition visible --timeout 10000

# 5. Capture success state
cdp screenshot --filename login-success.png

# 6. Check for any errors
cdp console --types error
\`\`\`

### File Upload Workflow
\`\`\`bash
# 1. Navigate to upload page
cdp eval "window.location.href = '/upload'"

# 2. Wait for upload form
cdp wait_for "#upload-form" --condition visible

# 3. Click upload button to open file dialog
cdp click "#upload-trigger"

# 4. Upload file
cdp upload_file "input[type='file']" "./test-document.pdf"

# 5. Wait for upload completion
cdp wait_for ".upload-success" --condition visible

# 6. Verify uploaded file name
cdp eval "document.querySelector('.file-name').textContent"

# 7. Capture final state
cdp screenshot --filename upload-complete.png
\`\`\`

### E-commerce Shopping Flow
\`\`\`bash
# 1. Search for product
cdp fill "#search-input" "laptop"
cdp press_key "Enter" --selector "#search-input"

# 2. Wait for search results
cdp wait_for ".search-results" --condition visible

# 3. Click on first product
cdp click ".product-item:first-child"

# 4. Wait for product page
cdp wait_for "#product-details" --condition visible

# 5. Add to cart
cdp click "#add-to-cart"

# 6. Handle any confirmation dialogs
cdp handle_dialog accept

# 7. Go to cart
cdp click "#cart-icon"

# 8. Proceed to checkout
cdp click "#checkout-button"

# 9. Fill shipping information
cdp fill_form '{
  "#first-name": "John",
  "#last-name": "Doe",
  "#address": "123 Main St",
  "#city": "Anytown",
  "#zip": "12345"
}'

# 10. Capture checkout page
cdp screenshot --filename checkout-form.png
\`\`\`

### Form Validation Testing
\`\`\`bash
# 1. Try to submit empty form
cdp click "#submit-button"

# 2. Check for validation errors
cdp eval "document.querySelectorAll('.error-message').length"

# 3. Fill invalid email
cdp fill "#email" "invalid-email"
cdp click "#submit-button"

# 4. Check specific error message
cdp eval "document.querySelector('#email-error').textContent"

# 5. Fill valid data
cdp fill "#email" "valid@example.com"
cdp fill "#phone" "555-1234"

# 6. Submit and verify success
cdp click "#submit-button"
cdp wait_for "#success-message" --condition visible

# 7. Capture final state
cdp screenshot --filename form-success.png
\`\`\`

### Drag and Drop Testing
\`\`\`bash
# 1. Wait for drag source and target
cdp wait_for "#draggable-item" --condition visible
cdp wait_for "#drop-zone" --condition visible

# 2. Capture initial state
cdp screenshot --filename before-drag.png

# 3. Perform drag and drop
cdp drag "#draggable-item" "#drop-zone"

# 4. Wait for drop animation to complete
cdp wait_for "#drop-zone .dropped-item" --condition visible

# 5. Verify drop result
cdp eval "document.querySelector('#drop-zone').children.length"

# 6. Capture final state
cdp screenshot --filename after-drag.png
\`\`\`

### Keyboard Navigation Testing
\`\`\`bash
# 1. Focus on first input
cdp click "#first-input"

# 2. Navigate using Tab
cdp press_key "Tab"
cdp press_key "Tab"

# 3. Use arrow keys in dropdown
cdp press_key "ArrowDown" --selector "#dropdown"
cdp press_key "ArrowDown"
cdp press_key "Enter"

# 4. Use keyboard shortcuts
cdp press_key "a" --modifiers Ctrl  # Select all
cdp press_key "c" --modifiers Ctrl  # Copy

# 5. Submit with Enter
cdp press_key "Enter" --selector "#submit-button"
\`\`\`
`;
  }

  private generateReferenceMarkdown(): string {
    return `# Chrome DevTools CLI Reference

## Complete Command Reference

### JavaScript Execution

#### eval
Execute JavaScript code in the browser context.

**Syntax:** \`cdp eval <expression>\`

**Options:**
- \`--timeout <ms>\`: Execution timeout in milliseconds
- \`--await-promise\`: Wait for Promise resolution (default: true)

**Examples:**
- \`cdp eval "document.title"\`
- \`cdp eval "fetch('/api').then(r => r.text())"\`

### Visual Capture

#### screenshot
Capture a screenshot of the current page.

**Syntax:** \`cdp screenshot [options]\`

**Options:**
- \`--filename <path>\`: Output filename (default: screenshot.png)
- \`--fullpage\`: Capture full page instead of viewport
- \`--quality <0-100>\`: JPEG quality (default: 90)

#### snapshot
Capture a complete DOM snapshot with layout information.

**Syntax:** \`cdp snapshot [options]\`

**Options:**
- \`--filename <path>\`: Output filename (default: snapshot.json)
- \`--include-styles\`: Include computed styles (default: true)
- \`--include-layout\`: Include layout information (default: true)

### Element Interaction

#### click
Click on an element using CSS selector.

**Syntax:** \`cdp click <selector> [options]\`

**Options:**
- \`--wait-for-element\`: Wait for element to be available (default: true)
- \`--timeout <ms>\`: Timeout for waiting for element (default: 5000ms)

**Examples:**
- \`cdp click "#submit-button"\`
- \`cdp click ".menu-item" --timeout 10000\`

#### hover
Hover over an element using CSS selector.

**Syntax:** \`cdp hover <selector> [options]\`

**Options:**
- \`--wait-for-element\`: Wait for element to be available (default: true)
- \`--timeout <ms>\`: Timeout for waiting for element (default: 5000ms)

#### fill
Fill a form field with text using CSS selector.

**Syntax:** \`cdp fill <selector> <text> [options]\`

**Options:**
- \`--wait-for-element\`: Wait for element to be available (default: true)
- \`--timeout <ms>\`: Timeout for waiting for element (default: 5000ms)
- \`--clear-first\`: Clear field before filling (default: true)

**Examples:**
- \`cdp fill "#username" "john@example.com"\`
- \`cdp fill "input[name='password']" "secret123"\`

#### fill_form
Fill multiple form fields at once.

**Syntax:** \`cdp fill_form <json> [options]\`

**Options:**
- \`--wait-for-elements\`: Wait for all elements to be available (default: true)
- \`--timeout <ms>\`: Timeout for waiting for elements (default: 5000ms)

**Examples:**
- \`cdp fill_form '{"#username": "john", "#password": "secret"}'\`

### Advanced Interactions

#### drag
Perform drag and drop operation from source to target element.

**Syntax:** \`cdp drag <sourceSelector> <targetSelector> [options]\`

**Options:**
- \`--wait-for-element\`: Wait for elements to be available (default: true)
- \`--timeout <ms>\`: Timeout for waiting for elements (default: 5000ms)

**Examples:**
- \`cdp drag "#draggable" "#dropzone"\`

#### press_key
Simulate keyboard input.

**Syntax:** \`cdp press_key <key> [options]\`

**Options:**
- \`--selector <selector>\`: CSS selector to focus element first
- \`--modifiers <list>\`: Comma-separated modifiers: Ctrl, Alt, Shift, Meta
- \`--wait-for-element\`: Wait for element if selector provided (default: true)
- \`--timeout <ms>\`: Timeout for waiting for element (default: 5000ms)

**Examples:**
- \`cdp press_key "Enter"\`
- \`cdp press_key "a" --modifiers Ctrl\`
- \`cdp press_key "Enter" --selector "#input-field"\`

#### upload_file
Upload a file to a file input element.

**Syntax:** \`cdp upload_file <selector> <filePath> [options]\`

**Options:**
- \`--wait-for-element\`: Wait for element to be available (default: true)
- \`--timeout <ms>\`: Timeout for waiting for element (default: 5000ms)

**Examples:**
- \`cdp upload_file "input[type='file']" "./document.pdf"\`

#### wait_for
Wait for an element to appear or meet specific conditions.

**Syntax:** \`cdp wait_for <selector> [options]\`

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
- \`cdp wait_for "#loading" --condition hidden\`
- \`cdp wait_for "#submit-btn" --condition enabled\`

#### handle_dialog
Handle browser dialogs (alert, confirm, prompt).

**Syntax:** \`cdp handle_dialog <action> [options]\`

**Arguments:**
- \`<action>\`: Action to take: "accept" or "dismiss"

**Options:**
- \`--text <string>\`: Text to enter for prompt dialogs (when accepting)
- \`--wait-for-dialog\`: Wait for dialog to appear (default: true)
- \`--timeout <ms>\`: Timeout for waiting for dialog (default: 5000ms)

**Examples:**
- \`cdp handle_dialog accept\`
- \`cdp handle_dialog accept --text "John Doe"\`

### Monitoring

#### console
List console messages or get the latest message.

**Syntax:** \`cdp console [options]\`

**Options:**
- \`--latest\`: Get only the latest message
- \`--types <types>\`: Filter by message types (comma-separated: log,info,warn,error,debug)
- \`--textPattern <pattern>\`: Filter by text pattern (regex)
- \`--maxMessages <count>\`: Maximum number of messages to return

#### network
List network requests or get the latest request.

**Syntax:** \`cdp network [options]\`

**Options:**
- \`--latest\`: Get only the latest request
- \`--filter <json>\`: Filter requests (JSON string with methods, urlPattern, statusCodes, etc.)

### IDE Integration

#### install_cursor_command
Install Cursor IDE commands for Chrome browser automation.

**Syntax:** \`cdp install_cursor_command [options]\`

**Options:**
- \`--target-directory <path>\`: Custom installation directory (default: .cursor/commands)
- \`--force\`: Force installation without directory validation

#### install_claude_skill
Install Claude Code skill for Chrome browser automation.

**Syntax:** \`cdp install_claude_skill [options]\`

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
    cdp eval "window.location.href = 'http://localhost:3000'"
    
    # Run comprehensive tests
    cdp wait_for "#app" --condition visible
    cdp fill "#username" "testuser"
    cdp fill "#password" "testpass"
    cdp click "#login-button"
    cdp wait_for "#dashboard" --condition visible
    cdp screenshot --filename test-result.png
    
    # Check for errors
    cdp console --types error
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
cdp eval "window.location.href = 'http://localhost:3000'"
cdp wait_for "#app" --condition visible

# Form interaction test
cdp fill "#search-input" "test query"
cdp press_key "Enter" --selector "#search-input"
cdp wait_for ".search-results" --condition visible

# File upload test
cdp click "#upload-button"
cdp upload_file "input[type='file']" "./test-file.pdf"
cdp wait_for ".upload-success" --condition visible

# Dialog handling test
cdp click "#delete-button"
cdp handle_dialog accept

# Drag and drop test
cdp drag "#draggable" "#dropzone"
cdp wait_for "#dropzone .dropped-item" --condition visible

# Capture final state
cdp screenshot --filename final-state.png
cdp snapshot --filename final-dom.json

# Check for errors
ERROR_COUNT=$(cdp console --types error | jq length)
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
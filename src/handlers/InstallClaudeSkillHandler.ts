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
      name: 'cdp-cli',
      description: 'Chrome browser automation and testing using DevTools Protocol. Use when user needs to control Chrome browser, execute JavaScript, take screenshots, monitor console/network, or perform web automation tasks.',
      instructions: `# Chrome Browser Automation

## Instructions
Use this skill when the user needs to:
- Execute JavaScript code in Chrome browser
- Take screenshots of web pages
- Capture DOM snapshots with layout information
- Monitor console messages and network requests
- Perform web automation and testing

## Available Commands
1. **eval**: Execute JavaScript code in browser context
2. **screenshot**: Capture page screenshots
3. **snapshot**: Capture complete DOM snapshots
4. **get_console_message**: Get latest console message
5. **list_console_messages**: List all console messages
6. **get_network_request**: Get latest network request
7. **list_network_requests**: List all network requests

## Usage Examples
- Execute: chrome-cdp-cli eval "document.title"
- Screenshot: chrome-cdp-cli screenshot --filename page.png
- Console: chrome-cdp-cli get_console_message
- Network: chrome-cdp-cli list_network_requests

## Prerequisites
Chrome browser must be running with DevTools enabled:
chrome --remote-debugging-port=9222`,
      allowedTools: ['Execute', 'Read', 'Write']
    };
  }

  private generateSkillMarkdown(skill: ClaudeSkillConfig): string {
    const frontmatter = `---
name: ${skill.name}
description: ${skill.description}
${skill.allowedTools ? `allowedTools: [${skill.allowedTools.map(t => `"${t}"`).join(', ')}]` : ''}
---

`;
    
    return frontmatter + skill.instructions;
  }

  private generateExamplesMarkdown(): string {
    return `# Chrome Automation Examples

## Basic JavaScript Execution

### Get Page Information
\`\`\`bash
chrome-cdp-cli eval "document.title"
chrome-cdp-cli eval "window.location.href"
chrome-cdp-cli eval "document.querySelectorAll('a').length"
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

## Visual Capture

### Screenshots
\`\`\`bash
chrome-cdp-cli screenshot --filename homepage.png
chrome-cdp-cli screenshot --filename fullpage.png --fullpage
\`\`\`

### DOM Snapshots
\`\`\`bash
chrome-cdp-cli snapshot --filename page-structure.json
\`\`\`

## Monitoring

### Console Messages
\`\`\`bash
chrome-cdp-cli get_console_message
chrome-cdp-cli list_console_messages --type error
\`\`\`

### Network Requests
\`\`\`bash
chrome-cdp-cli get_network_request
chrome-cdp-cli list_network_requests --method POST
\`\`\`

## Common Workflows

### Testing Form Submission
\`\`\`bash
# Fill form
chrome-cdp-cli eval "document.querySelector('#email').value = 'test@example.com'"
chrome-cdp-cli eval "document.querySelector('#password').value = 'password123'"

# Submit and capture
chrome-cdp-cli eval "document.querySelector('#submit').click()"
chrome-cdp-cli screenshot --filename after-submit.png

# Check for errors
chrome-cdp-cli list_console_messages --type error
\`\`\`

### API Testing
\`\`\`bash
# Make API call
chrome-cdp-cli eval "fetch('/api/users', {method: 'POST', body: JSON.stringify({name: 'John'}), headers: {'Content-Type': 'application/json'}})"

# Monitor network
chrome-cdp-cli list_network_requests --method POST

# Check response
chrome-cdp-cli get_network_request
\`\`\`
`;
  }

  private generateReferenceMarkdown(): string {
    return `# Chrome DevTools CLI Reference

## Command Reference

### eval
Execute JavaScript code in the browser context.

**Syntax:** \`chrome-cdp-cli eval <expression>\`

**Options:**
- \`--timeout <ms>\`: Execution timeout in milliseconds
- \`--await-promise\`: Wait for Promise resolution (default: true)

**Examples:**
- \`chrome-cdp-cli eval "document.title"\`
- \`chrome-cdp-cli eval "fetch('/api').then(r => r.text())"\`

### screenshot
Capture a screenshot of the current page.

**Syntax:** \`chrome-cdp-cli screenshot [options]\`

**Options:**
- \`--filename <path>\`: Output filename (default: screenshot.png)
- \`--fullpage\`: Capture full page instead of viewport
- \`--quality <0-100>\`: JPEG quality (default: 90)

### snapshot
Capture a complete DOM snapshot with layout information.

**Syntax:** \`chrome-cdp-cli snapshot [options]\`

**Options:**
- \`--filename <path>\`: Output filename (default: snapshot.json)
- \`--include-styles\`: Include computed styles (default: true)
- \`--include-layout\`: Include layout information (default: true)

### get_console_message
Get the latest console message.

**Syntax:** \`chrome-cdp-cli get_console_message [options]\`

**Options:**
- \`--type <log|info|warn|error>\`: Filter by message type

### list_console_messages
List all console messages.

**Syntax:** \`chrome-cdp-cli list_console_messages [options]\`

**Options:**
- \`--type <log|info|warn|error>\`: Filter by message type
- \`--limit <number>\`: Maximum number of messages to return

### get_network_request
Get the latest network request.

**Syntax:** \`chrome-cdp-cli get_network_request [options]\`

**Options:**
- \`--method <GET|POST|PUT|DELETE>\`: Filter by HTTP method

### list_network_requests
List all network requests.

**Syntax:** \`chrome-cdp-cli list_network_requests [options]\`

**Options:**
- \`--method <GET|POST|PUT|DELETE>\`: Filter by HTTP method
- \`--limit <number>\`: Maximum number of requests to return

## Global Options

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

## Error Handling

### Common Errors
- **Connection refused**: Chrome is not running or DevTools port is incorrect
- **Target not found**: No active tab or page available
- **JavaScript error**: Syntax error or runtime exception in eval expression
- **Timeout**: Operation took longer than specified timeout

### Debugging Tips
- Use \`--verbose\` flag for detailed logging
- Check Chrome DevTools at \`http://localhost:9222\` for available targets
- Verify JavaScript syntax before executing with eval
- Use shorter timeouts for testing, longer for complex operations

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
    
    # Run tests
    chrome-cdp-cli eval "document.querySelector('#test-button').click()"
    chrome-cdp-cli screenshot --filename test-result.png
    
    # Check for errors
    chrome-cdp-cli list_console_messages --type error
\`\`\`

### Automated Testing
\`\`\`bash
#!/bin/bash
# test-script.sh

# Start Chrome in background
chrome --headless --remote-debugging-port=9222 &
CHROME_PID=$!

# Wait for Chrome to start
sleep 2

# Run tests
chrome-cdp-cli eval "window.location.href = 'http://localhost:3000'"
chrome-cdp-cli eval "document.querySelector('#login-form input[name=username]').value = 'testuser'"
chrome-cdp-cli eval "document.querySelector('#login-form input[name=password]').value = 'testpass'"
chrome-cdp-cli eval "document.querySelector('#login-form').submit()"

# Capture results
chrome-cdp-cli screenshot --filename login-test.png
chrome-cdp-cli list_console_messages --type error > errors.log

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
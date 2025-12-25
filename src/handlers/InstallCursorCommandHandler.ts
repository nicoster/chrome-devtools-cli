import { ICommandHandler } from '../interfaces/CommandHandler';
import { CommandResult, CDPClient } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';

interface CursorCommandConfig {
  name: string;
  description: string;
  instructions: string;
  examples: string[];
  parameters?: string[];
}

interface InstallCursorCommandArgs {
  targetDirectory?: string;
  includeExamples?: boolean;
  force?: boolean;
}

export class InstallCursorCommandHandler implements ICommandHandler {
  name = 'install_cursor_command';

  async execute(_client: CDPClient, args: InstallCursorCommandArgs): Promise<CommandResult> {
    try {
      const targetDir = args.targetDirectory || '.cursor/commands';
      
      // Check if in Cursor project root directory
      if (!args.targetDirectory && targetDir === '.cursor/commands' && !args.force) {
        const cursorDirExists = await this.checkDirectoryExists('.cursor');
        if (!cursorDirExists) {
          return {
            success: false,
            error: `Warning: No .cursor directory found in current directory. This may not be a Cursor project root directory.

To install Cursor commands:
1. Navigate to your Cursor project root directory (where .cursor folder should be)
2. Run the command again, or
3. Use --target-directory to specify a custom location, or
4. Use --force to install anyway

Examples:
  chrome-cdp-cli install-cursor-command --target-directory /path/to/.cursor/commands
  chrome-cdp-cli install-cursor-command --force`
          };
        }
      }
      
      // Ensure directory exists - improved logic to check .cursor/commands path
      await this.ensureDirectoryPath(targetDir);
      
      // Generate command configuration
      const commands = this.generateCursorCommands();
      
      // Create command files
      const createdFiles: string[] = [];
      for (const command of commands) {
        const filePath = path.join(targetDir, `${command.name}.md`);
        const content = this.generateCommandMarkdown(command);
        await fs.writeFile(filePath, content, 'utf8');
        createdFiles.push(filePath);
        logger.info(`Created Cursor command: ${filePath}`);
      }
      
      return {
        success: true,
        data: {
          installed: commands.length,
          directory: targetDir,
          commands: commands.map(c => c.name),
          files: createdFiles
        }
      };
    } catch (error) {
      logger.error('Failed to install Cursor commands:', error);
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

  private async ensureDirectoryPath(targetPath: string): Promise<void> {
    // Check if path contains .cursor/commands
    if (targetPath.includes('.cursor/commands') || targetPath.endsWith('.cursor/commands')) {
      // Ensure .cursor directory exists
      const cursorDir = targetPath.includes('.cursor/commands') 
        ? targetPath.substring(0, targetPath.indexOf('.cursor') + 7)  // Include .cursor
        : path.dirname(targetPath);
      
      await this.ensureDirectory(cursorDir);
      
      // Ensure commands subdirectory exists
      const commandsDir = path.join(cursorDir, 'commands');
      await this.ensureDirectory(commandsDir);
    } else {
      // For custom paths, create the entire path directly
      await this.ensureDirectory(targetPath);
    }
  }

  private generateCursorCommands(): CursorCommandConfig[] {
    return [
      {
        name: 'cdp-cli',
        description: 'Chrome DevTools Protocol CLI Tool',
        instructions: `Control Chrome browser through Chrome DevTools Protocol for browser automation.

## Available Commands

### JavaScript Execution
- **eval** - Execute JavaScript code and return results
  \`chrome-cdp-cli eval "document.title"\`
  \`chrome-cdp-cli eval "fetch('/api/data').then(r => r.json())"\`

### Screenshots and Snapshots
- **screenshot** - Capture page screenshot
  \`chrome-cdp-cli screenshot --filename page.png\`
  \`chrome-cdp-cli screenshot --filename fullpage.png --full-page\`

- **snapshot** - Capture complete DOM snapshot
  \`chrome-cdp-cli snapshot\`
  \`chrome-cdp-cli snapshot --filename dom-snapshot.txt\`

### Element Interaction
- **click** - Click page elements
  \`chrome-cdp-cli click "#submit-button"\`
  \`chrome-cdp-cli click ".menu-item" --timeout 10000\`

- **hover** - Mouse hover over elements
  \`chrome-cdp-cli hover "#dropdown-trigger"\`

- **fill** - Fill form fields
  \`chrome-cdp-cli fill "#username" "john@example.com"\`
  \`chrome-cdp-cli fill "input[name='password']" "secret123"\`

- **fill_form** - Batch fill forms
  \`chrome-cdp-cli fill_form '{"#username": "john", "#password": "secret"}'\`

### Advanced Interactions
- **drag** - Drag and drop operations
  \`chrome-cdp-cli drag "#draggable" "#dropzone"\`

- **press_key** - Simulate keyboard input
  \`chrome-cdp-cli press_key "Enter"\`
  \`chrome-cdp-cli press_key "a" --modifiers Ctrl --selector "#input"\`

- **upload_file** - File upload
  \`chrome-cdp-cli upload_file "input[type='file']" "./document.pdf"\`

- **wait_for** - Wait for elements to appear or meet conditions
  \`chrome-cdp-cli wait_for "#loading" --condition hidden\`
  \`chrome-cdp-cli wait_for "#submit-btn" --condition enabled\`

- **handle_dialog** - Handle browser dialogs
  \`chrome-cdp-cli handle_dialog accept\`
  \`chrome-cdp-cli handle_dialog accept --text "user input"\`

### Monitoring
- **console** - List console messages or get latest
  \`chrome-cdp-cli console --latest\`
  \`chrome-cdp-cli console --types error\`

- **network** - List network requests or get latest
  \`chrome-cdp-cli network --latest\`
  \`chrome-cdp-cli network --filter '{"methods":["POST"]}'\`

## Common Options

- \`--host <hostname>\`: Chrome DevTools host (default: localhost)
- \`--port <number>\`: Chrome DevTools port (default: 9222)
- \`--timeout <ms>\`: Command timeout

## Common Workflows

### Form Testing
\`\`\`bash
chrome-cdp-cli wait_for "#login-form" --condition visible
chrome-cdp-cli fill "#email" "test@example.com"
chrome-cdp-cli fill "#password" "password123"
chrome-cdp-cli click "#submit-button"
chrome-cdp-cli wait_for "#success-message" --condition visible
chrome-cdp-cli screenshot --filename login-success.png
chrome-cdp-cli console --types error
\`\`\`

### File Upload
\`\`\`bash
chrome-cdp-cli click "#upload-trigger"
chrome-cdp-cli upload_file "input[type='file']" "./test-document.pdf"
chrome-cdp-cli wait_for ".upload-success" --condition visible
chrome-cdp-cli eval "document.querySelector('.file-name').textContent"
\`\`\`

### Drag and Drop
\`\`\`bash
chrome-cdp-cli wait_for "#draggable-item" --condition visible
chrome-cdp-cli wait_for "#drop-zone" --condition visible
chrome-cdp-cli drag "#draggable-item" "#drop-zone"
chrome-cdp-cli eval "document.querySelector('#drop-zone').children.length"
\`\`\`

### Keyboard Input
\`\`\`bash
chrome-cdp-cli click "#search-input"
chrome-cdp-cli press_key "t"
chrome-cdp-cli press_key "e"
chrome-cdp-cli press_key "s"
chrome-cdp-cli press_key "t"
chrome-cdp-cli press_key "a" --modifiers Ctrl
chrome-cdp-cli press_key "Enter"
chrome-cdp-cli handle_dialog accept
\`\`\``,
        examples: [
          'chrome-cdp-cli eval "document.title"',
          'chrome-cdp-cli screenshot --filename page.png',
          'chrome-cdp-cli click "#submit-button"',
          'chrome-cdp-cli fill "#username" "test@example.com"',
          'chrome-cdp-cli drag "#item" "#target"',
          'chrome-cdp-cli press_key "Enter"',
          'chrome-cdp-cli upload_file "input[type=file]" "./doc.pdf"',
          'chrome-cdp-cli wait_for "#loading" --condition hidden',
          'chrome-cdp-cli handle_dialog accept',
          'chrome-cdp-cli console --latest',
          'chrome-cdp-cli network'
        ]
      }
    ];
  }

  private generateCommandMarkdown(command: CursorCommandConfig): string {
    const examples = command.examples.map(example => `- ${example}`).join('\n');
    
    return `# ${command.description}

${command.instructions}

## Usage Examples

${examples}
`;
  }

  /**
   * Get command help text
   */
  getHelp(): string {
    return `
install-cursor-command - Install Cursor IDE commands for Chrome browser automation

Usage:
  install-cursor-command
  install-cursor-command --target-directory /path/to/.cursor/commands
  install-cursor-command --force

Arguments:
  --target-directory <path>   Custom installation directory (default: .cursor/commands)
  --include-examples          Include example usage (default: true)
  --force                     Force installation without directory validation

Description:
  Installs a unified Cursor command file (cdp-cli.md) that provides Chrome browser
  automation capabilities directly within Cursor IDE. The command includes:

  • JavaScript execution in browser context
  • Screenshot capture and DOM snapshots
  • Console and network monitoring
  • Complete automation workflows
  • Comprehensive examples and documentation

Directory Validation:
  By default, the command checks for a .cursor directory to ensure you're in a
  Cursor project root. Use --force to bypass this validation or --target-directory
  to specify a custom location.

Examples:
  # Install in current project (requires .cursor directory)
  install-cursor-command

  # Install with custom directory
  install-cursor-command --target-directory /path/to/.cursor/commands

  # Force install without validation
  install-cursor-command --force

  # After installation, use in Cursor with:
  /cdp-cli

Note:
  The installed command provides powerful browser automation through the eval
  approach, which is ideal for LLM-assisted development as it allows writing
  and testing JavaScript automation scripts quickly and flexibly.
`;
  }
}
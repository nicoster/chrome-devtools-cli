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
      
      // 检查是否在 Cursor 项目根目录
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
      
      // 确保目录存在 - 改进逻辑以检查 .cursor/commands 路径
      await this.ensureDirectoryPath(targetDir);
      
      // 生成命令配置
      const commands = this.generateCursorCommands();
      
      // 创建命令文件
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
    // 检查路径是否包含 .cursor/commands
    if (targetPath.includes('.cursor/commands') || targetPath.endsWith('.cursor/commands')) {
      // 确保 .cursor 目录存在
      const cursorDir = targetPath.includes('.cursor/commands') 
        ? targetPath.substring(0, targetPath.indexOf('.cursor') + 7)  // 包含 .cursor
        : path.dirname(targetPath);
      
      await this.ensureDirectory(cursorDir);
      
      // 确保 commands 子目录存在
      const commandsDir = path.join(cursorDir, 'commands');
      await this.ensureDirectory(commandsDir);
    } else {
      // 对于自定义路径，直接创建整个路径
      await this.ensureDirectory(targetPath);
    }
  }

  private generateCursorCommands(): CursorCommandConfig[] {
    return [
      {
        name: 'cdp-cli',
        description: 'Chrome DevTools Protocol CLI 工具',
        instructions: `通过 Chrome DevTools Protocol 控制 Chrome 浏览器，支持多种自动化操作。

## 功能列表

### 1. JavaScript 执行 (eval)
执行 JavaScript 代码并返回结果，支持异步代码和 Promise。

**用途：**
- 获取页面信息（标题、URL、元素等）
- 修改页面内容和样式
- 执行复杂的 JavaScript 逻辑
- 与页面元素交互

**示例：**
- \`chrome-cdp-cli eval "document.title"\`
- \`chrome-cdp-cli eval "window.location.href"\`
- \`chrome-cdp-cli eval "document.querySelector('#button').click()"\`
- \`chrome-cdp-cli eval "fetch('/api/data').then(r => r.json())"\`

### 2. 页面截图 (screenshot)
捕获当前页面的截图并保存到指定文件。

**功能：**
- 指定文件名和路径
- 全页面截图或视口截图
- 自定义图片质量和格式
- 输出 PNG 格式文件

**示例：**
- \`chrome-cdp-cli screenshot --filename screenshot.png\`
- \`chrome-cdp-cli screenshot --filename fullpage.png --full-page\`
- \`chrome-cdp-cli screenshot --filename reports/page-capture.png\`

### 3. DOM 快照 (snapshot)
捕获包含 DOM 结构、样式和布局信息的完整快照。

**包含内容：**
- 完整的 DOM 树结构
- 计算后的 CSS 样式
- 元素布局信息
- 元素属性和文本内容

**示例：**
- \`chrome-cdp-cli snapshot --filename dom-snapshot.json\`
- \`chrome-cdp-cli snapshot --filename page-structure.json\`

### 4. 控制台监控 (console)
获取浏览器控制台的消息，包括日志、警告和错误。

**功能：**
- 获取最新的控制台消息
- 列出所有控制台消息
- 按类型过滤消息（log、warn、error）
- 调试和监控页面运行状态

**示例：**
- \`chrome-cdp-cli get_console_message\`
- \`chrome-cdp-cli list_console_messages --type error\`

### 5. 网络请求监控 (network)
监控和获取页面的网络请求信息。

**功能：**
- 获取最新的网络请求
- 列出所有网络请求
- 按方法过滤请求（GET、POST 等）
- 查看请求和响应详情
- 分析页面的网络行为和 API 调用

**示例：**
- \`chrome-cdp-cli get_network_request\`
- \`chrome-cdp-cli list_network_requests --method POST\`

命令会自动连接到运行在 localhost:9222 的 Chrome 实例。`,
        examples: [
          'chrome-cdp-cli eval "document.title"',
          'chrome-cdp-cli screenshot --filename page.png',
          'chrome-cdp-cli snapshot --filename dom.json',
          'chrome-cdp-cli get_console_message',
          'chrome-cdp-cli list_network_requests'
        ]
      }
    ];
  }

  private generateCommandMarkdown(command: CursorCommandConfig): string {
    const examples = command.examples.map(example => `- ${example}`).join('\n');
    
    return `# ${command.description}

${command.instructions}

## 使用示例

${examples}

## 前置条件

确保 Chrome 浏览器已启动并开启了远程调试：

\`\`\`bash
chrome --remote-debugging-port=9222
\`\`\`

或者在 macOS 上：

\`\`\`bash
/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222
\`\`\`

## 全局选项

所有命令都支持以下全局选项：

- \`--host <hostname>\`: Chrome DevTools 主机地址 (默认: localhost)
- \`--port <number>\`: Chrome DevTools 端口 (默认: 9222)
- \`--format <json|text>\`: 输出格式 (默认: json)
- \`--verbose\`: 启用详细日志
- \`--quiet\`: 静默模式
- \`--timeout <ms>\`: 命令超时时间

## 常用工作流程

### 网页自动化测试
\`\`\`bash
# 1. 导航到页面并截图
chrome-cdp-cli eval "window.location.href = 'https://example.com'"
chrome-cdp-cli screenshot --filename before.png

# 2. 填写表单
chrome-cdp-cli eval "document.querySelector('#email').value = 'test@example.com'"
chrome-cdp-cli eval "document.querySelector('#password').value = 'password123'"

# 3. 提交并检查结果
chrome-cdp-cli eval "document.querySelector('#submit').click()"
chrome-cdp-cli screenshot --filename after.png
chrome-cdp-cli list_console_messages --type error
\`\`\`

### API 调用监控
\`\`\`bash
# 1. 开始监控网络请求
chrome-cdp-cli eval "fetch('/api/users').then(r => r.json())"

# 2. 查看网络请求
chrome-cdp-cli list_network_requests --method POST

# 3. 获取最新请求详情
chrome-cdp-cli get_network_request
\`\`\`

### 页面分析
\`\`\`bash
# 1. 获取页面基本信息
chrome-cdp-cli eval "({title: document.title, url: location.href, links: document.querySelectorAll('a').length})"

# 2. 捕获完整页面结构
chrome-cdp-cli snapshot --filename page-analysis.json

# 3. 检查控制台错误
chrome-cdp-cli list_console_messages --type error
\`\`\`
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
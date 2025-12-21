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
        instructions: `通过 Chrome DevTools Protocol 控制 Chrome 浏览器，支持完整的自动化操作。

## 完整命令列表

### 1. JavaScript 执行
- **eval** - 执行 JavaScript 代码并返回结果，支持异步代码和 Promise
  \`chrome-cdp-cli eval "document.title"\`
  \`chrome-cdp-cli eval "fetch('/api/data').then(r => r.json())"\`

### 2. 页面截图和快照
- **screenshot** - 捕获页面截图并保存到文件
  \`chrome-cdp-cli screenshot --filename page.png\`
  \`chrome-cdp-cli screenshot --filename fullpage.png --full-page\`

- **snapshot** - 捕获完整 DOM 快照（包含结构、样式、布局）
  \`chrome-cdp-cli snapshot --filename dom-snapshot.json\`

### 3. 元素交互
- **click** - 点击页面元素
  \`chrome-cdp-cli click "#submit-button"\`
  \`chrome-cdp-cli click ".menu-item" --timeout 10000\`

- **hover** - 鼠标悬停在元素上
  \`chrome-cdp-cli hover "#dropdown-trigger"\`

- **fill** - 填充表单字段
  \`chrome-cdp-cli fill "#username" "john@example.com"\`
  \`chrome-cdp-cli fill "input[name='password']" "secret123"\`

- **fill_form** - 批量填充表单
  \`chrome-cdp-cli fill_form '{"#username": "john", "#password": "secret"}'\`

### 4. 高级交互
- **drag** - 拖拽操作
  \`chrome-cdp-cli drag "#draggable" "#dropzone"\`

- **press_key** - 模拟键盘输入
  \`chrome-cdp-cli press_key "Enter"\`
  \`chrome-cdp-cli press_key "a" --modifiers Ctrl --selector "#input"\`

- **upload_file** - 文件上传
  \`chrome-cdp-cli upload_file "input[type='file']" "./document.pdf"\`

- **wait_for** - 等待元素出现或满足条件
  \`chrome-cdp-cli wait_for "#loading" --condition hidden\`
  \`chrome-cdp-cli wait_for "#submit-btn" --condition enabled\`

- **handle_dialog** - 处理浏览器对话框
  \`chrome-cdp-cli handle_dialog accept\`
  \`chrome-cdp-cli handle_dialog accept --text "user input"\`

### 5. 监控功能
- **get_console_message** - 获取最新控制台消息
  \`chrome-cdp-cli get_console_message\`

- **list_console_messages** - 列出所有控制台消息
  \`chrome-cdp-cli list_console_messages --type error\`

- **get_network_request** - 获取最新网络请求
  \`chrome-cdp-cli get_network_request\`

- **list_network_requests** - 列出所有网络请求
  \`chrome-cdp-cli list_network_requests --method POST\`

### 6. IDE 集成
- **install_cursor_command** - 安装 Cursor 命令
  \`chrome-cdp-cli install_cursor_command\`

- **install_claude_skill** - 安装 Claude 技能
  \`chrome-cdp-cli install_claude_skill --skill-type personal\`

## 常用工作流程

### 完整的表单测试流程
\`\`\`bash
# 1. 等待页面加载
chrome-cdp-cli wait_for "#login-form" --condition visible

# 2. 填写表单
chrome-cdp-cli fill "#email" "test@example.com"
chrome-cdp-cli fill "#password" "password123"

# 3. 提交表单
chrome-cdp-cli click "#submit-button"

# 4. 等待结果并截图
chrome-cdp-cli wait_for "#success-message" --condition visible
chrome-cdp-cli screenshot --filename login-success.png

# 5. 检查控制台错误
chrome-cdp-cli list_console_messages --type error
\`\`\`

### 文件上传测试
\`\`\`bash
# 1. 点击上传按钮
chrome-cdp-cli click "#upload-trigger"

# 2. 上传文件
chrome-cdp-cli upload_file "input[type='file']" "./test-document.pdf"

# 3. 等待上传完成
chrome-cdp-cli wait_for ".upload-success" --condition visible

# 4. 验证结果
chrome-cdp-cli eval "document.querySelector('.file-name').textContent"
\`\`\`

### 拖拽交互测试
\`\`\`bash
# 1. 等待元素可用
chrome-cdp-cli wait_for "#draggable-item" --condition visible
chrome-cdp-cli wait_for "#drop-zone" --condition visible

# 2. 执行拖拽
chrome-cdp-cli drag "#draggable-item" "#drop-zone"

# 3. 验证拖拽结果
chrome-cdp-cli eval "document.querySelector('#drop-zone').children.length"
\`\`\`

### 键盘导航测试
\`\`\`bash
# 1. 聚焦到输入框
chrome-cdp-cli click "#search-input"

# 2. 输入文本
chrome-cdp-cli press_key "t"
chrome-cdp-cli press_key "e"
chrome-cdp-cli press_key "s"
chrome-cdp-cli press_key "t"

# 3. 使用快捷键
chrome-cdp-cli press_key "a" --modifiers Ctrl  # 全选
chrome-cdp-cli press_key "Enter"  # 提交

# 4. 处理可能的确认对话框
chrome-cdp-cli handle_dialog accept
\`\`\`

命令会自动连接到运行在 localhost:9222 的 Chrome 实例。`,
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
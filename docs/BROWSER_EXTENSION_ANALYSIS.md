# 浏览器扩展方案可行性分析

## 问题

参考 `consolespy` 的方案，为 chrome-cdp-cli 添加浏览器扩展来捕获控制台消息是否可行？

## consolespy 架构分析

### 核心组件

1. **Chrome 扩展（Content Script）**
   - 在页面加载时注入
   - 拦截 `console.log/warn/error` 等 API
   - 将消息发送到后台服务器

2. **后台服务器**
   - 接收扩展发送的控制台消息
   - 持久化存储（内存/数据库）
   - 提供查询接口

3. **MCP 服务器**
   - 连接到后台服务器
   - 提供 MCP 协议接口
   - 供 Cursor/Claude 等工具调用

### 数据流

```
页面加载 → 扩展注入 → 拦截 console API → 发送到服务器 → 持久化存储
                                                          ↓
用户查询 → MCP 服务器 → 查询后台服务器 → 返回历史消息
```

## 为 chrome-cdp-cli 添加扩展的可行性分析

### ✅ 技术可行性：**完全可行**

#### 1. 扩展开发
- **技术栈**：Chrome Extension Manifest V3
- **实现难度**：中等
- **核心功能**：
  ```javascript
  // content script
  const originalLog = console.log;
  console.log = function(...args) {
    // 发送到后台服务器
    chrome.runtime.sendMessage({
      type: 'console',
      level: 'log',
      args: args,
      timestamp: Date.now()
    });
    originalLog.apply(console, args);
  };
  ```

#### 2. 与现有架构集成

**方案 A：独立服务器模式（类似 consolespy）**
```
Chrome 扩展 → HTTP/WebSocket 服务器 → 持久化存储
                                      ↓
chrome-cdp-cli → 查询服务器 → 获取历史消息
```

**方案 B：CDP 集成模式**
```
Chrome 扩展 → 通过 CDP 发送消息 → chrome-cdp-cli 接收
```

**方案 C：混合模式**
```
Chrome 扩展 → 本地存储（localStorage/IndexedDB）
                                      ↓
chrome-cdp-cli → 通过 CDP eval 读取 → 获取历史消息
```

### ✅ 架构影响分析

#### 优点

1. **解决历史消息问题**
   - ✅ 可以从页面加载开始捕获所有消息
   - ✅ 不依赖 CDP 事件监听时机
   - ✅ 可以获取完整的控制台历史

2. **持久化存储**
   - ✅ 消息可以跨命令保存
   - ✅ 支持查询历史时间范围
   - ✅ 可以存储大量消息

3. **功能增强**
   - ✅ 可以捕获页面错误（window.onerror）
   - ✅ 可以捕获网络错误
   - ✅ 可以捕获未处理的 Promise rejection

#### 缺点和挑战

1. **架构复杂度增加**
   - ❌ 需要维护扩展代码
   - ❌ 需要服务器组件（如果选择方案 A）
   - ❌ 需要处理扩展安装和更新

2. **设计哲学冲突**
   - ⚠️ **与 eval-first 设计冲突**
   - ⚠️ 增加了依赖（需要安装扩展）
   - ⚠️ 偏离了"零依赖、纯 CDP"的设计理念

3. **用户体验影响**
   - ❌ 用户需要手动安装扩展
   - ❌ 扩展需要权限（可能引起隐私担忧）
   - ❌ 跨浏览器兼容性问题（只支持 Chrome）

4. **技术挑战**
   - ⚠️ 扩展注入时机（需要在页面加载前）
   - ⚠️ 跨域页面限制
   - ⚠️ 扩展与页面脚本的隔离

### 🔄 三种实现方案对比

| 特性 | 方案 A: 独立服务器 | 方案 B: CDP 集成 | 方案 C: 本地存储 |
|------|-------------------|-----------------|-----------------|
| **复杂度** | 高 | 中 | 低 |
| **持久化** | ✅ 完整 | ⚠️ 依赖连接 | ✅ 完整 |
| **依赖** | 需要服务器 | 纯 CDP | 纯 CDP |
| **性能** | 好 | 中 | 好 |
| **实现难度** | 高 | 中 | 低 |
| **设计一致性** | ❌ 偏离 | ✅ 一致 | ✅ 一致 |

### 🎯 推荐方案：方案 C（本地存储 + CDP eval）

#### 实现思路

1. **扩展功能**：
   - 拦截 console API
   - 存储到 `window._chromeCdpCliConsoleLogs`（页面上下文）
   - 或使用 `chrome.storage.local`（扩展上下文）

2. **CLI 集成**：
   ```bash
   # 通过 eval 读取扩展存储的消息
   chrome-cdp-cli eval "window._chromeCdpCliConsoleLogs || []"
   ```

3. **优势**：
   - ✅ 保持 eval-first 设计
   - ✅ 无需额外服务器
   - ✅ 用户可选择安装扩展（可选功能）
   - ✅ 向后兼容（不安装扩展也能用）

#### 实现细节

**扩展代码（content script）**：
```javascript
// 在页面加载时注入
(function() {
  if (window._chromeCdpCliConsoleLogs) return; // 已注入
  
  window._chromeCdpCliConsoleLogs = [];
  
  ['log', 'info', 'warn', 'error', 'debug'].forEach(method => {
    const original = console[method];
    console[method] = function(...args) {
      window._chromeCdpCliConsoleLogs.push({
        type: method,
        args: args,
        timestamp: Date.now(),
        stack: new Error().stack
      });
      original.apply(console, args);
    };
  });
})();
```

**CLI 命令增强**：
```typescript
// 在 list_console_messages 中
async execute(client: CDPClient, args: unknown) {
  // 1. 尝试通过 CDP 获取（现有方式）
  const cdpMessages = await this.getCDPMessages();
  
  // 2. 尝试通过 eval 获取扩展存储的消息
  const extensionMessages = await client.send('Runtime.evaluate', {
    expression: 'window._chromeCdpCliConsoleLogs || []'
  });
  
  // 3. 合并结果
  return [...extensionMessages, ...cdpMessages];
}
```

### ⚠️ 设计哲学考虑

#### 核心冲突

**chrome-cdp-cli 的设计哲学**：
- ✅ Eval-first：优先使用 JavaScript 执行
- ✅ 零依赖：无需安装额外组件
- ✅ 纯 CDP：只使用 Chrome DevTools Protocol
- ✅ LLM 优化：让 LLM 写 JavaScript 脚本

**添加扩展的影响**：
- ⚠️ 需要用户安装扩展（增加依赖）
- ⚠️ 偏离纯 CDP 实现
- ✅ 但可以通过可选方式实现（不强制安装）

#### 折中方案

**可选扩展模式**：
1. 核心功能保持纯 CDP（不依赖扩展）
2. 扩展作为**可选增强功能**
3. 如果检测到扩展，自动使用扩展存储的消息
4. 如果没有扩展，回退到现有 CDP 方式

### 📦 Extension 子命令设计

如果实施扩展功能，建议使用统一的 `extension` 子命令来管理扩展：

```bash
chrome-cdp-cli extension <subcommand> [options]
```

#### 子命令：`extension install`

安装 Chrome 扩展。

**命令格式**：
```bash
chrome-cdp-cli extension install [options]
```

**选项**：
- `--method <method>`: 安装方式
  - `store` (默认): 从 Chrome Web Store 安装
  - `local`: 从本地文件安装（开发模式）
  - `unpacked`: 加载未打包扩展（开发模式）
- `--path <path>`: 本地扩展路径（`local`/`unpacked` 模式必需）
- `--id <id>`: 扩展 ID（用于检测，默认从配置读取）
- `--force`: 强制重新安装（即使已安装）

**使用示例**：
```bash
# 从 Chrome Web Store 安装（默认）
chrome-cdp-cli extension install

# 从本地文件安装（开发模式）
chrome-cdp-cli extension install --method local --path ./chrome-cdp-cli-extension/dist

# 加载未打包扩展（开发调试）
chrome-cdp-cli extension install --method unpacked --path ./chrome-cdp-cli-extension

# 强制重新安装
chrome-cdp-cli extension install --force
```

**实现逻辑**：
```typescript
async execute(args: unknown): Promise<CommandResult> {
  const params = args as {
    method?: 'store' | 'local' | 'unpacked';
    path?: string;
    id?: string;
    force?: boolean;
  };

  // 1. 检查 Chrome 是否运行
  if (!await this.checkChromeRunning()) {
    return {
      success: false,
      error: 'Chrome is not running. Start Chrome with --remote-debugging-port=9222'
    };
  }

  // 2. 检查扩展是否已安装（除非 --force）
  if (!params.force && await this.checkExtensionInstalled()) {
    return {
      success: true,
      data: {
        message: 'Extension already installed',
        version: await this.getExtensionVersion()
      }
    };
  }

  // 3. 根据方法安装
  try {
    switch (params.method || 'store') {
      case 'store':
        await this.installFromStore();
        break;
      case 'local':
        if (!params.path) {
          throw new Error('--path is required for local installation');
        }
        await this.installFromLocal(params.path);
        break;
      case 'unpacked':
        if (!params.path) {
          throw new Error('--path is required for unpacked installation');
        }
        await this.installUnpacked(params.path);
        break;
    }

    // 4. 验证安装
    const verified = await this.verifyInstallation();
    if (!verified) {
      throw new Error('Extension installation verification failed');
    }

    return {
      success: true,
      data: {
        message: 'Extension installed successfully',
        version: await this.getExtensionVersion(),
        method: params.method || 'store'
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Installation failed'
    };
  }
}
```

#### 子命令：`extension uninstall`

卸载 Chrome 扩展。

**命令格式**：
```bash
chrome-cdp-cli extension uninstall [options]
```

**选项**：
- `--confirm`: 跳过确认提示（用于脚本自动化）
- `--id <id>`: 指定要卸载的扩展 ID（默认从配置读取）

**使用示例**：
```bash
# 交互式卸载（会提示确认）
chrome-cdp-cli extension uninstall

# 自动确认卸载（用于脚本）
chrome-cdp-cli extension uninstall --confirm
```

**实现逻辑**：
```typescript
async execute(args: unknown): Promise<CommandResult> {
  const params = args as {
    confirm?: boolean;
    id?: string;
  };

  // 1. 检查扩展是否已安装
  const extensionId = params.id || await this.getExtensionId();
  if (!await this.checkExtensionInstalled(extensionId)) {
    return {
      success: true,
      data: { message: 'Extension is not installed' }
    };
  }

  // 2. 确认卸载（除非 --confirm）
  if (!params.confirm) {
    const confirmed = await this.promptConfirmation(
      `Are you sure you want to uninstall the extension? (y/N)`
    );
    if (!confirmed) {
      return {
        success: true,
        data: { message: 'Uninstallation cancelled' }
      };
    }
  }

  // 3. 执行卸载
  try {
    await this.uninstallExtension(extensionId);
    return {
      success: true,
      data: { message: 'Extension uninstalled successfully' }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Uninstallation failed'
    };
  }
}
```

#### 子命令：`extension status`

检查扩展的安装状态和版本信息。

**命令格式**：
```bash
chrome-cdp-cli extension status [options]
```

**选项**：
- `--id <id>`: 指定扩展 ID（默认从配置读取）
- `--json`: 以 JSON 格式输出

**使用示例**：
```bash
# 检查扩展状态（文本格式）
chrome-cdp-cli extension status

# 检查扩展状态（JSON 格式）
chrome-cdp-cli extension status --json
```

**输出示例**：

**文本格式**：
```
Extension Status:
  Installed: ✅ Yes
  Version: 1.0.0
  Active: ✅ Yes
  Last Check: 2024-01-01T00:00:00Z
  Method: store
```

**JSON 格式**：
```json
{
  "installed": true,
  "version": "1.0.0",
  "active": true,
  "lastCheck": "2024-01-01T00:00:00Z",
  "method": "store",
  "id": "chrome-cdp-cli-extension-id"
}
```

**实现逻辑**：
```typescript
async execute(args: unknown): Promise<CommandResult> {
  const params = args as {
    id?: string;
    json?: boolean;
  };

  const extensionId = params.id || await this.getExtensionId();

  try {
    const status = {
      installed: await this.checkExtensionInstalled(extensionId),
      version: null as string | null,
      active: false,
      lastCheck: new Date().toISOString(),
      method: await this.getInstallationMethod(extensionId),
      id: extensionId
    };

    if (status.installed) {
      status.version = await this.getExtensionVersion(extensionId);
      status.active = await this.checkExtensionActive(extensionId);
    }

    return {
      success: true,
      data: status,
      format: params.json ? 'json' : 'text'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check extension status'
    };
  }
}
```

#### 扩展检测辅助方法

**检测扩展是否安装**：
```typescript
async checkExtensionInstalled(extensionId?: string): Promise<boolean> {
  const id = extensionId || await this.getExtensionId();
  
  try {
    // 方法 1: 通过 CDP 检测扩展注入的全局变量
    const result = await this.client.send('Runtime.evaluate', {
      expression: `
        (function() {
          return typeof window._chromeCdpCliConsoleLogs !== 'undefined';
        })()
      `
    });
    
    if (result.value === true) {
      return true;
    }

    // 方法 2: 通过 Chrome Extension Management API（如果可用）
    // 这需要特殊权限，可能不可用
    try {
      const extensions = await this.queryChromeExtensions();
      return extensions.some(ext => ext.id === id);
    } catch {
      // API 不可用，回退到方法 1 的结果
      return false;
    }
  } catch (error) {
    return false;
  }
}
```

**获取扩展版本**：
```typescript
async getExtensionVersion(extensionId?: string): Promise<string | null> {
  try {
    // 通过 CDP eval 读取扩展版本标记
    const result = await this.client.send('Runtime.evaluate', {
      expression: 'window._chromeCdpCliExtensionVersion || null'
    });
    return result.value;
  } catch {
    return null;
  }
}
```

### 📊 实施建议

#### 阶段 1：评估需求
- [ ] 确认用户对历史消息的需求强度
- [ ] 调研是否有其他纯 CDP 方案
- [ ] 评估开发成本 vs 收益

#### 阶段 2：原型验证（如果决定实施）
- [ ] 开发最小化扩展原型
- [ ] 实现 `extension install/uninstall/status` 命令
- [ ] 验证与 CLI 的集成
- [ ] 测试性能和稳定性

#### 阶段 3：可选功能实现
- [ ] 实现方案 C（本地存储 + eval）
- [ ] 完善扩展检测机制
- [ ] 保持向后兼容
- [ ] 提供清晰的安装和使用文档

### 🎯 结论

**技术可行性**：✅ **完全可行**

**推荐方案**：
1. **短期**：继续使用 eval-first 方案（文档中已说明）
2. **中期**：如果需求强烈，实现**可选扩展**（方案 C）
3. **长期**：评估是否需要完整服务器方案（方案 A）

**关键原则**：
- ✅ 保持 eval-first 设计哲学
- ✅ 扩展作为可选增强，不强制依赖
- ✅ 保持向后兼容性
- ✅ 优先考虑 LLM 工作流优化

**实施优先级**：**低**
- 当前 eval 方案已能满足大部分需求
- 扩展方案增加复杂度，收益有限
- 建议先观察用户反馈，再决定是否实施


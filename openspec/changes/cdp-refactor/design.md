## Context

`chrome-devtools-cli` 现有架构中，`console` 与 `network` 命令同时支持两种模式：
1. **快照模式**：通过 Proxy 子进程（`CDPProxyServer`）积累历史数据，再通过 HTTP API 一次性返回
2. **follow 模式**：直接连接 CDP，实时流式输出

这导致以下问题：
- 每次命令调用都触发 `ProxyManager.ensureProxyReady()`，可能启动一个隐藏的 Express+WebSocket 子进程（端口 9223），启动延迟最高 10s
- 用户无感知地使用了一个后台进程，调试困难
- Proxy 架构（ConnectionPool、MessageStore、CDPEventMonitor、WSProxy、SecurityManager 等）代码量庞大，却只为了解决"CLI 工具拿不到历史数据"这一个问题
- `network` 命令的 `filter` 参数嵌套在对象里，CLI 场景无法直接使用

重构依据：CLI 工具的核心使用场景是**开发者实时调试**，不需要历史数据持久化。follow 模式已经满足全部需求。

## Goals / Non-Goals

**Goals:**
- 删除 `CLIApplication` 中对 `ProxyManager` 的依赖，CLI 启动零隐藏进程
- `log`（原 `console`）和 `network` 命令统一为 follow-only：连接即 watch，Ctrl+C 退出
- `NetworkMonitor` 具备实时事件回调能力（与 `ConsoleMonitor` 对齐）
- `network` 命令过滤参数平铺为顶层 CLI flags
- `screenshot` 无 filename 时直接输出图片二进制到 stdout，不经过 `OutputManager`
- `screenshot` 自身的 `--format` 改名为 `--image-format`，消除与全局 `--format` 的歧义
- 新增 `cdp` 二进制别名，帮助文档统一自称 `CDP`

**Non-Goals:**
- 不删除 Proxy 服务器本身代码（`src/proxy/server/`），仅解除主 CLI 流程对它的依赖；`RestartProxyHandler` 等高级功能保留
- 不重写 `CDPClient` 或底层连接管理逻辑
- 不改变 `screenshot --filename` 有文件名时的行为
- 不改变其他命令（`eval`、`click`、`fill` 等）

## Decisions

### D1：log/network 完全 follow-only，删除快照接口

**决策**：`execute()` 方法直接进入 follow 模式，不再有任何分支判断，删除 `tryProxyExecution()`、`executeDirectCDP()` 等历史查询路径。

**理由**：CLI 工具的使用场景天然是实时的。快照模式需要先有数据积累（proxy 已在运行），这对 CLI 来说是隐式前提条件，用户体验差。follow 模式无此前提，连接即用。

**备选方案**：保留快照模式作为可选路径 → 否决，因为维护两条路径的复杂度高于收益。

### D2：NetworkMonitor 新增 onRequest/offRequest 回调

**决策**：在 `NetworkMonitor` 中仿照 `ConsoleMonitor.onMessage()` 的模式，添加：
```typescript
onRequest(callback: (request: NetworkRequest) => void): void
offRequest(callback: (request: NetworkRequest) => void): void
```
回调在 `handleLoadingFinished()` 和 `handleLoadingFailed()` 时触发（而非 `requestWillBeSent`）。

**理由**：`loadingFinished`/`loadingFailed` 时请求才完整（有 status code、duration、响应体大小），对用户更有价值。`requestWillBeSent` 时信息不完整。

### D3：screenshot 直接写 stdout，返回 `_rawOutput: true` 标记

**决策**：`TakeScreenshotHandler` 在无 filename 时调用 `process.stdout.write(Buffer.from(data, 'base64'))`，然后返回 `{ success: true, data: null, _rawOutput: true }`。`CLIApplication.outputResult()` 识别 `_rawOutput: true` 时跳过格式化输出。

**理由**：
- Handler 自主控制输出，不依赖 `OutputManager` 的扩展点
- `_rawOutput` 标记是最小侵入性方案，`OutputManager` 只需加一行判断
- 备选：在 `OutputManager` 中注册命令豁免列表 → 否决，耦合度更高

**screenshot --format 改名**：schema 中 screenshot 命令的 `format` 选项改为 `image-format`，Handler 参数接口同步更新。原因：全局 `--format` 控制输出格式（json/text），screenshot 的 `--format` 控制图片格式（png/jpeg），同名必然产生解析歧义。

### D4：cdp 别名通过 package.json bin 实现

**决策**：`package.json` 的 `bin` 字段增加 `"cdp": "dist/index.js"`，两个入口指向同一文件。

**理由**：最简实现，无需运行时判断。帮助文档改用 `cdp` 前缀后，用户通过 `cdp help` 即可获得清晰指引。

## Risks / Trade-offs

- **[Risk] 历史数据丢失**：follow-only 模式下，页面在命令启动前已发出的 console/network 事件永远无法获取 → **已知 trade-off，设计接受**，文档说明用户需在页面加载前启动 watch
- **[Risk] `-f` 短参数歧义**：`eval` 命令也用 `-f` 代表 `--file`，若解析器是全局的会冲突 → **需确认 `ArgumentParser` 的作用域**；若 per-command 则无问题，否则 `log` 命令的 `-f` 改用其他短名或去掉短名
- **[Risk] `stdout` 二进制污染**：`screenshot` 写二进制到 stdout 后，若调用方不是管道而是终端，会乱码 → **Mitigation**：检测 `process.stdout.isTTY`，若为 TTY 则提示用户加 `--filename` 或重定向
- **[Risk] 下游 AI 工具集成断裂**：Cursor skill / Claude skill 可能依赖 `console` 命令名或 JSON 快照返回格式 → **Mitigation**：保留 `console` 作为 `log` 的别名至少一个版本；更新 skill 文件

## Migration Plan

1. 变更代码（见 tasks.md）
2. 更新 `package.json` 版本号（minor bump，因有 breaking changes）
3. 更新 `README.md` 中的命令示例
4. 更新 `src/handlers/InstallCursorCommandHandler.ts` 和 `InstallClaudeSkillHandler.ts` 中内嵌的 skill 文本
5. 发布后在 CHANGELOG 中明确标注 breaking changes

**Rollback**：git revert 即可，无数据库迁移或外部状态变更。

## Open Questions

- `ArgumentParser` 的短参数解析是 per-command 还是全局？需检查 `src/cli/ArgumentParser.ts` 以确认 `-f` 是否冲突
- `log` 是否需要保留 `--follow`/`-f` 短旗（语义上冗余，但符合 `tail -f` 用户习惯）？建议保留
- `network` 的 follow 输出格式：是否需要 `--format pretty` 的颜色高亮？建议与 `log` 对齐，默认 text，支持 pretty

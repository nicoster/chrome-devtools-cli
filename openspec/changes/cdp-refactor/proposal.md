## Why

`chrome-devtools-cli` 的命令行接口设计过于复杂：历史数据查询依赖一个隐藏的后台 Proxy 子进程、命令命名语义不清晰、`console` 和 `network` 命令混淆了"快照查询"与"实时监控"两种截然不同的使用场景。此次重构目标是化繁为简——删除 Proxy 依赖、统一命令命名风格、明确每个命令的语义边界。

## What Changes

- **BREAKING** 新增 `cdp` 二进制别名（`package.json` bin 字段增加 `"cdp"`），`chrome-cdp-cli` 保留向后兼容
- **BREAKING** `console` 命令重命名为 `log`（`console` 作为别名保留一段时间）
- **BREAKING** `log` 与 `network` 命令改为 **follow-only 模式**：不再支持一次性历史快照查询，命令执行即进入实时 watch 状态，Ctrl+C 退出
- **BREAKING** 移除 `log`/`network` 命令中所有依赖 Proxy 的逻辑（`tryProxyExecution`、`ProxyClient` import）
- **BREAKING** `CLIApplication` 启动时不再自动调用 `ensureProxyReady()`，彻底去除隐式后台子进程
- `network` 命令的过滤参数从嵌套 `filter.xxx` 对象改为顶层平铺参数（`--methods`、`--urlPattern`、`--statusCodes`）
- `screenshot` 命令：不指定 `--filename` 时，直接将图片二进制写入 stdout；不再受全局 `--format` 参数影响；自身的图片格式参数从 `--format` 改名为 `--image-format` 以消除歧义
- 帮助文档、Usage 示例全部改用 `cdp` 作为命令名

## Capabilities

### New Capabilities

- `cdp-alias`: 新增 `cdp` 二进制别名，帮助文档自称 CDP
- `log-follow`: `log` 命令（原 `console`）重构为 follow-only 实时 watch 模式，直接通过 CDP 事件监听，无 Proxy 依赖
- `network-follow`: `network` 命令重构为 follow-only 实时 watch 模式，`NetworkMonitor` 新增 `onRequest` 回调机制，过滤参数平铺
- `screenshot-binary-output`: `screenshot` 命令无 filename 时直接输出图片二进制到 stdout，绕过 OutputManager 格式化

### Modified Capabilities

（无已有 spec，全部为新建）

## Impact

- **`package.json`**: 新增 `cdp` bin 入口
- **`src/cli/CLIApplication.ts`**: 删除 `ProxyManager` 实例化与 `ensureProxyReady()` 调用
- **`src/handlers/ListConsoleMessagesHandler.ts`**: handler name 改为 `log`，删除 proxy 路径和历史查询逻辑
- **`src/handlers/ListNetworkRequestsHandler.ts`**: 删除 proxy 路径和历史查询逻辑，改为 follow 模式，参数平铺
- **`src/handlers/TakeScreenshotHandler.ts`**: 无 filename 时直接写 stdout，`--format` 改名为 `--image-format`
- **`src/monitors/NetworkMonitor.ts`**: 新增 `onRequest`/`offRequest` 回调 API
- **`src/cli/CommandSchemaRegistry.ts`**: 同步更新所有受影响命令的 schema 定义
- **`src/cli/CommandRouter.ts`**: 更新命令描述表
- 下游影响：任何依赖 `console` 命令名或 Proxy API 的外部脚本需更新

## 1. cdp 别名与帮助品牌化

- [x] 1.1 在 `package.json` 的 `bin` 字段添加 `"cdp": "dist/index.js"`
- [x] 1.2 在 `CommandRouter.ts` 的 `generateGeneralHelp()` 中将标题改为 `CDP - Chrome DevTools Protocol CLI`，所有 usage 示例改用 `cdp` 前缀
- [x] 1.3 在 `CommandSchemaRegistry.ts` 中将所有 `usage` 字段的 `chrome-cdp-cli` 替换为 `cdp`
- [x] 1.4 在各 Handler 的 `getHelp()` 方法中将示例命令前缀改为 `cdp`

## 2. 移除 ProxyManager 依赖

- [x] 2.1 在 `CLIApplication.ts` 中删除 `this.proxyManager = ProxyManager.getInstance()` 及相关 import
- [x] 2.2 在 `CLIApplication.ts` 中删除 `await this.ensureProxyReady()` 调用（第 155 行附近）
- [x] 2.3 删除 `CLIApplication.ts` 中与 `proxyManager` 相关的所有成员变量、方法及调用链

## 3. log 命令重构（原 console）

- [x] 3.1 将 `ListConsoleMessagesHandler.ts` 中 `readonly name = 'console'` 改为 `readonly name = 'log'`，并在 schema/router 层添加 `console` 别名
- [x] 3.2 删除 `ListConsoleMessagesHandler.ts` 中 `tryProxyExecution()` 方法及所有 `ProxyClient` import
- [x] 3.3 删除 `ListConsoleMessagesHandler.ts` 中 `executeDirectCDP()` 方法（历史快照逻辑）
- [x] 3.4 将 `execute()` 方法重构为直接调用 `executeFollowMode()`，去掉 `shouldFollow` 分支判断
- [x] 3.5 删除 `params` 接口中的 `latest`、`maxMessages`、`startTime`、`endTime`、`startMonitoring` 字段
- [x] 3.6 更新 `validateArgs()` 方法，移除已删除参数的验证逻辑
- [x] 3.7 更新 `getHelp()` 方法，命令名改为 `log`，移除已删除参数的文档，示例改用 `cdp log`
- [x] 3.8 在 `CommandSchemaRegistry.ts` 中将 `console` schema 改名为 `log`，删除废弃的 options 定义

## 4. NetworkMonitor 回调支持

- [x] 4.1 在 `NetworkMonitor.ts` 中添加 `private requestCallbacks: Array<(request: NetworkRequest) => void> = []` 成员
- [x] 4.2 实现 `onRequest(callback)` 方法
- [x] 4.3 实现 `offRequest(callback)` 方法
- [x] 4.4 在 `handleLoadingFinished()` 中组装完整 `NetworkRequest` 后调用所有注册的回调
- [x] 4.5 在 `handleLoadingFailed()` 中构造失败请求对象后调用所有注册的回调

## 5. network 命令重构

- [x] 5.1 删除 `ListNetworkRequestsHandler.ts` 中 `tryProxyExecution()` 方法及所有 `ProxyClient` import
- [x] 5.2 删除 `ListNetworkRequestsHandler.ts` 中 `executeDirectCDP()` 方法（历史快照逻辑）
- [x] 5.3 将 `execute()` 方法重构为 follow 模式：初始化 `NetworkMonitor`，调用 `startMonitoring()`，注册 `onRequest` 回调，设置 SIGINT 处理，返回 `isLongRunning: true`
- [x] 5.4 将嵌套 `filter.methods/urlPattern/statusCodes` 参数改为顶层 `methods`、`urlPattern`、`statusCodes` 参数
- [x] 5.5 实现 network 请求的实时格式化输出（text/json/pretty，与 log 命令对齐）
- [x] 5.6 实现 URL pattern、method、status code 的实时过滤逻辑
- [x] 5.7 更新 `getHelp()` 方法，示例改用 `cdp network`，参数改为平铺格式
- [x] 5.8 在 `CommandSchemaRegistry.ts` 中将 network 命令的嵌套 filter options 改为平铺顶层 options

## 6. screenshot 二进制输出

- [x] 6.1 在 `TakeScreenshotHandler.ts` 中将 `--format` 参数改名为 `--image-format`（接口定义 `TakeScreenshotArgs.imageFormat`）
- [x] 6.2 更新 `buildScreenshotParams()` 中的参数读取，使用 `args.imageFormat`
- [x] 6.3 实现 TTY 检测：若 `process.stdout.isTTY && !args.filename`，打印 stderr 警告并以非零码退出
- [x] 6.4 实现无 filename 时的二进制 stdout 输出：`process.stdout.write(Buffer.from(data, 'base64'))`，返回 `{ success: true, data: null, _rawOutput: true }`
- [x] 6.5 在 `CLIApplication.outputResult()` 中添加对 `_rawOutput: true` 的判断，跳过 OutputManager 格式化
- [x] 6.6 在 `CommandSchemaRegistry.ts` 中将 screenshot 命令的 `format` option 改名为 `image-format`
- [x] 6.7 更新 `TakeScreenshotHandler.getHelp()` 中的参数文档

## 7. CommandRouter 更新

- [x] 7.1 在 `CommandRouter.getCommandDescription()` 中将 `'console'` key 改为 `'log'`，描述文字更新
- [x] 7.2 在 `CommandRouter.generateGeneralHelp()` 中更新 Examples 部分，使用新命令名
- [x] 7.3 确认 `executeWithTimeout()` 中 long-running 判断逻辑对 `log` 和 `network` 命令仍然有效

## 8. 测试更新

- [x] 8.1 更新 `ListConsoleMessagesHandler.test.ts`：删除 proxy 相关测试，添加 follow 模式单元测试
- [x] 8.2 为 `NetworkMonitor.ts` 的 `onRequest/offRequest` 回调添加单元测试
- [x] 8.3 为重构后的 `ListNetworkRequestsHandler` 添加 follow 模式测试
- [x] 8.4 为 `TakeScreenshotHandler` 添加二进制输出和 TTY 检测测试
- [x] 8.5 运行 `npm test` 确认所有测试通过

## 9. 收尾

- [x] 9.1 更新 `package.json` 版本号（minor bump）
- [x] 9.2 更新 `README.md` 中的命令示例，全部改用 `cdp` 前缀
- [x] 9.3 检查并更新 `InstallCursorCommandHandler.ts` 和 `InstallClaudeSkillHandler.ts` 中内嵌的 skill 文本
- [x] 9.4 运行 `npm run build` 验证编译通过

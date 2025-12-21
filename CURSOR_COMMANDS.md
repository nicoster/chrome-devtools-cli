Cursor 自定义 Chat 命令

自定义命令允许你为 Cursor 聊天框定义可复用的工作流程，这些命令可以通过在聊天输入框中打 / 前缀来触发。它们有助于将团队中的常用任务标准化，提高效率。
当前该功能仍处于测试阶段（Beta），语法或行为可能会变动。  ￼

⸻

🧠 命令如何工作
	•	命令是一些普通的 Markdown 文件，存放在你项目的 .cursor/commands 目录内。
	•	在聊天输入框中输入 / 时，Cursor 会自动扫描这个目录并展示可用命令。  ￼

⸻

📁 创建命令

命令创建步骤如下：
	1.	在项目根目录下创建目录：

.cursor/commands


	2.	在该目录下新增一个 .md 文件，例如：

`.cursor/commands/
├── review-code.md
├── write-tests.md
└── create-pr.md

✨ 文件名应具有描述性，便于识别对应命令功能。  ￼

	3.	使用 Markdown 编写这个命令所描述的工作流程或说明内容。  ￼
	4.	在聊天输入框中输入 / 即可看到这个命令并执行。  ￼

⸻

📌 示例命令

你可以尝试编写以下命令来熟悉工作方式：

# review-code.md
描述：
  为当前文件生成可执行的代码审查建议。

输出行为：
  - 自动生成审查结果
  - 可以一键插入建议

# run-tests.md
描述：
  运行当前项目的测试套件，并修复常见失败项（如果有）。

输出行为：
  - 输出测试结果
  - 自动修复可修复的错误

一些常见的命令示例：
	•	Code review checklist
	•	Security audit
	•	Setup new feature
	•	Create pull request
	•	Run tests and fix failures
	•	Onboard new developer  ￼

⸻

✅ 使用技巧
	•	命令可以作为团队共享的脚本提示，标准化重复性任务。  ￼
	•	你也可以将命令存放到版本控制中，让其他协作者共享。  ￼
	•	命令不仅可以触发 Cursor 聊天，还可结合终端或测试执行等流程自动化场景。  ￼

⸻

📄 文件示例（规范建议）

下面是一个更完整的命令文件模板：

# create-pr.md

# 标题
创建一个 pull request

## 描述
帮我为这次变更生成一个 Pull Request 的说明，并包含 conventional commit 格式信息。

## 参数（可选）
- @branch: 分支名称
- @issue: 关联 issue 编号

## 输出
1) PR 标题
2) PR 描述
3) 相关标签与检查项

## 行为
当命令执行后：
- 自动生成 pull request 文本
- 可粘贴到 GitHub 或其他托管平台界面


⸻

🧩 提示
	•	命令目前仍在 Beta 阶段，未来语法与功能可能更新。  ￼
	•	如果希望命令支持更复杂逻辑，可在 Markdown 内说明流程步骤或规范输出格式。  ￼

⸻

如需进一步扩展命令功能（例如全局命令目录、命令参数化、结合自动化脚本等），我也可以帮你写具体模板或示例！
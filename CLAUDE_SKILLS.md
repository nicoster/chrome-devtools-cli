下面是将 Claude Code “Skills” 文档（来自 https://code.claude.com/docs/en/skills） 改写成一个结构清晰的 Markdown (.md) 格式文档，方便在笔记、仓库 README 或 Wiki 中使用：

⸻

Claude Code Skills

Claude Code 的 Skills（技能）让你扩展 Claude 的能力，将专业知识、工作流程和自动化任务封装成可复用、可共享的模块。它们是模型自主调用的，不需要像命令一样手动触发。 ￼

⸻

🚀 能力简介

Skills 是什么？

Skills 是一组组织在文件夹内的说明、脚本和资源，用来扩展 Claude Code 的功能。当用户提出请求时，Claude 会自动判断是否需要某个 Skill 来完成任务，并据此加载相关内容。 ￼

优点
	•	自动应用专业流程和知识
	•	减少重复式提示
	•	能组合多个 Skills 完成复杂任务
	•	支持团队共享和版本控制 ￼

⸻

🧠 使用前提
	•	Claude Code 版本 ≥ 1.0
	•	熟悉基本的 Claude Code 使用流程 ￼

⸻

📁 Skills 类型

🔹 Personal Skills（个人 Skill）

用于个人工作流和实验性 Skill：

~/.claude/skills/my-skill-name/

适合：
	•	个人偏好/工作方式
	•	试验性 Skill
	•	只需自己使用的工具集 ￼

⸻

🔹 Project Skills（项目 Skill）

用于整个项目团队共享：

.claude/skills/my-team-skill/

适合：
	•	团队规范
	•	项目特定工具
	•	Git 管理和版本控制 ￼

⸻

🔹 Plugin Skills（插件 Skill）

安装插件后自动包含的 Skills，与其它 Skill 类型功能一致。 ￼

⸻

✍️ 创建一个 Skill

1. 目录结构

每个 Skill 是一个文件夹，必须包含一个 SKILL.md 文件：

my-skill/
├── SKILL.md        # 必需
├── reference.md    # 可选参考文档
├── examples.md     # 可选示例
├── scripts/        # 可选运行脚本
│   └── helper.py
└── templates/      # 可选模板
    └── template.txt
``` [oai_citation:7‡Claude Docs](https://docs.claude.com/en/docs/claude-code/skills?utm_source=chatgpt.com)

---

### 2. 编写 SKILL.md

`SKILL.md` 必须包含 **YAML frontmatter** 和 Markdown 内容：

```md
---
name: your-skill-name
description: 简洁描述这个 Skill 的用途和何时调用
---

# Your Skill Name

## Instructions
提供清晰步骤指导 Claude 如何使用此 Skill。

## Examples
展示典型用法示例。
``` [oai_citation:8‡Claude Docs](https://docs.claude.com/en/docs/claude-code/skills?utm_source=chatgpt.com)

**说明字段特别重要**：要包含 Skill 的用途与触发场景，帮助 Claude 发现和匹配。 [oai_citation:9‡Claude Docs](https://docs.claude.com/en/docs/claude-code/skills?utm_source=chatgpt.com)

---

### 3. 添加支持文件（可选）

在 `SKILL.md` 同级目录下可以放其他资源，例如脚本、文档、模板等，并在描述中引用它们：

```md
参见文档: [reference.md](reference.md)

执行辅助脚本:
```bash
python scripts/helper.py input.txt

---

## 🔒 限制工具访问

如果希望在 Skill 激活时限制 Claude 可用的工具，可以通过 `allowed-tools` 字段：

```md
---
name: safe-file-reader
description: Read files without making changes
allowed-tools: Read, Grep, Glob
---

# Safe File Reader

## Instructions
1. 使用 Read 工具查看内容
2. 使用 Grep 搜索模式
3. 使用 Glob 查找路径
``` [oai_citation:11‡Claude Docs](https://docs.claude.com/en/docs/claude-code/skills?utm_source=chatgpt.com)

这能让 Skill 在激活时只允许指定工具，提升安全性。 [oai_citation:12‡Claude Docs](https://docs.claude.com/en/docs/claude-code/skills?utm_source=chatgpt.com)

---

## 🔍 查看和测试 Skills

Skills 会自动被 Claude 发现：

```txt
What Skills are available?
List all available Skills

也可以在本地文件系统直接浏览：

ls ~/.claude/skills/
ls .claude/skills/
cat ~/.claude/skills/my-skill/SKILL.md
``` [oai_citation:13‡Claude Docs](https://docs.claude.com/en/docs/claude-code/skills?utm_source=chatgpt.com)

测试 Skill 是否被调用：

```txt
Can you help me extract text from this PDF?

如果请求与 Skill 描述匹配，Claude 会自动加载。 ￼

⸻

🛠 更新和移除 Skills

更新

编辑 SKILL.md 即可。重启 Claude Code 让修改生效：

code ~/.claude/skills/my-skill/SKILL.md

或

code .claude/skills/my-skill/SKILL.md
``` [oai_citation:15‡Claude Docs](https://docs.claude.com/en/docs/claude-code/skills?utm_source=chatgpt.com)

---

### 移除

删除 Skill 文件夹即可：

```bash
rm -rf ~/.claude/skills/my-skill
rm -rf .claude/skills/my-skill
``` [oai_citation:16‡Claude Docs](https://docs.claude.com/en/docs/claude-code/skills?utm_source=chatgpt.com)

---

## 📐 最佳实践

### ✨ 专注单一用途

每个 Skill 关注一个特定能力，例如：

**好：**

- PDF 文本提取
- Excel 数据分析
- 自动生成 Git 提交说明

**不建议：**

- “通用文档处理”
- “数据操作工具大全” [oai_citation:17‡Claude Docs](https://docs.claude.com/en/docs/claude-code/skills?utm_source=chatgpt.com)

---

### 🧠 描述要清晰具体

描述中应包含触发场景和关键术语，例如：

**好：**

```yaml
description: Analyze Excel spreadsheets, create pivot tables, and generate charts. Use when working with .xlsx files.

差：

description: Helps with files
``` [oai_citation:18‡Claude Docs](https://docs.claude.com/en/docs/claude-code/skills?utm_source=chatgpt.com)

---

## 🧪 排查和调试

| 问题 | 解决方向 |
|------|-----------|
| Claude 不调用 Skill | 检查描述是否具体、YAML 是否有效 |
| Skill 有错误 | 检查脚本权限、依赖是否正确安装 |
| 相似 Skills 冲突 | 提高描述区分度 | [oai_citation:19‡Claude Docs](https://docs.claude.com/en/docs/claude-code/skills?utm_source=chatgpt.com)

---

## 🧾 示例 Skill

### 📌 单文件 Skill

commit-helper/
└── SKILL.md

```md
---
name: generating-commit-messages
description: Generates clear commit messages from git diffs. Use when writing or reviewing commits.
---

# Generating Commit Messages

## Instructions
1. Run `git diff --staged`
2. Suggest commit message with summary, detail, and scope
``` [oai_citation:20‡Claude Docs](https://docs.claude.com/en/docs/claude-code/skills?utm_source=chatgpt.com)

---

### 📌 带工具权限的 Skill

code-reviewer/
└── SKILL.md

```md
---
name: code-reviewer
description: Review code for quality and issues
allowed-tools: Read, Grep, Glob
---

# Code Reviewer
## Checklist
1. Organization
2. Error handling
3. Performance
``` [oai_citation:21‡Claude Docs](https://docs.claude.com/en/docs/claude-code/skills?utm_source=chatgpt.com)

---

### 📌 多文件 Skill

pdf-processing/
├── SKILL.md
├── REFERENCE.md
├── FORMS.md
└── scripts/
└── fill_form.py

```md
---
name: pdf-processing
description: Extract, fill, and merge PDFs
---

# PDF Processing
## Quick start
```python
import pdfplumber

See [REFERENCE.md] for details.

---

## 📌 分享 Skills

将 Skills 加入项目仓库，通过插件或 Git 管理：

```bash
mkdir -p .claude/skills/team-skill
git add .claude/skills/
git commit -m "Add team Skill"
git push
``` [oai_citation:23‡Claude Docs](https://docs.claude.com/en/docs/claude-code/skills?utm_source=chatgpt.com)

---

如需我生成 **Skill 模板文件示例**、或把你现有流程转成 Skill 文件，我也可以帮你写出来 👍
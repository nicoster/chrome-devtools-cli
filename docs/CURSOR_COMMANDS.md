Cursor Custom Chat Commands

Custom commands allow you to define reusable workflows for the Cursor chat interface, which can be triggered by typing the / prefix in the chat input box. They help standardize common tasks within teams and improve efficiency.
This feature is currently in Beta stage, and syntax or behavior may change.

⸻

🧠 How Commands Work
	•	Commands are simple Markdown files stored in your project's .cursor/commands directory.
	•	When you type / in the chat input box, Cursor automatically scans this directory and displays available commands.

⸻

📁 Creating Commands

Steps to create commands:
	1.	Create a directory in your project root:

.cursor/commands


	2.	Add a .md file in this directory, for example:

`.cursor/commands/
├── review-code.md
├── write-tests.md
└── create-pr.md

✨ File names should be descriptive to easily identify the corresponding command functionality.

	3.	Use Markdown to write the workflow or instructions that this command describes.
	4.	Type / in the chat input box to see and execute this command.

⸻

📌 Example Commands

You can try writing the following commands to familiarize yourself with how they work:

# review-code.md
Description:
  Generate actionable code review suggestions for the current file.

Output Behavior:
  - Automatically generate review results
  - One-click insertion of suggestions

# run-tests.md
Description:
  Run the current project's test suite and fix common failures (if any).

Output Behavior:
  - Output test results
  - Automatically fix fixable errors

Some common command examples:
	•	Code review checklist
	•	Security audit
	•	Setup new feature
	•	Create pull request
	•	Run tests and fix failures
	•	Onboard new developer

⸻

✅ Usage Tips
	•	Commands can serve as team-shared script prompts, standardizing repetitive tasks.
	•	You can also store commands in version control for other collaborators to share.
	•	Commands can not only trigger Cursor chat but also be combined with terminal or test execution for automation scenarios.

⸻

📄 File Example (Recommended Format)

Here's a more complete command file template:

# create-pr.md

# Title
Create a pull request

## Description
Help me generate a Pull Request description for this change, including conventional commit format information.

## Parameters (Optional)
- @branch: Branch name
- @issue: Associated issue number

## Output
1) PR title
2) PR description
3) Related tags and checklist items

## Behavior
After command execution:
- Automatically generate pull request text
- Can be pasted into GitHub or other hosting platform interfaces


⸻

🧩 Tips
	•	Commands are currently in Beta stage, future syntax and functionality may be updated.
	•	If you want commands to support more complex logic, you can specify process steps or standardize output formats within the Markdown.

⸻

If you need to further extend command functionality (such as global command directories, command parameterization, integration with automation scripts, etc.), I can also help you write specific templates or examples!
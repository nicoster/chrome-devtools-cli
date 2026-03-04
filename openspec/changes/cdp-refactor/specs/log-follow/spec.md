## ADDED Requirements

### Requirement: log command replaces console command
The system SHALL register the command handler under the name `log`, with `console` retained as a deprecated alias.

#### Scenario: log command executes
- **WHEN** user runs `cdp log`
- **THEN** the command starts real-time console message monitoring

#### Scenario: console alias still works
- **WHEN** user runs `cdp console`
- **THEN** the command executes identically to `cdp log`

### Requirement: log command is follow-only
The system SHALL connect directly to Chrome via CDP and stream console messages in real-time. The command SHALL NOT perform one-shot historical queries and SHALL NOT depend on any proxy process.

#### Scenario: Command enters follow mode immediately
- **WHEN** user runs `cdp log`
- **THEN** the process stays alive and prints each new console message as it arrives
- **THEN** no proxy subprocess is started

#### Scenario: Command exits on Ctrl+C
- **WHEN** user presses Ctrl+C while `cdp log` is running
- **THEN** monitoring stops gracefully and process exits with code 0

### Requirement: log command supports type filtering
The system SHALL accept `--types` to filter console messages by level.

#### Scenario: Filter by single type
- **WHEN** user runs `cdp log --types error`
- **THEN** only messages of type `error` are printed

#### Scenario: Filter by multiple types
- **WHEN** user runs `cdp log --types error,warn`
- **THEN** only messages of type `error` or `warn` are printed

### Requirement: log command supports text pattern filtering
The system SHALL accept `--textPattern` as a regex to filter console messages by content.

#### Scenario: Filter by text pattern
- **WHEN** user runs `cdp log --textPattern "API"`
- **THEN** only messages whose text matches the regex `/API/i` are printed

### Requirement: log command supports output format selection
The system SHALL accept `--format` with values `text` (default), `json`, and `pretty`.

#### Scenario: Default text format
- **WHEN** user runs `cdp log` without `--format`
- **THEN** each message is printed as `[<ISO timestamp>] <TYPE> <text>`

#### Scenario: JSON format outputs one JSON object per line
- **WHEN** user runs `cdp log --format json`
- **THEN** each message is printed as a single-line JSON object containing type, text, timestamp

#### Scenario: Pretty format includes color
- **WHEN** user runs `cdp log --format pretty`
- **THEN** each message is printed with ANSI color coding based on type

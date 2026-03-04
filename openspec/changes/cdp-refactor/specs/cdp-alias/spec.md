## ADDED Requirements

### Requirement: cdp binary alias
The system SHALL provide a `cdp` binary entry point that invokes the same executable as `chrome-cdp-cli`.

#### Scenario: cdp alias resolves to same binary
- **WHEN** user runs `cdp <command>`
- **THEN** the command executes identically to `chrome-cdp-cli <command>`

### Requirement: Help output uses CDP branding
The system SHALL display `CDP` as the tool name in all help and usage text, replacing `chrome-cdp-cli`.

#### Scenario: General help shows CDP name
- **WHEN** user runs `cdp help` or `cdp --help`
- **THEN** output title reads `CDP - Chrome DevTools Protocol CLI`
- **THEN** all usage examples use `cdp` as the command prefix

#### Scenario: Command-specific help shows CDP name
- **WHEN** user runs `cdp help <command>`
- **THEN** usage examples in help text use `cdp` as the command prefix

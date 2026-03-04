## ADDED Requirements

### Requirement: screenshot without filename outputs binary to stdout
The system SHALL write raw image binary data directly to stdout when no `--filename` argument is provided.

#### Scenario: Binary written to stdout when no filename given
- **WHEN** user runs `cdp screenshot` (no `--filename`)
- **THEN** the raw PNG (or JPEG) binary is written to process.stdout
- **THEN** no JSON or text wrapper is output

#### Scenario: Piping screenshot to file works
- **WHEN** user runs `cdp screenshot > page.png`
- **THEN** the resulting file is a valid PNG image

### Requirement: screenshot binary output bypasses OutputManager formatting
The system SHALL NOT pass screenshot binary data through OutputManager. The global `--format` flag SHALL have no effect on screenshot output.

#### Scenario: Global --format json does not affect screenshot binary
- **WHEN** user runs `cdp --format json screenshot`
- **THEN** stdout still contains raw binary image data, not a JSON envelope

### Requirement: screenshot with filename saves to file as before
When `--filename` is provided, the system SHALL save the image to the specified path and print a confirmation message, as in current behavior.

#### Scenario: Screenshot saved to file
- **WHEN** user runs `cdp screenshot --filename page.png`
- **THEN** file `page.png` is created with valid PNG image data
- **THEN** a confirmation message is printed to stdout

### Requirement: screenshot image format parameter renamed to --image-format
The system SHALL accept `--image-format` (values: `png`, `jpeg`) instead of `--format` to select the image encoding.

#### Scenario: JPEG output via --image-format
- **WHEN** user runs `cdp screenshot --image-format jpeg`
- **THEN** binary JPEG data is written to stdout

#### Scenario: --format flag does not conflict with --image-format
- **WHEN** user runs `cdp --format json screenshot --image-format png`
- **THEN** `--format json` is consumed as the global output format (and ignored for binary output)
- **THEN** `--image-format png` controls the image encoding

### Requirement: TTY warning when outputting binary to terminal
The system SHALL print a warning to stderr and exit with a non-zero code when stdout is a TTY and no `--filename` is provided.

#### Scenario: Warning on TTY
- **WHEN** user runs `cdp screenshot` with stdout connected to a terminal
- **THEN** a warning message is printed to stderr: "Binary output to terminal detected. Use --filename or redirect output."
- **THEN** process exits with a non-zero exit code

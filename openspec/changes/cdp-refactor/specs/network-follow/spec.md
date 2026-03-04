## ADDED Requirements

### Requirement: network command is follow-only
The system SHALL connect directly to Chrome via CDP and stream completed network requests in real-time. The command SHALL NOT perform one-shot historical queries and SHALL NOT depend on any proxy process.

#### Scenario: Command enters follow mode immediately
- **WHEN** user runs `cdp network`
- **THEN** the process stays alive and prints each completed network request as it finishes
- **THEN** no proxy subprocess is started

#### Scenario: Command exits on Ctrl+C
- **WHEN** user presses Ctrl+C while `cdp network` is running
- **THEN** monitoring stops gracefully and process exits with code 0

### Requirement: network command reports completed requests
The system SHALL emit a network entry only when a request is fully completed (loadingFinished or loadingFailed), not at request initiation.

#### Scenario: Completed request is reported
- **WHEN** a network request finishes loading
- **THEN** the entry is printed with method, URL, status code, and duration

#### Scenario: Failed request is reported
- **WHEN** a network request fails (loadingFailed)
- **THEN** the entry is printed with method, URL, and error reason

### Requirement: network command supports method filtering
The system SHALL accept `--methods` as a comma-separated list to filter requests by HTTP method.

#### Scenario: Filter by method
- **WHEN** user runs `cdp network --methods POST,PUT`
- **THEN** only requests with method POST or PUT are printed

### Requirement: network command supports URL pattern filtering
The system SHALL accept `--urlPattern` as a regex to filter requests by URL.

#### Scenario: Filter by URL pattern
- **WHEN** user runs `cdp network --urlPattern "/api/"`
- **THEN** only requests whose URL matches `/\/api\//i` are printed

### Requirement: network command supports status code filtering
The system SHALL accept `--statusCodes` as a comma-separated list of integers to filter by HTTP response status.

#### Scenario: Filter by status code
- **WHEN** user runs `cdp network --statusCodes 404,500`
- **THEN** only requests with status code 404 or 500 are printed

### Requirement: network command filter parameters are top-level flags
The system SHALL accept all filter parameters as direct top-level CLI flags, NOT nested under a `--filter` object.

#### Scenario: Parameters accessible directly
- **WHEN** user runs `cdp network --methods GET --urlPattern "/api"`
- **THEN** both filters are applied without any object nesting syntax

### Requirement: NetworkMonitor supports real-time callbacks
The system SHALL provide `onRequest(callback)` and `offRequest(callback)` methods on `NetworkMonitor` to register and deregister callbacks triggered on each completed request.

#### Scenario: Callback triggered on request completion
- **WHEN** a network request completes
- **THEN** all registered `onRequest` callbacks are invoked with the completed `NetworkRequest` object

#### Scenario: Callback deregistered cleanly
- **WHEN** `offRequest(callback)` is called
- **THEN** subsequent request completions do NOT invoke the deregistered callback

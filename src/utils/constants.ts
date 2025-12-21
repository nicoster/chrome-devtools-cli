// Application constants

export const APP_NAME = 'chrome-devtools-cli';
export const APP_VERSION = '1.0.0';

// Default configuration values
export const DEFAULT_CHROME_HOST = 'localhost';
export const DEFAULT_CHROME_PORT = 9222;
export const DEFAULT_TIMEOUT = 30000;

// CDP Protocol constants
export const CDP_VERSION = '1.3';
export const CDP_WEBSOCKET_SUBPROTOCOL = 'devtools-protocol';

// Command exit codes
export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  CONNECTION_ERROR: 2,
  COMMAND_ERROR: 3,
  TIMEOUT_ERROR: 4,
  INVALID_ARGS: 5,
} as const;

// Output formats
export const OUTPUT_FORMATS = {
  JSON: 'json',
  TEXT: 'text',
} as const;

// Common CDP domains
export const CDP_DOMAINS = {
  RUNTIME: 'Runtime',
  PAGE: 'Page',
  DOM: 'DOM',
  NETWORK: 'Network',
  PERFORMANCE: 'Performance',
  EMULATION: 'Emulation',
  TARGET: 'Target',
} as const;
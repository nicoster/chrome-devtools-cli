// Jest setup file for Chrome DevTools CLI tests

// Set test timeout for longer operations
jest.setTimeout(30000);

// Mock console methods to reduce noise during tests
const originalConsole = console;

beforeAll(() => {
  // Suppress console output during tests unless explicitly needed
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
});

afterAll(() => {
  // Restore original console
  global.console = originalConsole;
});

// Global test utilities - moved to separate declaration file

// Custom Jest matchers for CDP types
expect.extend({
  toBeValidCDPMessage(received) {
    const pass = 
      typeof received === 'object' &&
      received !== null &&
      typeof received.id === 'number' &&
      typeof received.method === 'string';
    
    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be a valid CDP message`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be a valid CDP message`,
        pass: false,
      };
    }
  },
  
  toBeValidCommandResult(received) {
    const pass = 
      typeof received === 'object' &&
      received !== null &&
      typeof received.success === 'boolean';
    
    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be a valid command result`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be a valid command result`,
        pass: false,
      };
    }
  },
});
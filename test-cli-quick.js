#!/usr/bin/env node

/**
 * Quick CLI Commands Test Script
 * Tests core CLI functionality quickly
 */

const { execSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function runCommand(command, description) {
  console.log(`${colors.blue}Testing:${colors.reset} ${description}`);
  console.log(`${colors.cyan}Command:${colors.reset} tsx src/index.ts ${command}`);
  
  try {
    const output = execSync(`tsx src/index.ts ${command}`, { 
      encoding: 'utf8', 
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    console.log(`${colors.green}✓ SUCCESS${colors.reset}`);
    console.log(`Output: ${output.trim()}\n`);
    return true;
  } catch (error) {
    console.log(`${colors.red}✗ FAILED${colors.reset}`);
    console.log(`Error: ${error.message}`);
    if (error.stdout) console.log(`Stdout: ${error.stdout.toString().trim()}`);
    if (error.stderr) console.log(`Stderr: ${error.stderr.toString().trim()}`);
    console.log('');
    return false;
  }
}

console.log(`${colors.cyan}Chrome DevTools CLI - Quick Test${colors.reset}`);
console.log('================================\n');

let passed = 0;
let total = 0;

// Test basic commands
const tests = [
  ['--version', 'Version check'],
  ['help', 'Help command'],
  ['eval "2 + 2"', 'Basic eval'],
  ['eval "document.title"', 'Document title eval'],
  ['eval "console.log(\\"Hello from CLI test\\")"', 'Console log eval'],
  ['list_console_messages', 'List console messages'],
  ['list_network_requests', 'List network requests'],
  ['get_console_message', 'Get latest console message'],
  ['get_network_request', 'Get latest network request']
];

for (const [command, description] of tests) {
  total++;
  if (runCommand(command, description)) {
    passed++;
  }
}

console.log(`${colors.cyan}Results: ${passed}/${total} tests passed${colors.reset}`);

if (passed === total) {
  console.log(`${colors.green}🎉 All tests passed!${colors.reset}`);
  process.exit(0);
} else {
  console.log(`${colors.yellow}⚠️  Some tests failed. This might be expected if Chrome is not running.${colors.reset}`);
  console.log(`${colors.yellow}   Start Chrome with: chrome --remote-debugging-port=9222${colors.reset}`);
  process.exit(1);
}
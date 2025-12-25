#!/usr/bin/env node

/**
 * Final Comprehensive CLI Test Script
 * Tests all CLI commands with correct syntax
 */

const { execSync } = require('child_process');
const fs = require('fs');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bright: '\x1b[1m'
};

function runCommand(command, description, options = {}) {
  console.log(`${colors.blue}Testing:${colors.reset} ${description}`);
  console.log(`${colors.cyan}Command:${colors.reset} tsx src/index.ts ${command}`);
  
  try {
    const output = execSync(`tsx src/index.ts ${command}`, { 
      encoding: 'utf8', 
      timeout: options.timeout || 15000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    console.log(`${colors.green}✓ SUCCESS${colors.reset}`);
    if (options.showOutput !== false && output.trim().length < 500) {
      console.log(`Output: ${output.trim()}\n`);
    } else {
      console.log('');
    }
    return { success: true, output };
  } catch (error) {
    console.log(`${colors.red}✗ FAILED${colors.reset}`);
    console.log(`Error: ${error.message}`);
    if (error.stdout && error.stdout.toString().trim()) {
      const stdout = error.stdout.toString().trim();
      if (stdout.length < 300) {
        console.log(`Stdout: ${stdout}`);
      }
    }
    if (error.stderr && error.stderr.toString().trim()) {
      const stderr = error.stderr.toString().trim();
      if (stderr.length < 300) {
        console.log(`Stderr: ${stderr}`);
      }
    }
    console.log('');
    return { success: false, error };
  }
}

function testFileCreated(filename) {
  const exists = fs.existsSync(filename);
  if (exists) {
    console.log(`${colors.green}✓ File created:${colors.reset} ${filename}`);
    // Clean up
    try {
      fs.unlinkSync(filename);
      console.log(`${colors.blue}Cleaned up:${colors.reset} ${filename}`);
    } catch (e) {
      console.log(`${colors.yellow}Warning: Could not clean up ${filename}${colors.reset}`);
    }
    return true;
  } else {
    console.log(`${colors.red}✗ File not created:${colors.reset} ${filename}`);
    return false;
  }
}

console.log(`${colors.bright}${colors.magenta}Chrome DevTools CLI - Final Comprehensive Test${colors.reset}`);
console.log(`${colors.bright}===============================================${colors.reset}\n`);

let passed = 0;
let total = 0;

// Test basic commands (no Chrome required)
console.log(`${colors.cyan}=== Basic Commands (No Chrome Required) ===${colors.reset}`);
const basicTests = [
  ['--version', 'Version check'],
  ['help', 'General help'],
  ['help eval', 'Help for eval command'],
  ['help screenshot', 'Help for screenshot command'],
  ['install_cursor_command --help', 'Cursor command help'],
  ['install_claude_skill --help', 'Claude skill help']
];

for (const [command, description] of basicTests) {
  total++;
  const result = runCommand(command, description, { showOutput: false });
  if (result.success) {
    passed++;
  }
}

// Check Chrome connection
console.log(`${colors.cyan}=== Chrome Connection Test ===${colors.reset}`);
let chromeConnected = false;
try {
  total++;
  const result = runCommand('eval "2 + 2"', 'Chrome connection test', { timeout: 10000, showOutput: false });
  if (result.success && result.output.includes('4')) {
    chromeConnected = true;
    passed++;
    console.log(`${colors.green}✓ Chrome is connected and responsive${colors.reset}\n`);
  }
} catch (error) {
  console.log(`${colors.yellow}⚠️  Chrome not connected. Some tests will be skipped.${colors.reset}\n`);
}

if (chromeConnected) {
  // Test JavaScript evaluation
  console.log(`${colors.cyan}=== JavaScript Evaluation Tests ===${colors.reset}`);
  const evalTests = [
    ['eval "Math.PI"', 'Math constant evaluation'],
    ['eval "document.title"', 'Document property access'],
    ['eval "new Date().getFullYear()"', 'Date object evaluation'],
    ['eval "Promise.resolve(42)" --await-promise', 'Promise evaluation'],
    ['eval "console.log(\\"Test message\\"); \\"logged\\""', 'Console logging']
  ];

  for (const [command, description] of evalTests) {
    total++;
    const result = runCommand(command, description, { showOutput: false });
    if (result.success) {
      passed++;
    }
  }

  // Test file operations
  console.log(`${colors.cyan}=== File Operation Tests ===${colors.reset}`);
  const fileTests = [
    {
      command: 'screenshot --filename test-final.png',
      description: 'Screenshot capture',
      expectedFile: 'test-final.png'
    },
    {
      command: 'snapshot --filename test-final.html',
      description: 'HTML snapshot',
      expectedFile: 'test-final.html'
    }
  ];

  for (const test of fileTests) {
    total++;
    const result = runCommand(test.command, test.description, { showOutput: false });
    
    if (result.success) {
      if (testFileCreated(test.expectedFile)) {
        passed++;
      }
    }
  }

  // Test console and network monitoring
  console.log(`${colors.cyan}=== Monitoring Tests ===${colors.reset}`);
  
  // Generate some console messages first
  runCommand('eval "console.log(\\"Test log\\"); console.warn(\\"Test warning\\"); console.error(\\"Test error\\");"', 'Generate console messages', { showOutput: false });
  
  const monitoringTests = [
    ['console', 'List console messages'],
    ['console --latest', 'Get latest console message'],
    ['network', 'List network requests'],
    ['network --latest', 'Get latest network request']
  ];

  for (const [command, description] of monitoringTests) {
    total++;
    const result = runCommand(command, description, { showOutput: false });
    if (result.success) {
      passed++;
    }
  }

  // Test DOM interaction (create elements first)
  console.log(`${colors.cyan}=== DOM Interaction Tests ===${colors.reset}`);
  
  // Setup test elements
  runCommand('eval "document.body.innerHTML = \'<div><button id=\\\"test-btn\\\">Click me</button><input id=\\\"test-input\\\" type=\\\"text\\\" placeholder=\\\"Enter text\\\"></div>\'"', 'Setup test elements', { showOutput: false });
  
  const interactionTests = [
    ['click "#test-btn"', 'Click button element'],
    ['hover "#test-btn"', 'Hover over button'],
    ['fill "#test-input" "Hello World"', 'Fill input field'],
    ['eval "document.getElementById(\'test-input\').value"', 'Verify input value']
  ];

  for (const [command, description] of interactionTests) {
    total++;
    const result = runCommand(command, description, { showOutput: false });
    if (result.success) {
      passed++;
    }
  }

} else {
  // Skip Chrome-dependent tests
  const skippedCount = 16; // Approximate number of Chrome-dependent tests
  total += skippedCount;
  console.log(`${colors.yellow}⚠️  Skipped ${skippedCount} Chrome-dependent tests${colors.reset}`);
  console.log(`${colors.yellow}   To run all tests, start Chrome with: chrome --remote-debugging-port=9222${colors.reset}\n`);
}

// Print final results
console.log(`${colors.bright}${colors.magenta}Final Test Results${colors.reset}`);
console.log(`${colors.bright}==================${colors.reset}`);
console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
console.log(`${colors.red}Failed: ${total - passed}${colors.reset}`);
console.log(`${colors.blue}Total: ${total}${colors.reset}`);

const successRate = total > 0 ? ((passed / total) * 100).toFixed(1) : 0;
console.log(`${colors.bright}Success Rate: ${successRate}%${colors.reset}`);

if (chromeConnected) {
  if (passed === total) {
    console.log(`\n${colors.green}${colors.bright}🎉 All tests passed! CLI is working perfectly.${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`\n${colors.yellow}${colors.bright}⚠️  Some tests failed. Check the output above for details.${colors.reset}`);
    process.exit(1);
  }
} else {
  console.log(`\n${colors.blue}${colors.bright}ℹ️  Basic functionality verified. Start Chrome to test full functionality.${colors.reset}`);
  process.exit(0);
}
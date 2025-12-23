#!/usr/bin/env node

/**
 * Extended CLI Commands Test Script
 * Tests additional CLI functionality including file operations
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
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
    if (options.showOutput !== false) {
      console.log(`Output: ${output.trim()}\n`);
    } else {
      console.log('');
    }
    return { success: true, output };
  } catch (error) {
    console.log(`${colors.red}✗ FAILED${colors.reset}`);
    console.log(`Error: ${error.message}`);
    if (error.stdout) console.log(`Stdout: ${error.stdout.toString().trim()}`);
    if (error.stderr) console.log(`Stderr: ${error.stderr.toString().trim()}`);
    console.log('');
    return { success: false, error };
  }
}

function testFileCreated(filename, description) {
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

console.log(`${colors.cyan}Chrome DevTools CLI - Extended Test${colors.reset}`);
console.log('===================================\n');

let passed = 0;
let total = 0;

// Test file-based commands
const fileTests = [
  {
    command: 'screenshot --filename test-screenshot.png',
    description: 'Screenshot command',
    expectedFile: 'test-screenshot.png'
  },
  {
    command: 'snapshot --filename test-snapshot.html',
    description: 'HTML snapshot command',
    expectedFile: 'test-snapshot.html'
  },
  {
    command: 'snapshot --filename test-snapshot.mhtml --format mhtml',
    description: 'MHTML snapshot command',
    expectedFile: 'test-snapshot.mhtml'
  }
];

for (const test of fileTests) {
  total++;
  const result = runCommand(test.command, test.description, { showOutput: false });
  
  if (result.success) {
    if (testFileCreated(test.expectedFile, test.description)) {
      passed++;
    }
  }
}

// Test interaction commands
const interactionTests = [
  {
    command: 'eval "document.body.innerHTML = \'<button id=\\\"test-btn\\\">Click me</button>\'"',
    description: 'Create test button'
  },
  {
    command: 'click #test-btn',
    description: 'Click button'
  },
  {
    command: 'eval "document.body.innerHTML = \'<input id=\\\"test-input\\\" type=\\\"text\\\">\'"',
    description: 'Create test input'
  },
  {
    command: 'fill #test-input "Hello World"',
    description: 'Fill input field'
  },
  {
    command: 'eval "document.getElementById(\'test-input\').value"',
    description: 'Verify input value'
  }
];

for (const test of interactionTests) {
  total++;
  const result = runCommand(test.command, test.description, { timeout: 10000 });
  if (result.success) {
    passed++;
  }
}

// Test help commands for specific handlers
const helpTests = [
  'help eval',
  'help screenshot',
  'help click',
  'help fill'
];

for (const command of helpTests) {
  total++;
  const result = runCommand(command, `Help for ${command.split(' ')[1]}`, { showOutput: false });
  if (result.success) {
    passed++;
  }
}

console.log(`${colors.cyan}Results: ${passed}/${total} tests passed${colors.reset}`);

if (passed === total) {
  console.log(`${colors.green}🎉 All extended tests passed!${colors.reset}`);
  process.exit(0);
} else {
  console.log(`${colors.yellow}⚠️  Some tests failed. This might be expected if Chrome is not running.${colors.reset}`);
  console.log(`${colors.yellow}   Start Chrome with: chrome --remote-debugging-port=9222${colors.reset}`);
  process.exit(1);
}
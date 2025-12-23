#!/usr/bin/env node

/**
 * Comprehensive CLI Commands Test Script
 * Tests all available chrome-cdp-cli subcommands to ensure they work correctly
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test configuration
const CLI_COMMAND = 'tsx src/index.ts';
const CHROME_HOST = 'localhost';
const CHROME_PORT = 9222;
const TEST_TIMEOUT = 30000; // 30 seconds per test

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  total: 0
};

/**
 * Execute a CLI command and return the result
 */
async function executeCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const fullCommand = `${CLI_COMMAND} ${command} ${args.join(' ')}`;
    console.log(`${colors.blue}Executing:${colors.reset} ${fullCommand}`);
    
    const child = spawn('bash', ['-c', fullCommand], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: options.timeout || TEST_TIMEOUT,
      ...options
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        success: code === 0
      });
    });

    child.on('error', (error) => {
      reject(error);
    });

    // Handle timeout
    setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Command timed out after ${options.timeout || TEST_TIMEOUT}ms`));
    }, options.timeout || TEST_TIMEOUT);
  });
}

/**
 * Run a test case
 */
async function runTest(testName, testFunction) {
  testResults.total++;
  console.log(`\n${colors.cyan}=== Testing: ${testName} ===${colors.reset}`);
  
  try {
    const result = await testFunction();
    if (result.success !== false) {
      console.log(`${colors.green}✓ PASSED:${colors.reset} ${testName}`);
      testResults.passed++;
      return true;
    } else {
      console.log(`${colors.red}✗ FAILED:${colors.reset} ${testName}`);
      console.log(`${colors.red}Reason:${colors.reset} ${result.reason || 'Unknown failure'}`);
      testResults.failed++;
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}✗ ERROR:${colors.reset} ${testName}`);
    console.log(`${colors.red}Error:${colors.reset} ${error.message}`);
    testResults.failed++;
    return false;
  }
}

/**
 * Check if Chrome is running and accessible
 */
async function checkChromeConnection() {
  try {
    const result = await executeCommand('eval', ['"Chrome connection test"'], { timeout: 10000 });
    return result.success;
  } catch (error) {
    return false;
  }
}

/**
 * Test basic help command
 */
async function testHelp() {
  const result = await executeCommand('help');
  return {
    success: result.success && result.stdout.includes('chrome-cdp-cli'),
    reason: result.success ? null : `Help command failed: ${result.stderr}`
  };
}

/**
 * Test version command
 */
async function testVersion() {
  const result = await executeCommand('--version');
  return {
    success: result.success && /^\d+\.\d+\.\d+/.test(result.stdout),
    reason: result.success ? null : `Version command failed: ${result.stderr}`
  };
}

/**
 * Test eval command (JavaScript execution)
 */
async function testEval() {
  const result = await executeCommand('eval', ['"2 + 2"']);
  return {
    success: result.success && result.stdout.includes('4'),
    reason: result.success ? null : `Eval command failed: ${result.stderr}`
  };
}

/**
 * Test eval command with complex expression
 */
async function testEvalComplex() {
  const result = await executeCommand('eval', ['"document.title"']);
  return {
    success: result.success,
    reason: result.success ? null : `Complex eval failed: ${result.stderr}`
  };
}

/**
 * Test eval command with await promise
 */
async function testEvalAsync() {
  const result = await executeCommand('eval', ['"Promise.resolve(42)"', '--await-promise']);
  return {
    success: result.success && result.stdout.includes('42'),
    reason: result.success ? null : `Async eval failed: ${result.stderr}`
  };
}

/**
 * Test screenshot command
 */
async function testScreenshot() {
  const filename = 'test-screenshot.png';
  const result = await executeCommand('screenshot', ['--filename', filename]);
  
  // Check if file was created
  const fileExists = fs.existsSync(filename);
  
  // Clean up
  if (fileExists) {
    try {
      fs.unlinkSync(filename);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
  
  return {
    success: result.success && fileExists,
    reason: result.success ? (fileExists ? null : 'Screenshot file not created') : `Screenshot command failed: ${result.stderr}`
  };
}

/**
 * Test snapshot command
 */
async function testSnapshot() {
  const filename = 'test-snapshot.html';
  const result = await executeCommand('snapshot', ['--filename', filename]);
  
  // Check if file was created
  const fileExists = fs.existsSync(filename);
  
  // Clean up
  if (fileExists) {
    try {
      fs.unlinkSync(filename);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
  
  return {
    success: result.success && fileExists,
    reason: result.success ? (fileExists ? null : 'Snapshot file not created') : `Snapshot command failed: ${result.stderr}`
  };
}

/**
 * Test console messages command
 */
async function testConsoleMessages() {
  // First, generate some console messages
  await executeCommand('eval', ['"console.log(\\"Test message\\"); console.warn(\\"Test warning\\");"']);
  
  // Wait a bit for messages to be captured
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Then try to retrieve them
  const result = await executeCommand('list_console_messages');
  return {
    success: result.success,
    reason: result.success ? null : `Console messages command failed: ${result.stderr}`
  };
}

/**
 * Test network requests command
 */
async function testNetworkRequests() {
  // First, generate a network request
  await executeCommand('eval', ['"fetch(\\"data:text/plain,test\\").catch(() => {});"']);
  
  // Wait a bit for request to be captured
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Then try to retrieve them
  const result = await executeCommand('list_network_requests');
  return {
    success: result.success,
    reason: result.success ? null : `Network requests command failed: ${result.stderr}`
  };
}

/**
 * Test click command (requires a page with clickable elements)
 */
async function testClick() {
  // First, create a clickable element
  await executeCommand('eval', ['"document.body.innerHTML = \\"<button id=\\\\\\"test-btn\\\\\\">Click me</button>\\""']);
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Try to click it
  const result = await executeCommand('click', ['#test-btn']);
  return {
    success: result.success,
    reason: result.success ? null : `Click command failed: ${result.stderr}`
  };
}

/**
 * Test hover command
 */
async function testHover() {
  // First, create a hoverable element
  await executeCommand('eval', ['"document.body.innerHTML = \\"<div id=\\\\\\"test-hover\\\\\\">Hover me</div>\\""']);
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Try to hover it
  const result = await executeCommand('hover', ['#test-hover']);
  return {
    success: result.success,
    reason: result.success ? null : `Hover command failed: ${result.stderr}`
  };
}

/**
 * Test fill command
 */
async function testFill() {
  // First, create an input element
  await executeCommand('eval', ['"document.body.innerHTML = \\"<input id=\\\\\\"test-input\\\\\\" type=\\\\\\"text\\\\\\">\\""']);
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Try to fill it
  const result = await executeCommand('fill', ['#test-input', 'test text']);
  return {
    success: result.success,
    reason: result.success ? null : `Fill command failed: ${result.stderr}`
  };
}

/**
 * Test wait-for command
 */
async function testWaitFor() {
  // Create an element that will appear after a delay
  await executeCommand('eval', ['"setTimeout(() => { const div = document.createElement(\\\\\\"div\\\\\\"); div.id = \\\\\\"delayed-element\\\\\\"; document.body.appendChild(div); }, 1000);"']);
  
  // Try to wait for it
  const result = await executeCommand('wait_for', ['#delayed-element'], { timeout: 5000 });
  return {
    success: result.success,
    reason: result.success ? null : `Wait-for command failed: ${result.stderr}`
  };
}

/**
 * Test install cursor command (should work without Chrome)
 */
async function testInstallCursorCommand() {
  const result = await executeCommand('install_cursor_command', ['--help']);
  return {
    success: result.success || result.stdout.includes('install_cursor_command'),
    reason: result.success ? null : `Install cursor command failed: ${result.stderr}`
  };
}

/**
 * Test install claude skill (should work without Chrome)
 */
async function testInstallClaudeSkill() {
  const result = await executeCommand('install_claude_skill', ['--help']);
  return {
    success: result.success || result.stdout.includes('install_claude_skill'),
    reason: result.success ? null : `Install claude skill failed: ${result.stderr}`
  };
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log(`${colors.bright}${colors.magenta}Chrome DevTools CLI - Command Test Suite${colors.reset}`);
  console.log(`${colors.bright}=======================================${colors.reset}\n`);

  // Check Chrome connection first
  console.log(`${colors.yellow}Checking Chrome connection...${colors.reset}`);
  const chromeConnected = await checkChromeConnection();
  
  if (!chromeConnected) {
    console.log(`${colors.yellow}⚠️  Chrome not connected. Some tests will be skipped.${colors.reset}`);
    console.log(`${colors.yellow}   To run all tests, start Chrome with: chrome --remote-debugging-port=9222${colors.reset}\n`);
  } else {
    console.log(`${colors.green}✓ Chrome connection successful${colors.reset}\n`);
  }

  // Run tests that don't require Chrome
  await runTest('Help Command', testHelp);
  await runTest('Version Command', testVersion);
  await runTest('Install Cursor Command', testInstallCursorCommand);
  await runTest('Install Claude Skill', testInstallClaudeSkill);

  if (chromeConnected) {
    // Run tests that require Chrome
    await runTest('Basic Eval Command', testEval);
    await runTest('Complex Eval Command', testEvalComplex);
    await runTest('Async Eval Command', testEvalAsync);
    await runTest('Screenshot Command', testScreenshot);
    await runTest('Snapshot Command', testSnapshot);
    await runTest('Console Messages Command', testConsoleMessages);
    await runTest('Network Requests Command', testNetworkRequests);
    await runTest('Click Command', testClick);
    await runTest('Hover Command', testHover);
    await runTest('Fill Command', testFill);
    await runTest('Wait For Command', testWaitFor);
  } else {
    // Skip Chrome-dependent tests
    const skippedTests = [
      'Basic Eval Command',
      'Complex Eval Command', 
      'Async Eval Command',
      'Screenshot Command',
      'Snapshot Command',
      'Console Messages Command',
      'Network Requests Command',
      'Click Command',
      'Hover Command',
      'Fill Command',
      'Wait For Command'
    ];
    
    skippedTests.forEach(testName => {
      testResults.total++;
      testResults.skipped++;
      console.log(`\n${colors.cyan}=== Testing: ${testName} ===${colors.reset}`);
      console.log(`${colors.yellow}⚠️  SKIPPED:${colors.reset} ${testName} (Chrome not connected)`);
    });
  }

  // Print summary
  console.log(`\n${colors.bright}${colors.magenta}Test Results Summary${colors.reset}`);
  console.log(`${colors.bright}===================${colors.reset}`);
  console.log(`${colors.green}Passed: ${testResults.passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${testResults.failed}${colors.reset}`);
  console.log(`${colors.yellow}Skipped: ${testResults.skipped}${colors.reset}`);
  console.log(`${colors.blue}Total: ${testResults.total}${colors.reset}`);

  const successRate = testResults.total > 0 ? ((testResults.passed / (testResults.total - testResults.skipped)) * 100).toFixed(1) : 0;
  console.log(`${colors.bright}Success Rate: ${successRate}%${colors.reset}`);

  if (testResults.failed === 0) {
    console.log(`\n${colors.green}${colors.bright}🎉 All tests passed!${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}${colors.bright}❌ Some tests failed. Check the output above for details.${colors.reset}`);
    process.exit(1);
  }
}

// Handle script termination
process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}Test interrupted by user${colors.reset}`);
  process.exit(130);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`${colors.red}Unhandled Rejection at:${colors.reset}`, promise, `${colors.red}reason:${colors.reset}`, reason);
  process.exit(1);
});

// Run the tests
runAllTests().catch((error) => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
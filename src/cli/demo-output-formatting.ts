#!/usr/bin/env ts-node

/**
 * Demo script for the new standardized output formatting system
 * 
 * This script demonstrates the various output formats, modes, and features
 * of the enhanced CLI output system.
 */

import { OutputManager } from './OutputManager';
import { OutputFormatter, createTimingInfo, enhanceCommandResult } from './OutputFormatter';
import { CommandResult, CLIConfig } from '../types';

// Sample configurations for different modes
const configs: Record<string, CLIConfig> = {
  text: {
    host: 'localhost',
    port: 9222,
    outputFormat: 'text',
    verbose: false,
    quiet: false,
    timeout: 30000,
    debug: false
  },
  json: {
    host: 'localhost',
    port: 9222,
    outputFormat: 'json',
    verbose: false,
    quiet: false,
    timeout: 30000,
    debug: false
  },
  yaml: {
    host: 'localhost',
    port: 9222,
    outputFormat: 'yaml',
    verbose: false,
    quiet: false,
    timeout: 30000,
    debug: false
  },
  verbose: {
    host: 'localhost',
    port: 9222,
    outputFormat: 'text',
    verbose: true,
    quiet: false,
    timeout: 30000,
    debug: false
  },
  quiet: {
    host: 'localhost',
    port: 9222,
    outputFormat: 'text',
    verbose: false,
    quiet: true,
    timeout: 30000,
    debug: false
  },
  debug: {
    host: 'localhost',
    port: 9222,
    outputFormat: 'text',
    verbose: true,
    quiet: false,
    timeout: 30000,
    debug: true
  }
};

// Sample data for different types of results
const sampleResults: Record<string, CommandResult> = {
  simpleSuccess: {
    success: true,
    data: 'Operation completed successfully'
  },
  
  consoleMessages: {
    success: true,
    data: {
      messages: [
        {
          type: 'log',
          text: 'Application started',
          timestamp: Date.now() - 5000,
          args: []
        },
        {
          type: 'warn',
          text: 'Deprecated API usage detected',
          timestamp: Date.now() - 3000,
          args: ['api.old()']
        },
        {
          type: 'error',
          text: 'Failed to load resource',
          timestamp: Date.now() - 1000,
          args: ['https://example.com/missing.js']
        }
      ]
    },
    dataSource: 'proxy',
    hasHistoricalData: true
  },
  
  networkRequests: {
    success: true,
    data: {
      requests: [
        {
          requestId: '1',
          url: 'https://api.example.com/users',
          method: 'GET',
          timestamp: Date.now() - 2000,
          status: 200
        },
        {
          requestId: '2',
          url: 'https://api.example.com/posts',
          method: 'POST',
          timestamp: Date.now() - 1000,
          status: 201
        }
      ]
    },
    dataSource: 'direct',
    hasHistoricalData: false
  },
  
  error: {
    success: false,
    error: 'Connection timeout: Unable to connect to Chrome DevTools',
    exitCode: 1
  },
  
  complexData: {
    success: true,
    data: {
      pageInfo: {
        title: 'Example Page',
        url: 'https://example.com',
        loadTime: 1250
      },
      metrics: {
        domContentLoaded: 800,
        firstPaint: 900,
        firstContentfulPaint: 950
      }
    }
  }
};

function printSeparator(title: string): void {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

function printSubsection(title: string): void {
  console.log(`\n--- ${title} ---`);
}

async function demonstrateOutputFormats(): Promise<void> {
  const outputManager = new OutputManager();
  const formatter = new OutputFormatter();

  printSeparator('STANDARDIZED OUTPUT FORMATTING DEMO');

  // 1. Different Output Formats
  printSubsection('1. Output Formats (JSON, Text, YAML)');
  
  const result = sampleResults.complexData;
  
  console.log('\n📄 TEXT FORMAT:');
  console.log(outputManager.formatOutput(result, configs.text));
  
  console.log('\n📋 JSON FORMAT:');
  console.log(outputManager.formatOutput(result, configs.json));
  
  console.log('\n📝 YAML FORMAT:');
  console.log(outputManager.formatOutput(result, configs.yaml));

  // 2. Verbose Mode with Timing
  printSubsection('2. Verbose Mode with Timing Information');
  
  const timing = createTimingInfo('screenshot-command', Date.now() - 1500, Date.now());
  const metadata = {
    command: 'screenshot',
    args: { filename: 'test.png', fullPage: true },
    config: configs.verbose
  };
  
  const enhancedResult = enhanceCommandResult(sampleResults.simpleSuccess, timing, metadata);
  
  console.log('\n🔍 VERBOSE OUTPUT:');
  console.log(formatter.formatOutput(enhancedResult, {
    format: 'text',
    mode: { verbose: true, quiet: false, debug: false },
    includeMetadata: true,
    includeTiming: true
  }));

  // 3. Quiet Mode
  printSubsection('3. Quiet Mode (Minimal Output)');
  
  console.log('\n🤫 QUIET MODE - Success with data:');
  console.log(`"${outputManager.formatOutput(sampleResults.consoleMessages, configs.quiet)}"`);
  
  console.log('\n🤫 QUIET MODE - Success without data:');
  console.log(`"${outputManager.formatOutput(sampleResults.simpleSuccess, configs.quiet)}"`);
  
  console.log('\n🤫 QUIET MODE - Error (still shown):');
  console.log(outputManager.formatOutput(sampleResults.error, configs.quiet));

  // 4. Debug Mode
  printSubsection('4. Debug Mode with Detailed Information');
  
  const debugResult = enhanceCommandResult(sampleResults.error, timing, metadata);
  
  console.log('\n🔧 DEBUG OUTPUT:');
  console.log(formatter.formatOutput(debugResult, {
    format: 'text',
    mode: { verbose: true, quiet: false, debug: true },
    includeMetadata: true,
    includeTiming: true
  }));

  // 5. Console Messages Formatting
  printSubsection('5. Console Messages Formatting');
  
  console.log('\n📝 CONSOLE MESSAGES (Text):');
  console.log(outputManager.formatOutput(sampleResults.consoleMessages, configs.text));
  
  console.log('\n📝 CONSOLE MESSAGES (Verbose):');
  console.log(outputManager.formatOutput(sampleResults.consoleMessages, configs.verbose));

  // 6. Network Requests Formatting
  printSubsection('6. Network Requests Formatting');
  
  console.log('\n🌐 NETWORK REQUESTS:');
  console.log(outputManager.formatOutput(sampleResults.networkRequests, configs.text));

  // 7. Custom Templates
  printSubsection('7. Custom Output Templates');
  
  // Register custom templates
  formatter.registerTemplate({
    name: 'status-only',
    description: 'Show only success status',
    template: 'Status: {{success}}',
    variables: ['success']
  });
  
  formatter.registerTemplate({
    name: 'detailed-summary',
    description: 'Detailed summary with timing',
    template: '✅ {{success}} | ⏱️ {{timing.duration}}ms | 📋 {{metadata.command}}',
    variables: ['success', 'timing', 'metadata']
  });
  
  console.log('\n🎨 CUSTOM TEMPLATE - Status Only:');
  console.log(formatter.formatOutput(sampleResults.simpleSuccess, {
    format: 'text',
    mode: { verbose: false, quiet: false, debug: false },
    template: 'status-only'
  }));
  
  console.log('\n🎨 CUSTOM TEMPLATE - Detailed Summary:');
  console.log(formatter.formatOutput(enhancedResult, {
    format: 'text',
    mode: { verbose: false, quiet: false, debug: false },
    template: 'detailed-summary'
  }));

  // 8. Error Handling Consistency
  printSubsection('8. Consistent Error Handling');
  
  console.log('\n❌ ERROR (Text):');
  console.log(outputManager.formatOutput(sampleResults.error, configs.text));
  
  console.log('\n❌ ERROR (JSON):');
  console.log(outputManager.formatOutput(sampleResults.error, configs.json));
  
  console.log('\n❌ ERROR (Debug):');
  console.log(outputManager.formatOutput(sampleResults.error, configs.debug));

  // 9. Utility Functions
  printSubsection('9. Utility Functions');
  
  console.log('\n🛠️ VALIDATION ERRORS:');
  console.log(outputManager.formatValidationErrors([
    { field: 'host', message: 'Invalid hostname format', suggestion: 'Use localhost or valid IP' },
    { field: 'port', message: 'Port must be between 1 and 65535' }
  ]));
  
  console.log('\n📖 HELP INFORMATION:');
  console.log(outputManager.formatHelpInfo(
    'Screenshot Command',
    'Capture a screenshot of the current page with various options.',
    [
      'chrome-cdp-cli screenshot --filename=page.png',
      'chrome-cdp-cli screenshot --full-page --format=jpeg'
    ]
  ));

  // 10. Performance Demonstration
  printSubsection('10. Performance and Timing');
  
  console.log('\n⏱️ TIMING INFORMATION:');
  console.log(outputManager.getTimingInfo(Date.now() - 2500, Date.now(), 'complex-operation'));
  
  console.log('\n📊 DATA SOURCE INFORMATION:');
  console.log(outputManager.formatDataSourceInfo('proxy', true));
  console.log(outputManager.formatDataSourceInfo('direct', false));

  printSeparator('DEMO COMPLETE');
  console.log('\n✅ All output formatting features demonstrated successfully!');
  console.log('\n📋 Key Features:');
  console.log('  • Multiple output formats (JSON, Text, YAML)');
  console.log('  • Quiet and verbose modes');
  console.log('  • Custom output templates');
  console.log('  • Timing information for verbose mode');
  console.log('  • Consistent error handling');
  console.log('  • Smart data formatting (console messages, network requests)');
  console.log('  • Debug mode with detailed information');
  console.log('  • Utility functions for validation and help');
}

// Run the demo
if (require.main === module) {
  demonstrateOutputFormats().catch(console.error);
}

export { demonstrateOutputFormats };
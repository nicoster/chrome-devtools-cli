#!/usr/bin/env node

/**
 * Demonstration script for the enhanced argument parser
 * Shows the new features: schema validation, consistent option handling, and boolean negation
 */

import { EnhancedCLIInterface } from './EnhancedCLIInterface';

function demonstrateEnhancedParser() {
  console.log('🚀 Enhanced Argument Parser Demonstration\n');
  
  const cli = new EnhancedCLIInterface();
  
  // Test cases to demonstrate new features
  const testCases = [
    {
      name: 'Global Options with Boolean Negation',
      args: ['node', 'script.js', '--host', 'example.com', '--no-verbose', '--debug', 'help']
    },
    {
      name: 'Screenshot Command with Schema Validation',
      args: ['node', 'script.js', 'screenshot', '--filename', 'test.png', '--width', '800', '--height', '600', '--full-page']
    },
    {
      name: 'Eval Command with Alias and Options',
      args: ['node', 'script.js', 'js', '--expression', 'document.title', '--no-await-promise']
    },
    {
      name: 'Click Command with Positional Argument',
      args: ['node', 'script.js', 'click', '#submit-button']
    },
    {
      name: 'Fill Command with Multiple Arguments',
      args: ['node', 'script.js', 'fill', '#username', 'john@example.com']
    },
    {
      name: 'Option=Value Format',
      args: ['node', 'script.js', '--host=localhost', '--port=9222', '--format=json', 'help']
    },
    {
      name: 'Short Options',
      args: ['node', 'script.js', '-h', 'localhost', '-p', '9222', '-f', 'json', '-v', 'help']
    }
  ];

  testCases.forEach((testCase, index) => {
    console.log(`${index + 1}. ${testCase.name}`);
    console.log(`   Command: ${testCase.args.slice(2).join(' ')}`);
    
    try {
      const result = cli.parseArgs(testCase.args);
      console.log(`   ✅ Success: ${result.name}`);
      console.log(`   📋 Config: host=${result.config.host}, port=${result.config.port}, format=${result.config.outputFormat}, verbose=${result.config.verbose}, debug=${result.config.debug}`);
      
      if (Object.keys(result.args).length > 0) {
        console.log(`   🔧 Args: ${JSON.stringify(result.args)}`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    console.log('');
  });

  // Demonstrate help generation
  console.log('📚 Help Generation Examples\n');
  
  console.log('General Help:');
  console.log(cli.showHelp());
  console.log('\n' + '='.repeat(80) + '\n');
  
  console.log('Command-Specific Help (eval):');
  console.log(cli.showHelp('eval'));
  console.log('\n' + '='.repeat(80) + '\n');
  
  console.log('Command-Specific Help (screenshot):');
  console.log(cli.showHelp('screenshot'));
  
  // Demonstrate available commands
  console.log('\n📋 Available Commands:');
  const commands = cli.getAvailableCommands();
  console.log(commands.join(', '));
  
  console.log('\n✨ Enhanced Argument Parser Features Demonstrated:');
  console.log('  ✅ Schema validation for commands and options');
  console.log('  ✅ Consistent short/long option handling');
  console.log('  ✅ Boolean option negation (--no-verbose)');
  console.log('  ✅ Command aliases (ss for screenshot, js for eval)');
  console.log('  ✅ Type conversion (string, number, boolean, array)');
  console.log('  ✅ Comprehensive help generation');
  console.log('  ✅ Global option precedence');
  console.log('  ✅ Positional argument handling');
}

// Run demonstration if this file is executed directly
if (require.main === module) {
  demonstrateEnhancedParser();
}

export { demonstrateEnhancedParser };
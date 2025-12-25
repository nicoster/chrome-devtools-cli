#!/usr/bin/env ts-node

/**
 * Demo script showcasing the enhanced help system
 * This demonstrates all the help system features implemented for task 5
 */

import { HelpSystem } from './HelpSystem';
import { CommandSchemaRegistry } from './CommandSchemaRegistry';
import { ArgumentParser } from './ArgumentParser';

function printSection(title: string, content: string) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60));
  console.log(content);
}

async function demonstrateHelpSystem() {
  console.log('🚀 Enhanced Help System Demo');
  console.log('Demonstrating comprehensive help generation, contextual assistance, and advanced topics');

  const schemaRegistry = CommandSchemaRegistry.getInstance();
  const helpSystem = new HelpSystem(schemaRegistry);
  const argumentParser = new ArgumentParser();

  // Initialize parser with commands
  const commands = schemaRegistry.getAllCommands();
  for (const command of commands) {
    argumentParser.registerCommand(command);
  }

  // 1. General Help Overview (Requirement 4.2)
  printSection('1. GENERAL HELP OVERVIEW', helpSystem.generateGeneralHelp());

  // 2. Command-Specific Help (Requirement 4.1)
  printSection('2. COMMAND-SPECIFIC HELP - EVAL COMMAND', helpSystem.generateCommandHelp('eval'));

  // 3. Command-Specific Help with Complex Options (Requirement 4.4)
  printSection('3. COMPLEX COMMAND HELP - SCREENSHOT', helpSystem.generateCommandHelp('screenshot'));

  // 4. Help Topics for Advanced Features (Requirement 4.5)
  printSection('4. HELP TOPIC - CONFIGURATION', helpSystem.generateTopicHelp('configuration'));

  printSection('4b. HELP TOPIC - CSS SELECTORS', helpSystem.generateTopicHelp('selectors'));

  printSection('4c. HELP TOPIC - AUTOMATION BEST PRACTICES', helpSystem.generateTopicHelp('automation'));

  // 5. Contextual Help for Errors (Requirement 4.3)
  printSection('5a. CONTEXTUAL HELP - CONNECTION ERROR', 
    helpSystem.generateContextualHelp('connection refused'));

  printSection('5b. CONTEXTUAL HELP - ELEMENT NOT FOUND', 
    helpSystem.generateContextualHelp('element not found', 'click'));

  printSection('5c. CONTEXTUAL HELP - VALIDATION ERROR', 
    helpSystem.generateContextualHelp('validation failed', 'eval'));

  // 6. Command Not Found with Suggestions
  printSection('6. COMMAND NOT FOUND WITH SUGGESTIONS', 
    helpSystem.generateCommandHelp('screenshoot')); // typo

  // 7. Topic Not Found
  printSection('7. TOPIC NOT FOUND', 
    helpSystem.generateTopicHelp('nonexistent-topic'));

  // 8. Available Help Topics
  console.log('\n' + '='.repeat(60));
  console.log('  8. AVAILABLE HELP TOPICS');
  console.log('='.repeat(60));
  const topics = helpSystem.getAvailableTopics();
  console.log('Available topics:', topics.join(', '));

  // 9. Integration with Argument Parser
  printSection('9a. HELP VIA ARGUMENT PARSER - GENERAL', 
    argumentParser.generateHelp());

  printSection('9b. HELP VIA ARGUMENT PARSER - COMMAND', 
    argumentParser.generateHelp('fill'));

  printSection('9c. HELP VIA ARGUMENT PARSER - TOPIC', 
    argumentParser.generateHelp('topic debugging'));

  // 10. Custom Help Topic Demo
  console.log('\n' + '='.repeat(60));
  console.log('  10. CUSTOM HELP TOPIC DEMO');
  console.log('='.repeat(60));
  
  helpSystem.addHelpTopic({
    name: 'demo-topic',
    title: 'Demo Custom Topic',
    description: 'A demonstration of custom help topics',
    content: `This is a custom help topic added dynamically to demonstrate the extensibility of the help system.

Custom topics can include:
- Detailed explanations of complex features
- Step-by-step tutorials
- Troubleshooting guides
- Integration instructions

The help system supports full markdown-like formatting and can include examples and cross-references.`,
    examples: [
      'chrome-cdp-cli custom-command --option value',
      'chrome-cdp-cli help topic demo-topic'
    ],
    seeAlso: ['configuration', 'automation']
  });

  console.log(helpSystem.generateTopicHelp('demo-topic'));

  // 11. Custom Contextual Help Demo
  console.log('\n' + '='.repeat(60));
  console.log('  11. CUSTOM CONTEXTUAL HELP DEMO');
  console.log('='.repeat(60));

  helpSystem.addContextualHelp('custom error pattern', {
    error: 'custom error pattern',
    suggestion: 'This is a custom suggestion for handling this specific error',
    example: 'chrome-cdp-cli custom-fix --retry 3',
    relatedCommands: ['help', 'debug']
  });

  console.log(helpSystem.generateContextualHelp('custom error pattern'));

  console.log('\n🎉 Enhanced Help System Demo Complete!');
  console.log('\nKey Features Demonstrated:');
  console.log('✅ Comprehensive command help with examples (Requirement 4.1)');
  console.log('✅ General help overview with categorized commands (Requirement 4.2)');
  console.log('✅ Contextual help suggestions for errors (Requirement 4.3)');
  console.log('✅ Practical examples for complex commands (Requirement 4.4)');
  console.log('✅ Advanced help topics for features (Requirement 4.5)');
  console.log('✅ Extensible architecture for custom help content');
  console.log('✅ Integration with argument parser and CLI interface');
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateHelpSystem().catch(console.error);
}

export { demonstrateHelpSystem };
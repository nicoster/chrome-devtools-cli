/**
 * Configuration Management Example
 * 
 * This example demonstrates how to use the new configuration management system
 * with CLI options, environment variables, and YAML configuration files.
 */

import { ConfigurationManager } from './ConfigurationManager';
import { getConfigTemplate } from './utils';

/**
 * Example usage of the configuration management system
 */
async function demonstrateConfigurationSystem() {
  console.log('=== Configuration Management System Demo ===\n');

  const configManager = new ConfigurationManager();

  // 1. Create configuration sources from CLI options
  console.log('1. Creating configuration sources...');
  const cliOptions = {
    verbose: true,
    port: 8080,
    outputFormat: 'json'
  };

  const sources = await configManager.createConfigurationSources(cliOptions);
  console.log(`Created ${sources.length} configuration sources:`);
  sources.forEach(source => {
    console.log(`  - ${source.type} (priority: ${source.priority}) from ${source.source}`);
  });

  // 2. Load and merge configuration
  console.log('\n2. Loading and merging configuration...');
  const config = await configManager.loadConfiguration(sources);
  console.log('Final configuration:', JSON.stringify(config, null, 2));

  // 3. Validate configuration
  console.log('\n3. Validating configuration...');
  const validation = configManager.validateConfiguration(config);
  console.log(`Validation result: ${validation.valid ? 'VALID' : 'INVALID'}`);
  if (validation.errors.length > 0) {
    console.log('Errors:', validation.errors);
  }
  if (validation.warnings.length > 0) {
    console.log('Warnings:', validation.warnings);
  }

  // 4. Resolve specific configuration values
  console.log('\n4. Resolving specific configuration values...');
  try {
    const host = configManager.resolveConfigValue<string>('host', 'string');
    const port = configManager.resolveConfigValue<number>('port', 'number');
    const verbose = configManager.resolveConfigValue<boolean>('verbose', 'boolean');
    
    console.log(`Host: ${host}`);
    console.log(`Port: ${port}`);
    console.log(`Verbose: ${verbose}`);
  } catch (error) {
    console.error('Error resolving config values:', error);
  }

  // 5. Show environment configuration
  console.log('\n5. Environment configuration example...');
  const envSource = configManager.loadEnvironmentConfig();
  console.log('Environment variables found:', envSource.data);

  // 6. Show configuration template
  console.log('\n6. Configuration file template (YAML):');
  console.log('---');
  console.log(getConfigTemplate('yaml'));
  console.log('---');
}

// Run the demonstration if this file is executed directly
if (require.main === module) {
  demonstrateConfigurationSystem().catch(console.error);
}

export { demonstrateConfigurationSystem };
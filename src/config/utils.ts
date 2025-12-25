/**
 * Configuration Utility Functions
 * 
 * This module provides utility functions for configuration management,
 * including default source creation and validation helpers.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ConfigSource,
  CONFIG_PRIORITIES,
  DEFAULT_CLI_CONFIG,
  YAMLConfigFile,
  ValidationResult
} from './interfaces';
import { ConfigurationManager } from './ConfigurationManager';

/**
 * Create default configuration sources for common scenarios
 */
export async function createDefaultConfigSources(cliOptions: Record<string, unknown> = {}): Promise<ConfigSource[]> {
  const configManager = new ConfigurationManager();
  return await configManager.createConfigurationSources(cliOptions);
}

/**
 * Validate a configuration file without loading it into the system
 */
export async function validateConfigFile(filePath: string): Promise<ValidationResult> {
  const configManager = new ConfigurationManager();
  
  try {
    // Check if file exists and is readable
    await fs.promises.access(filePath, fs.constants.R_OK);
    
    // Load and validate the configuration
    const config = await configManager.loadYAMLConfig(filePath);
    
    // Create a temporary configuration manager to validate the loaded config
    const sources: ConfigSource[] = [
      {
        type: 'default',
        priority: CONFIG_PRIORITIES.default,
        data: { ...DEFAULT_CLI_CONFIG },
        source: 'defaults'
      },
      {
        type: 'file',
        priority: CONFIG_PRIORITIES.file,
        data: config as Record<string, unknown>,
        source: filePath
      }
    ];
    
    const mergedConfig = await configManager.loadConfiguration(sources);
    return configManager.validateConfiguration(mergedConfig);
    
  } catch (error) {
    return {
      valid: false,
      errors: [{
        field: 'file',
        message: error instanceof Error ? error.message : String(error),
        code: 'FILE_VALIDATION_ERROR',
        suggestion: 'Check file syntax and permissions'
      }],
      warnings: []
    };
  }
}

/**
 * Get configuration file template for different formats
 */
export function getConfigTemplate(format: 'yaml' | 'json' = 'yaml'): string {
  const template: YAMLConfigFile = {
    profile: 'development',
    
    // Global defaults
    host: 'localhost',
    port: 9222,
    timeout: 30000,
    outputFormat: 'text',
    verbose: false,
    quiet: false,
    debug: false,
    
    // Plugin configuration
    plugins: {
      directories: [
        '~/.chrome-cdp-cli/plugins',
        './plugins'
      ]
    },
    
    // Command aliases
    aliases: {
      ss: 'screenshot',
      snap: 'snapshot',
      js: 'eval'
    },
    
    // Profile-specific configurations
    profiles: {
      development: {
        host: 'localhost',
        port: 9222,
        debug: true,
        verbose: true
      },
      production: {
        host: 'chrome-server',
        port: 9222,
        quiet: true,
        timeout: 60000
      }
    },
    
    // Command-specific defaults
    commands: {
      screenshot: {
        timeout: 10000,
        defaults: {
          format: 'png',
          quality: 90,
          fullPage: false
        }
      },
      eval: {
        timeout: 5000,
        defaults: {
          awaitPromise: true,
          returnByValue: true
        }
      }
    }
  };
  
  if (format === 'json') {
    return JSON.stringify(template, null, 2);
  }
  
  // YAML format
  return `# Chrome CDP CLI Configuration File
# This file supports YAML syntax for better readability

# Active profile (can be overridden with --profile)
profile: development

# Global defaults
host: localhost
port: 9222
timeout: 30000
outputFormat: text
verbose: false
quiet: false
debug: false

# Plugin configuration
plugins:
  directories:
    - ~/.chrome-cdp-cli/plugins
    - ./plugins

# Command aliases
aliases:
  ss: screenshot
  snap: snapshot
  js: eval

# Profile-specific configurations
profiles:
  development:
    host: localhost
    port: 9222
    debug: true
    verbose: true
  
  production:
    host: chrome-server
    port: 9222
    quiet: true
    timeout: 60000

# Command-specific defaults
commands:
  screenshot:
    timeout: 10000
    defaults:
      format: png
      quality: 90
      fullPage: false
  
  eval:
    timeout: 5000
    defaults:
      awaitPromise: true
      returnByValue: true
`;
}

/**
 * Normalize configuration file path
 */
export function normalizeConfigPath(configPath: string): string {
  // Expand tilde to home directory
  if (configPath.startsWith('~/')) {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    return path.join(homeDir, configPath.slice(2));
  }
  
  // Resolve relative paths
  if (!path.isAbsolute(configPath)) {
    return path.resolve(process.cwd(), configPath);
  }
  
  return configPath;
}

/**
 * Check if a configuration file exists at the given path
 */
export async function configFileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(normalizeConfigPath(filePath), fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a new configuration file with default content
 */
export async function createConfigFile(filePath: string, format: 'yaml' | 'json' = 'yaml'): Promise<void> {
  const normalizedPath = normalizeConfigPath(filePath);
  const content = getConfigTemplate(format);
  
  // Ensure directory exists
  const dir = path.dirname(normalizedPath);
  await fs.promises.mkdir(dir, { recursive: true });
  
  // Write configuration file
  await fs.promises.writeFile(normalizedPath, content, 'utf-8');
}

/**
 * Get environment variable names used by the configuration system
 */
export function getEnvironmentVariables(): string[] {
  return [
    'CHROME_CDP_CLI_HOST',
    'CHROME_CDP_CLI_PORT',
    'CHROME_CDP_CLI_TIMEOUT',
    'CHROME_CDP_CLI_OUTPUT_FORMAT',
    'CHROME_CDP_CLI_VERBOSE',
    'CHROME_CDP_CLI_QUIET',
    'CHROME_CDP_CLI_DEBUG',
    'CHROME_CDP_CLI_PROFILE',
    'CHROME_CDP_CLI_CONFIG_FILE',
    'CHROME_CDP_CLI_PLUGIN_DIRS'
  ];
}
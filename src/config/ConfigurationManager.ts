/**
 * Configuration Manager Implementation
 * 
 * This module implements the configuration management system with support for
 * multiple sources, precedence handling, YAML files, and profiles.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  IConfigurationManager,
  ConfigSource,
  ConfigValueType,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  CLIConfig,
  YAMLConfigFile,
  DEFAULT_CLI_CONFIG,
  CONFIG_PRIORITIES,
  ENV_PREFIX,
  DEFAULT_CONFIG_FILES,
  DEFAULT_CONFIG_PATHS
} from './interfaces';

/**
 * Configuration Manager implementation
 */
export class ConfigurationManager implements IConfigurationManager {
  private loadedConfig?: CLIConfig;
  private configSources: ConfigSource[] = [];
  private availableProfiles: string[] = [];

  /**
   * Load configuration from multiple sources with precedence handling
   */
  async loadConfiguration(sources: ConfigSource[]): Promise<CLIConfig> {
    this.configSources = sources.sort((a, b) => a.priority - b.priority);
    
    // Start with default configuration
    let mergedConfig: CLIConfig = { ...DEFAULT_CLI_CONFIG };
    
    // Apply each source in priority order (lowest to highest)
    for (const source of this.configSources) {
      mergedConfig = this.mergeConfiguration(mergedConfig, source.data);
    }
    
    // Validate the final configuration
    const validation = this.validateConfiguration(mergedConfig);
    if (!validation.valid) {
      const errorMessages = validation.errors.map(e => `${e.field}: ${e.message}`).join(', ');
      throw new Error(`Configuration validation failed: ${errorMessages}`);
    }
    
    this.loadedConfig = mergedConfig;
    return mergedConfig;
  }

  /**
   * Validate configuration object
   */
  validateConfiguration(config: CLIConfig): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate host
    if (!config.host || typeof config.host !== 'string') {
      errors.push({
        field: 'host',
        message: 'Host must be a non-empty string',
        code: 'INVALID_HOST',
        suggestion: 'Use a valid hostname like "localhost" or IP address'
      });
    }

    // Validate port
    if (typeof config.port !== 'number' || config.port < 1 || config.port > 65535) {
      errors.push({
        field: 'port',
        message: 'Port must be a number between 1 and 65535',
        code: 'INVALID_PORT',
        suggestion: 'Use a valid port number like 9222'
      });
    }

    // Validate timeout
    if (typeof config.timeout !== 'number' || config.timeout < 1) {
      errors.push({
        field: 'timeout',
        message: 'Timeout must be a positive number',
        code: 'INVALID_TIMEOUT',
        suggestion: 'Use a timeout value in milliseconds, e.g., 30000'
      });
    }

    // Validate output format
    const validFormats = ['json', 'text', 'yaml'];
    if (!validFormats.includes(config.outputFormat)) {
      errors.push({
        field: 'outputFormat',
        message: `Output format must be one of: ${validFormats.join(', ')}`,
        code: 'INVALID_OUTPUT_FORMAT',
        suggestion: 'Use "json", "text", or "yaml"'
      });
    }

    // Validate boolean flags
    const booleanFields = ['verbose', 'quiet', 'debug'];
    for (const field of booleanFields) {
      if (typeof (config as any)[field] !== 'boolean') {
        errors.push({
          field,
          message: `${field} must be a boolean`,
          code: 'INVALID_BOOLEAN',
          suggestion: 'Use true or false'
        });
      }
    }

    // Validate plugin directories
    if (!Array.isArray(config.pluginDirs)) {
      errors.push({
        field: 'pluginDirs',
        message: 'Plugin directories must be an array',
        code: 'INVALID_PLUGIN_DIRS',
        suggestion: 'Use an array of directory paths'
      });
    } else {
      for (let i = 0; i < config.pluginDirs.length; i++) {
        if (typeof config.pluginDirs[i] !== 'string') {
          errors.push({
            field: `pluginDirs[${i}]`,
            message: 'Plugin directory path must be a string',
            code: 'INVALID_PLUGIN_DIR_PATH',
            suggestion: 'Use a valid directory path'
          });
        }
      }
    }

    // Validate aliases
    if (typeof config.aliases !== 'object' || config.aliases === null) {
      errors.push({
        field: 'aliases',
        message: 'Aliases must be an object',
        code: 'INVALID_ALIASES',
        suggestion: 'Use an object with string keys and values'
      });
    } else {
      for (const [alias, command] of Object.entries(config.aliases)) {
        if (typeof command !== 'string') {
          errors.push({
            field: `aliases.${alias}`,
            message: 'Alias target must be a string',
            code: 'INVALID_ALIAS_TARGET',
            suggestion: 'Use a valid command name'
          });
        }
      }
    }

    // Validate commands configuration
    if (typeof config.commands !== 'object' || config.commands === null) {
      errors.push({
        field: 'commands',
        message: 'Commands configuration must be an object',
        code: 'INVALID_COMMANDS_CONFIG',
        suggestion: 'Use an object with command names as keys'
      });
    }

    // Check for conflicting options
    if (config.verbose && config.quiet) {
      warnings.push({
        field: 'verbose,quiet',
        message: 'Verbose and quiet modes are conflicting',
        code: 'CONFLICTING_OPTIONS'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get configuration precedence order
   */
  getConfigurationPrecedence(): ConfigSource[] {
    return [...this.configSources];
  }

  /**
   * Resolve configuration value with type checking
   */
  resolveConfigValue<T>(key: string, type: ConfigValueType): T {
    if (!this.loadedConfig) {
      throw new Error('Configuration not loaded. Call loadConfiguration first.');
    }

    const value = this.getNestedValue(this.loadedConfig, key);
    
    if (value === undefined) {
      throw new Error(`Configuration key "${key}" not found`);
    }

    // Type validation
    if (!this.validateValueType(value, type)) {
      throw new Error(`Configuration key "${key}" has invalid type. Expected ${type}, got ${typeof value}`);
    }

    return value as T;
  }

  /**
   * Load configuration from YAML file
   */
  async loadYAMLConfig(filePath: string): Promise<YAMLConfigFile> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      
      // Try YAML first, then JSON as fallback
      let config: YAMLConfigFile;
      try {
        config = yaml.load(content) as YAMLConfigFile;
      } catch (yamlError) {
        // Fallback to JSON parsing
        config = JSON.parse(content) as YAMLConfigFile;
      }
      
      if (typeof config !== 'object' || config === null) {
        throw new Error('Configuration file must contain a valid object');
      }
      
      // Extract available profiles
      if (config.profiles) {
        this.availableProfiles = Object.keys(config.profiles);
      }
      
      return config;
    } catch (error) {
      throw new Error(`Failed to load configuration file "${filePath}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Load configuration from environment variables
   */
  loadEnvironmentConfig(): ConfigSource {
    const envConfig: Record<string, unknown> = {};
    
    // Map environment variables to configuration keys
    const envMappings = {
      [`${ENV_PREFIX}HOST`]: 'host',
      [`${ENV_PREFIX}PORT`]: 'port',
      [`${ENV_PREFIX}TIMEOUT`]: 'timeout',
      [`${ENV_PREFIX}OUTPUT_FORMAT`]: 'outputFormat',
      [`${ENV_PREFIX}VERBOSE`]: 'verbose',
      [`${ENV_PREFIX}QUIET`]: 'quiet',
      [`${ENV_PREFIX}DEBUG`]: 'debug',
      [`${ENV_PREFIX}PROFILE`]: 'profile',
      [`${ENV_PREFIX}CONFIG_FILE`]: 'configFile'
    };
    
    for (const [envVar, configKey] of Object.entries(envMappings)) {
      const value = process.env[envVar];
      if (value !== undefined) {
        envConfig[configKey] = this.parseEnvironmentValue(value, configKey);
      }
    }
    
    // Handle plugin directories (comma-separated)
    const pluginDirs = process.env[`${ENV_PREFIX}PLUGIN_DIRS`];
    if (pluginDirs) {
      envConfig.pluginDirs = pluginDirs.split(',').map(dir => dir.trim());
    }
    
    return {
      type: 'env',
      priority: CONFIG_PRIORITIES.env,
      data: envConfig,
      source: 'environment variables'
    };
  }

  /**
   * Get available profiles from configuration
   */
  getAvailableProfiles(): string[] {
    return [...this.availableProfiles];
  }

  /**
   * Load specific profile configuration
   */
  async loadProfile(profileName: string): Promise<Partial<CLIConfig>> {
    // Find configuration files and load profiles
    const configFiles = await this.findConfigurationFiles();
    
    for (const configFile of configFiles) {
      try {
        const config = await this.loadYAMLConfig(configFile);
        if (config.profiles && config.profiles[profileName]) {
          return config.profiles[profileName];
        }
      } catch (error) {
        // Continue searching in other files
        continue;
      }
    }
    
    throw new Error(`Profile "${profileName}" not found in any configuration file`);
  }

  /**
   * Create configuration sources from CLI options, environment, and files
   */
  async createConfigurationSources(cliOptions: Record<string, unknown> = {}): Promise<ConfigSource[]> {
    const sources: ConfigSource[] = [];
    
    // 1. Default configuration (lowest priority)
    sources.push({
      type: 'default',
      priority: CONFIG_PRIORITIES.default,
      data: { ...DEFAULT_CLI_CONFIG },
      source: 'defaults'
    });
    
    // 2. Configuration files
    const configFile = cliOptions.configFile as string || await this.findDefaultConfigFile();
    if (configFile) {
      try {
        const fileConfig = await this.loadYAMLConfig(configFile);
        
        // Apply profile if specified
        let profileConfig: Partial<CLIConfig> = {};
        const profileName = cliOptions.profile as string || fileConfig.profile;
        if (profileName && fileConfig.profiles && fileConfig.profiles[profileName]) {
          profileConfig = fileConfig.profiles[profileName];
        }
        
        // Merge file config with profile config
        const mergedFileConfig = this.mergeConfiguration(fileConfig, profileConfig);
        
        sources.push({
          type: 'file',
          priority: CONFIG_PRIORITIES.file,
          data: mergedFileConfig,
          source: configFile
        });
      } catch (error) {
        // If explicitly specified config file fails, throw error
        if (cliOptions.configFile) {
          throw error;
        }
        // Otherwise, silently continue without file config
      }
    }
    
    // 3. Environment variables
    sources.push(this.loadEnvironmentConfig());
    
    // 4. CLI arguments (highest priority)
    sources.push({
      type: 'cli',
      priority: CONFIG_PRIORITIES.cli,
      data: cliOptions,
      source: 'command line'
    });
    
    return sources;
  }

  /**
   * Find configuration files in default locations
   */
  private async findConfigurationFiles(): Promise<string[]> {
    const configFiles: string[] = [];
    
    for (const searchPath of DEFAULT_CONFIG_PATHS) {
      for (const fileName of DEFAULT_CONFIG_FILES) {
        const filePath = path.join(searchPath, fileName);
        try {
          await fs.promises.access(filePath, fs.constants.R_OK);
          configFiles.push(filePath);
        } catch {
          // File doesn't exist or not readable, continue
        }
      }
    }
    
    return configFiles;
  }

  /**
   * Find the first available default configuration file
   */
  private async findDefaultConfigFile(): Promise<string | null> {
    const configFiles = await this.findConfigurationFiles();
    return configFiles.length > 0 ? configFiles[0] : null;
  }

  /**
   * Merge two configuration objects with proper precedence
   */
  private mergeConfiguration(base: any, override: any): any {
    const result = { ...base };
    
    for (const [key, value] of Object.entries(override)) {
      if (value !== undefined && value !== null) {
        if (typeof value === 'object' && !Array.isArray(value) && typeof result[key] === 'object' && !Array.isArray(result[key])) {
          // Deep merge objects
          result[key] = this.mergeConfiguration(result[key], value);
        } else {
          // Direct assignment for primitives and arrays
          result[key] = value;
        }
      }
    }
    
    return result;
  }

  /**
   * Parse environment variable value to appropriate type
   */
  private parseEnvironmentValue(value: string, key: string): unknown {
    // Boolean values
    if (['verbose', 'quiet', 'debug'].includes(key)) {
      return value.toLowerCase() === 'true' || value === '1';
    }
    
    // Numeric values
    if (['port', 'timeout'].includes(key)) {
      const num = parseInt(value, 10);
      return isNaN(num) ? value : num;
    }
    
    // String values
    return value;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, key: string): unknown {
    return key.split('.').reduce((current, prop) => current?.[prop], obj);
  }

  /**
   * Validate value type
   */
  private validateValueType(value: unknown, expectedType: ConfigValueType): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return false;
    }
  }
}
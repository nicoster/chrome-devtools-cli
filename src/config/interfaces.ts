/**
 * Configuration Management Interfaces
 * 
 * This module defines the interfaces for the new configuration management system
 * that supports multiple sources, precedence handling, and YAML configuration files.
 */

/**
 * Configuration source types with priority levels
 */
export type ConfigSourceType = 'cli' | 'env' | 'file' | 'default';

/**
 * Configuration source with metadata
 */
export interface ConfigSource {
  type: ConfigSourceType;
  priority: number;
  data: Record<string, unknown>;
  source?: string; // file path or env var name
}

/**
 * Configuration value types supported by the system
 */
export type ConfigValueType = 'string' | 'number' | 'boolean' | 'array' | 'object';

/**
 * Validation result for configuration operations
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Configuration validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  suggestion?: string;
}

/**
 * Configuration validation warning
 */
export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

/**
 * Command-specific configuration
 */
export interface CommandConfig {
  timeout?: number;
  retries?: number;
  defaults: Record<string, unknown>;
}

/**
 * Enhanced CLI configuration with new features
 */
export interface CLIConfig {
  // Global options
  host: string;
  port: number;
  timeout: number;
  outputFormat: 'json' | 'text' | 'yaml';
  verbose: boolean;
  quiet: boolean;
  debug: boolean;
  
  // Advanced options
  profile?: string;
  configFile?: string;
  pluginDirs: string[];
  aliases: Record<string, string>;
  
  // Command-specific configs
  commands: Record<string, CommandConfig>;
}

/**
 * Configuration profile definition
 */
export interface ConfigProfile {
  name: string;
  description?: string;
  config: Partial<CLIConfig>;
}

/**
 * YAML configuration file structure
 */
export interface YAMLConfigFile {
  // Profile selection
  profile?: string;
  
  // Global defaults
  host?: string;
  port?: number;
  timeout?: number;
  outputFormat?: 'json' | 'text' | 'yaml';
  verbose?: boolean;
  quiet?: boolean;
  debug?: boolean;
  
  // Plugin configuration
  plugins?: {
    directories?: string[];
  };
  
  // Command aliases
  aliases?: Record<string, string>;
  
  // Profile-specific configurations
  profiles?: Record<string, Partial<CLIConfig>>;
  
  // Command-specific defaults
  commands?: Record<string, CommandConfig>;
}

/**
 * Configuration manager interface
 */
export interface IConfigurationManager {
  /**
   * Load configuration from multiple sources
   */
  loadConfiguration(sources: ConfigSource[]): Promise<CLIConfig>;
  
  /**
   * Validate configuration object
   */
  validateConfiguration(config: CLIConfig): ValidationResult;
  
  /**
   * Get configuration precedence order
   */
  getConfigurationPrecedence(): ConfigSource[];
  
  /**
   * Resolve configuration value with type checking
   */
  resolveConfigValue<T>(key: string, type: ConfigValueType): T;
  
  /**
   * Load configuration from YAML file
   */
  loadYAMLConfig(filePath: string): Promise<YAMLConfigFile>;
  
  /**
   * Load configuration from environment variables
   */
  loadEnvironmentConfig(): ConfigSource;
  
  /**
   * Get available profiles from configuration
   */
  getAvailableProfiles(): string[];
  
  /**
   * Load specific profile configuration
   */
  loadProfile(profileName: string): Promise<Partial<CLIConfig>>;
}

/**
 * Default configuration values
 */
export const DEFAULT_CLI_CONFIG: CLIConfig = {
  host: 'localhost',
  port: 9222,
  timeout: 30000,
  outputFormat: 'text',
  verbose: false,
  quiet: false,
  debug: false,
  pluginDirs: [],
  aliases: {},
  commands: {}
};

/**
 * Configuration source priorities (higher number = higher priority)
 */
export const CONFIG_PRIORITIES = {
  default: 0,
  file: 10,
  env: 20,
  cli: 30
} as const;

/**
 * Environment variable prefix for CLI configuration
 */
export const ENV_PREFIX = 'CHROME_CDP_CLI_';

/**
 * Default configuration file names to search for
 */
export const DEFAULT_CONFIG_FILES = [
  '.chrome-cdp-cli.yaml',
  '.chrome-cdp-cli.yml',
  '.chrome-cdp-cli.json',
  'chrome-cdp-cli.config.yaml',
  'chrome-cdp-cli.config.yml',
  'chrome-cdp-cli.config.json'
] as const;

/**
 * Default configuration search paths
 */
export const DEFAULT_CONFIG_PATHS = [
  process.cwd(),
  process.env.HOME || process.env.USERPROFILE || '',
  '/etc'
] as const;
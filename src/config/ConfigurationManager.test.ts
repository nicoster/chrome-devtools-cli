/**
 * Configuration Manager Tests
 * 
 * Unit tests for the configuration management system including
 * validation, precedence handling, and YAML support.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigurationManager } from './ConfigurationManager';
import {
  ConfigSource,
  CONFIG_PRIORITIES,
  DEFAULT_CLI_CONFIG
} from './interfaces';

describe('ConfigurationManager', () => {
  let configManager: ConfigurationManager;
  let tempDir: string;

  beforeEach(() => {
    configManager = new ConfigurationManager();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('loadConfiguration', () => {
    it('should merge configuration sources by priority', async () => {
      const sources: ConfigSource[] = [
        {
          type: 'default',
          priority: CONFIG_PRIORITIES.default,
          data: { host: 'localhost', port: 9222, verbose: false },
          source: 'defaults'
        },
        {
          type: 'file',
          priority: CONFIG_PRIORITIES.file,
          data: { port: 8080, debug: true },
          source: 'config.yaml'
        },
        {
          type: 'cli',
          priority: CONFIG_PRIORITIES.cli,
          data: { verbose: true },
          source: 'command line'
        }
      ];

      const config = await configManager.loadConfiguration(sources);

      expect(config.host).toBe('localhost'); // from default
      expect(config.port).toBe(8080); // from file (overrides default)
      expect(config.verbose).toBe(true); // from CLI (overrides default)
      expect(config.debug).toBe(true); // from file
    });

    it('should validate configuration and throw on invalid config', async () => {
      const sources: ConfigSource[] = [
        {
          type: 'cli',
          priority: CONFIG_PRIORITIES.cli,
          data: { port: 'invalid' }, // Invalid port
          source: 'command line'
        }
      ];

      await expect(configManager.loadConfiguration(sources)).rejects.toThrow('Configuration validation failed');
    });
  });

  describe('validateConfiguration', () => {
    it('should validate valid configuration', () => {
      const config = { ...DEFAULT_CLI_CONFIG };
      const result = configManager.validateConfiguration(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid host', () => {
      const config = { ...DEFAULT_CLI_CONFIG, host: '' };
      const result = configManager.validateConfiguration(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'host',
          code: 'INVALID_HOST'
        })
      );
    });

    it('should detect invalid port', () => {
      const config = { ...DEFAULT_CLI_CONFIG, port: 70000 };
      const result = configManager.validateConfiguration(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'port',
          code: 'INVALID_PORT'
        })
      );
    });

    it('should detect conflicting verbose and quiet options', () => {
      const config = { ...DEFAULT_CLI_CONFIG, verbose: true, quiet: true };
      const result = configManager.validateConfiguration(config);

      expect(result.valid).toBe(true); // Still valid, but has warnings
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'verbose,quiet',
          code: 'CONFLICTING_OPTIONS'
        })
      );
    });
  });

  describe('loadYAMLConfig', () => {
    it('should load valid YAML configuration', async () => {
      const yamlContent = `
profile: development
host: localhost
port: 9222
verbose: true
profiles:
  development:
    debug: true
  production:
    quiet: true
`;
      const configFile = path.join(tempDir, 'config.yaml');
      fs.writeFileSync(configFile, yamlContent);

      const config = await configManager.loadYAMLConfig(configFile);

      expect(config.profile).toBe('development');
      expect(config.host).toBe('localhost');
      expect(config.port).toBe(9222);
      expect(config.verbose).toBe(true);
      expect(config.profiles).toEqual({
        development: { debug: true },
        production: { quiet: true }
      });
    });

    it('should load valid JSON configuration as fallback', async () => {
      const jsonContent = JSON.stringify({
        host: 'localhost',
        port: 8080,
        verbose: false
      });
      const configFile = path.join(tempDir, 'config.json');
      fs.writeFileSync(configFile, jsonContent);

      const config = await configManager.loadYAMLConfig(configFile);

      expect(config.host).toBe('localhost');
      expect(config.port).toBe(8080);
      expect(config.verbose).toBe(false);
    });

    it('should throw error for invalid file', async () => {
      const invalidFile = path.join(tempDir, 'nonexistent.yaml');

      await expect(configManager.loadYAMLConfig(invalidFile)).rejects.toThrow('Failed to load configuration file');
    });
  });

  describe('loadEnvironmentConfig', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should load configuration from environment variables', () => {
      process.env.CHROME_CDP_CLI_HOST = 'test-host';
      process.env.CHROME_CDP_CLI_PORT = '8080';
      process.env.CHROME_CDP_CLI_VERBOSE = 'true';
      process.env.CHROME_CDP_CLI_PLUGIN_DIRS = 'dir1,dir2,dir3';

      const source = configManager.loadEnvironmentConfig();

      expect(source.type).toBe('env');
      expect(source.priority).toBe(CONFIG_PRIORITIES.env);
      expect(source.data).toEqual({
        host: 'test-host',
        port: 8080,
        verbose: true,
        pluginDirs: ['dir1', 'dir2', 'dir3']
      });
    });

    it('should handle boolean environment variables correctly', () => {
      process.env.CHROME_CDP_CLI_DEBUG = 'false';
      process.env.CHROME_CDP_CLI_QUIET = '0';

      const source = configManager.loadEnvironmentConfig();

      expect(source.data).toEqual(
        expect.objectContaining({
          debug: false,
          quiet: false
        })
      );
    });
  });

  describe('resolveConfigValue', () => {
    beforeEach(async () => {
      const sources: ConfigSource[] = [
        {
          type: 'default',
          priority: CONFIG_PRIORITIES.default,
          data: { ...DEFAULT_CLI_CONFIG },
          source: 'defaults'
        }
      ];
      await configManager.loadConfiguration(sources);
    });

    it('should resolve existing configuration value', () => {
      const host = configManager.resolveConfigValue<string>('host', 'string');
      expect(host).toBe('localhost');
    });

    it('should throw error for non-existent key', () => {
      expect(() => {
        configManager.resolveConfigValue<string>('nonexistent', 'string');
      }).toThrow('Configuration key "nonexistent" not found');
    });

    it('should throw error for type mismatch', () => {
      expect(() => {
        configManager.resolveConfigValue<number>('host', 'number');
      }).toThrow('Configuration key "host" has invalid type');
    });
  });

  describe('createConfigurationSources', () => {
    it('should create sources with proper precedence', async () => {
      const cliOptions = { verbose: true, port: 8080 };
      const sources = await configManager.createConfigurationSources(cliOptions);

      expect(sources.length).toBeGreaterThanOrEqual(3); // default, env, cli (file optional)
      
      // Check that CLI has highest priority
      const cliSource = sources.find(s => s.type === 'cli');
      const defaultSource = sources.find(s => s.type === 'default');
      
      expect(cliSource?.priority).toBeGreaterThan(defaultSource?.priority || 0);
      expect(cliSource?.data).toEqual(cliOptions);
    });
  });
});
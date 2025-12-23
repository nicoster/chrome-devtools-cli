import { CLICommand, CLIConfig, CommandResult } from '../types';

/**
 * CLI Interface for parsing command line arguments and routing commands
 */
export interface ICLIInterface {
  /**
   * Parse command line arguments into a structured command
   */
  parseArgs(argv: string[]): CLICommand;
  
  /**
   * Execute a parsed command
   */
  execute(command: CLICommand): Promise<CommandResult>;
  
  /**
   * Format command output according to specified format
   */
  formatOutput(result: CommandResult, format: string): string;
}

/**
 * Default CLI configuration
 */
export const DEFAULT_CLI_CONFIG: CLIConfig = {
  host: 'localhost',
  port: 9222,
  outputFormat: 'text',
  verbose: false,
  quiet: false,
  timeout: 30000,
  debug: false
};
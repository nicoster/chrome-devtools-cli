/**
 * Interfaces for the enhanced argument parser system
 */

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Command example for help documentation
 */
export interface CommandExample {
  command: string;
  description?: string;
}

/**
 * Option definition for command schema
 */
export interface OptionDefinition {
  name: string;
  short?: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  required?: boolean;
  default?: unknown;
  choices?: string[];
  validator?: (value: unknown) => ValidationResult;
}

/**
 * Argument definition for command schema
 */
export interface ArgumentDefinition {
  name: string;
  description: string;
  type: 'string' | 'number' | 'file' | 'url';
  required?: boolean;
  variadic?: boolean;
  validator?: (value: unknown) => ValidationResult;
}

/**
 * Command definition with complete schema
 */
export interface CommandDefinition {
  name: string;
  aliases: string[];
  description: string;
  usage: string;
  examples: CommandExample[];
  options: OptionDefinition[];
  arguments: ArgumentDefinition[];
  subcommands?: CommandDefinition[];
}

/**
 * Parsed arguments structure
 */
export interface ParsedArguments {
  options: Record<string, unknown>;
  arguments: unknown[];
}

/**
 * Parse result from argument parser
 */
export interface ParseResult {
  success: boolean;
  command: string;
  options: Record<string, unknown>;
  arguments: unknown[];
  errors: string[];
  warnings: string[];
}

/**
 * Main argument parser interface
 */
export interface IArgumentParser {
  /**
   * Parse command line arguments according to registered schemas
   */
  parseArguments(argv: string[]): ParseResult;

  /**
   * Register a command definition with the parser
   */
  registerCommand(command: CommandDefinition): void;

  /**
   * Generate help text for a command or general help
   */
  generateHelp(command?: string): string;

  /**
   * Validate arguments against command definition
   */
  validateArguments(command: string, args: ParsedArguments): ValidationResult;

  /**
   * Get all registered commands
   */
  getCommands(): CommandDefinition[];

  /**
   * Get command by name
   */
  getCommand(name: string): CommandDefinition | undefined;

  /**
   * Check if command exists
   */
  hasCommand(name: string): boolean;
}
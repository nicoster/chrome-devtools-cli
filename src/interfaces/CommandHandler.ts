import { CommandResult, CDPClient } from '../types';

/**
 * Base interface for all command handlers
 */
export interface ICommandHandler {
  /**
   * Command name identifier
   */
  readonly name: string;
  
  /**
   * Execute the command with given arguments
   */
  execute(client: CDPClient, args: unknown): Promise<CommandResult>;
  
  /**
   * Validate command arguments
   */
  validateArgs?(args: unknown): boolean;
  
  /**
   * Get command help text
   */
  getHelp?(): string;
}

/**
 * Registry for managing command handlers
 */
export interface ICommandRegistry {
  /**
   * Register a command handler
   */
  register(handler: ICommandHandler): void;
  
  /**
   * Get a command handler by name
   */
  get(name: string): ICommandHandler | undefined;
  
  /**
   * Get all registered command names
   */
  getCommandNames(): string[];
  
  /**
   * Check if a command is registered
   */
  has(name: string): boolean;
}
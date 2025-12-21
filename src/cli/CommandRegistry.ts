import { ICommandHandler, ICommandRegistry } from '../interfaces/CommandHandler';

/**
 * Registry for managing command handlers
 * Provides centralized registration and lookup of command handlers
 */
export class CommandRegistry implements ICommandRegistry {
  private handlers: Map<string, ICommandHandler> = new Map();

  /**
   * Register a command handler
   */
  register(handler: ICommandHandler): void {
    if (this.handlers.has(handler.name)) {
      throw new Error(`Command handler "${handler.name}" is already registered`);
    }
    
    this.handlers.set(handler.name, handler);
  }

  /**
   * Get a command handler by name
   */
  get(name: string): ICommandHandler | undefined {
    return this.handlers.get(name);
  }

  /**
   * Get all registered command names
   */
  getCommandNames(): string[] {
    return Array.from(this.handlers.keys()).sort();
  }

  /**
   * Check if a command is registered
   */
  has(name: string): boolean {
    return this.handlers.has(name);
  }

  /**
   * Unregister a command handler
   */
  unregister(name: string): boolean {
    return this.handlers.delete(name);
  }

  /**
   * Clear all registered handlers
   */
  clear(): void {
    this.handlers.clear();
  }

  /**
   * Get the number of registered handlers
   */
  size(): number {
    return this.handlers.size;
  }
}
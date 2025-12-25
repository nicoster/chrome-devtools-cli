import { 
  IArgumentParser, 
  CommandDefinition, 
  OptionDefinition, 
  ArgumentDefinition, 
  ParseResult, 
  ParsedArguments, 
  ValidationResult
} from './interfaces/ArgumentParser';
import { HelpSystem } from './HelpSystem';

/**
 * Enhanced argument parser with schema validation and consistent option handling
 * Supports command definitions, option schemas, and boolean negation
 */
export class ArgumentParser implements IArgumentParser {
  private commands: Map<string, CommandDefinition> = new Map();
  private aliases: Map<string, string> = new Map();
  private helpSystem: HelpSystem;

  constructor() {
    this.helpSystem = new HelpSystem(undefined, this);
  }

  /**
   * Parse command line arguments according to registered command definitions
   */
  parseArguments(argv: string[]): ParseResult {
    try {
      // Safely extract arguments, ensuring we have a valid array
      if (!Array.isArray(argv)) {
        return this.createParseResult('help', {}, [], true);
      }
      
      // Ensure we have at least 2 elements before slicing
      // Use Math.max to ensure sliceStart is at least 0
      const sliceStart = Math.max(0, Math.min(2, argv.length));
      const args = argv.slice(sliceStart); // Remove node and script path
      
      if (args.length === 0) {
        return this.createParseResult('help', {}, [], true);
      }

      // Handle help flag early (before parsing)
      if (args.includes('--help')) {
        return this.createParseResult('help', {}, [], true);
      }

      // Handle version flag
      if (args.includes('--version') || args.includes('-V')) {
        return this.createParseResult('version', {}, [], true);
      }

      // Parse global options and command
      let globalOptions: Record<string, unknown>;
      let commandName: string;
      let commandArgs: string[];
      
      try {
        const parseResult = this.parseGlobalAndCommand(args);
        globalOptions = parseResult.globalOptions;
        commandName = parseResult.commandName;
        commandArgs = parseResult.commandArgs;
      } catch (parseError) {
        // If parsing fails, check if it's a help request
        if (args.some(arg => arg === '--help' || arg === 'help')) {
          return this.createParseResult('help', {}, [], true);
        }
        throw parseError;
      }
      
      // Resolve command name (handle aliases)
      const resolvedCommand = this.resolveCommandName(commandName);
      
      // For help command, always succeed even if not registered
      if (resolvedCommand === 'help') {
        return this.createParseResult(resolvedCommand, globalOptions, [], true, commandArgs);
      }
      
      // Get command definition
      const commandDef = this.commands.get(resolvedCommand);
      if (!commandDef) {
        return this.createParseResult(
          resolvedCommand, 
          globalOptions, 
          [`Unknown command: ${commandName}. Use 'help' to see available commands.`],
          false
        );
      }

      // Parse command-specific arguments
      const parseResult = this.parseCommandArguments(commandDef, commandArgs);
      
      // Merge global options with command options
      const allOptions = { ...globalOptions, ...parseResult.options };
      
      return this.createParseResult(
        resolvedCommand,
        allOptions,
        parseResult.errors,
        parseResult.errors.length === 0,
        parseResult.arguments
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Log the full error for debugging
      if (process.env.DEBUG) {
        console.error('Parse error details:', error);
        if (error instanceof Error && error.stack) {
          console.error('Stack trace:', error.stack);
        }
      }
      // If error is "Invalid count value", it might be from array.slice()
      // Try to provide a more helpful error message
      if (errorMessage.includes('Invalid count value')) {
        return this.createParseResult(
          'help',
          {},
          [`Parse error: Invalid argument format. Please check your command syntax.`],
          false
        );
      }
      return this.createParseResult(
        'help',
        {},
        [`Parse error: ${errorMessage}`],
        false
      );
    }
  }

  /**
   * Register a command definition with the parser
   */
  registerCommand(command: CommandDefinition): void {
    // Validate command definition
    const validation = this.validateCommandDefinition(command);
    if (!validation.valid) {
      throw new Error(`Invalid command definition: ${validation.errors.join(', ')}`);
    }

    // Register main command name
    this.commands.set(command.name, command);
    
    // Register aliases
    for (const alias of command.aliases) {
      if (this.aliases.has(alias)) {
        throw new Error(`Alias '${alias}' is already registered for command '${this.aliases.get(alias)}'`);
      }
      this.aliases.set(alias, command.name);
    }
  }

  /**
   * Generate help text for a command or general help
   */
  generateHelp(command?: string): string {
    if (command) {
      // Check if it's a help topic request
      if (command.startsWith('topic ')) {
        const topicName = command.substring(6);
        return this.helpSystem.generateTopicHelp(topicName);
      }
      return this.helpSystem.generateCommandHelp(command);
    }
    return this.helpSystem.generateGeneralHelp();
  }

  /**
   * Validate arguments against command definition
   */
  validateArguments(command: string, args: ParsedArguments): ValidationResult {
    const commandDef = this.commands.get(command);
    if (!commandDef) {
      return {
        valid: false,
        errors: [`Unknown command: ${command}`],
        warnings: []
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required options
    for (const option of commandDef.options) {
      if (option.required && !(option.name in args.options)) {
        errors.push(`Required option --${option.name} is missing`);
      }
    }

    // Validate required arguments
    const requiredArgs = commandDef.arguments.filter(arg => arg.required);
    if (args.arguments.length < requiredArgs.length) {
      const providedCount = Math.max(0, Math.min(args.arguments.length, requiredArgs.length));
      const missingCount = Math.max(0, requiredArgs.length - providedCount);
      if (missingCount > 0) {
        const startIndex = Math.max(0, providedCount);
        const endIndex = Math.min(requiredArgs.length, startIndex + missingCount);
        if (startIndex < endIndex && startIndex >= 0 && endIndex <= requiredArgs.length) {
          const missingArgs = requiredArgs.slice(startIndex, endIndex).map(arg => arg.name);
          if (missingArgs.length > 0) {
            errors.push(`Missing required arguments: ${missingArgs.join(', ')}`);
          }
        }
      }
    }

    // Validate option types and constraints
    for (const [optionName, value] of Object.entries(args.options)) {
      const optionDef = commandDef.options.find(opt => opt.name === optionName);
      if (optionDef) {
        const optionValidation = this.validateOptionValue(optionDef, value);
        if (!optionValidation.valid) {
          errors.push(...optionValidation.errors);
        }
        warnings.push(...optionValidation.warnings);
      }
    }

    // Validate argument types
    for (let i = 0; i < args.arguments.length; i++) {
      const argDef = commandDef.arguments[i];
      if (argDef) {
        const argValidation = this.validateArgumentValue(argDef, args.arguments[i]);
        if (!argValidation.valid) {
          errors.push(...argValidation.errors);
        }
        warnings.push(...argValidation.warnings);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Parse global options and extract command name and remaining arguments
   */
  private parseGlobalAndCommand(args: string[]): {
    globalOptions: Record<string, unknown>;
    commandName: string;
    commandArgs: string[];
  } {
    // Check for help flag first, before any parsing
    if (args.includes('--help')) {
      return { globalOptions: {}, commandName: 'help', commandArgs: [] };
    }

    const globalOptions: Record<string, unknown> = {};
    let commandName = 'help';
    let commandArgs: string[] = [];
    let i = 0;

    // Global option definitions
    const globalOptionDefs: OptionDefinition[] = [
      { name: 'host', short: 'h', type: 'string', description: 'Chrome host address', default: 'localhost' },
      { name: 'port', short: 'p', type: 'number', description: 'DevTools port', default: 9222 },
      { name: 'format', short: 'f', type: 'string', description: 'Output format', choices: ['json', 'text'], default: 'text' },
      { name: 'verbose', short: 'v', type: 'boolean', description: 'Enable verbose logging', default: false },
      { name: 'quiet', short: 'q', type: 'boolean', description: 'Enable quiet mode', default: false },
      { name: 'timeout', short: 't', type: 'number', description: 'Command timeout in milliseconds', default: 30000 },
      { name: 'debug', short: 'd', type: 'boolean', description: 'Enable debug logging', default: false },
      { name: 'config', short: 'c', type: 'string', description: 'Configuration file path' }
    ];

    while (i < args.length) {
      const arg = args[i];

      if (arg.startsWith('--')) {
        const { option, value, consumed } = this.parseLongOption(arg, args, i, globalOptionDefs);
        if (option) {
          globalOptions[option.name] = value;
          const validConsumed = Math.max(1, Math.min(consumed, 2));
          i += validConsumed;
        } else {
          // Unknown long option - continue parsing as it might be a command
          commandName = arg.substring(2);
          const nextIndex = i + 1;
          if (nextIndex >= 0 && nextIndex <= args.length) {
            commandArgs = args.slice(nextIndex);
          } else {
            commandArgs = [];
          }
          break;
        }
      } else if (arg.startsWith('-') && arg.length > 1) {
        const { option, value, consumed } = this.parseShortOption(arg, args, i, globalOptionDefs);
        if (option) {
          globalOptions[option.name] = value;
          const validConsumed = Math.max(1, Math.min(consumed || 1, 2));
          i += validConsumed;
        } else {
          // Unknown short option - continue parsing as it might be a command
          commandName = arg.substring(1);
          const nextIndex = i + 1;
          if (nextIndex >= 0 && nextIndex <= args.length) {
            commandArgs = args.slice(nextIndex);
          } else {
            commandArgs = [];
          }
          break;
        }
      } else {
        // First non-option argument is the command
        commandName = arg;
        const nextIndex = i + 1;
        if (nextIndex >= 0 && nextIndex <= args.length) {
          commandArgs = args.slice(nextIndex);
        } else {
          commandArgs = [];
        }
        break;
      }
    }

    return { globalOptions, commandName, commandArgs };
  }

  /**
   * Parse long option (--option or --option=value or --no-option)
   */
  private parseLongOption(
    arg: string, 
    args: string[], 
    index: number, 
    optionDefs: OptionDefinition[]
  ): { option: OptionDefinition | null; value: unknown; consumed: number } {
    let optionName = arg.substring(2);
    let value: unknown;
    let consumed = 1;

    // Handle --option=value format
    const equalIndex = optionName.indexOf('=');
    if (equalIndex !== -1) {
      value = optionName.substring(equalIndex + 1);
      optionName = optionName.substring(0, equalIndex);
    }

    // Handle boolean negation (--no-option)
    let isNegated = false;
    if (optionName.startsWith('no-')) {
      isNegated = true;
      optionName = optionName.substring(3);
    }

    // Find option definition
    const optionDef = optionDefs.find(opt => opt.name === optionName);
    if (!optionDef) {
      return { option: null, value: null, consumed: 0 };
    }

    // Handle boolean options
    if (optionDef.type === 'boolean') {
      value = !isNegated;
    } else if (value === undefined) {
      // Get value from next argument
      if (index + 1 < args.length && !args[index + 1].startsWith('-')) {
        value = args[index + 1];
        consumed = 2;
      } else {
        throw new Error(`Option --${optionName} requires a value`);
      }
    }

    // Convert value to appropriate type
    value = this.convertOptionValue(optionDef, value);

    return { option: optionDef, value, consumed };
  }

  /**
   * Parse short option (-o or -o value)
   */
  private parseShortOption(
    arg: string, 
    args: string[], 
    index: number, 
    optionDefs: OptionDefinition[]
  ): { option: OptionDefinition | null; value: unknown; consumed: number } {
    const shortName = arg.substring(1);
    
    // Only match single character short options (e.g., -h, -p, not -help)
    if (shortName.length > 1) {
      return { option: null, value: null, consumed: 0 };
    }
    
    // Find option definition by short name
    const optionDef = optionDefs.find(opt => opt.short === shortName);
    if (!optionDef) {
      return { option: null, value: null, consumed: 0 };
    }

    let value: unknown;
    let consumed = 1;

    // Handle boolean options
    if (optionDef.type === 'boolean') {
      value = true;
    } else {
      // Get value from next argument
      if (index + 1 < args.length && !args[index + 1].startsWith('-')) {
        value = args[index + 1];
        consumed = 2;
      } else {
        throw new Error(`Option -${shortName} requires a value`);
      }
    }

    // Convert value to appropriate type
    try {
      value = this.convertOptionValue(optionDef, value);
    } catch (error) {
      throw new Error(`Invalid value for option -${shortName}: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Ensure consumed is valid
    if (consumed < 1 || consumed > 2) {
      consumed = 1;
    }

    return { option: optionDef, value, consumed };
  }

  /**
   * Parse command-specific arguments and options
   */
  private parseCommandArguments(commandDef: CommandDefinition, args: string[]): {
    options: Record<string, unknown>;
    arguments: unknown[];
    errors: string[];
  } {
    const options: Record<string, unknown> = {};
    const arguments_: unknown[] = [];
    const errors: string[] = [];
    let i = 0;

    while (i < args.length) {
      const arg = args[i];

      if (arg.startsWith('--')) {
        try {
          const { option, value, consumed } = this.parseLongOption(arg, args, i, commandDef.options);
          if (option) {
            options[option.name] = value;
            if (consumed > 0) {
              i += consumed;
            } else {
              i++;
            }
          } else {
            errors.push(`Unknown option: ${arg}`);
            i++;
          }
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error));
          i++;
        }
      } else if (arg.startsWith('-') && arg.length > 1) {
        try {
          const { option, value, consumed } = this.parseShortOption(arg, args, i, commandDef.options);
          if (option) {
            options[option.name] = value;
            if (consumed > 0) {
              i += consumed;
            } else {
              i++;
            }
          } else {
            errors.push(`Unknown option: ${arg}`);
            i++;
          }
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error));
          i++;
        }
      } else {
        // Positional argument
        arguments_.push(arg);
        i++;
      }
    }

    return { options, arguments: arguments_, errors };
  }

  /**
   * Convert option value to appropriate type
   */
  private convertOptionValue(optionDef: OptionDefinition, value: unknown): unknown {
    if (value === undefined || value === null) {
      return optionDef.default;
    }

    const stringValue = String(value);

    switch (optionDef.type) {
      case 'number':
        const numValue = Number(stringValue);
        if (isNaN(numValue)) {
          throw new Error(`Option --${optionDef.name} must be a number, got: ${stringValue}`);
        }
        return numValue;

      case 'boolean':
        if (typeof value === 'boolean') {
          return value;
        }
        const lowerValue = stringValue.toLowerCase();
        if (lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes') {
          return true;
        }
        if (lowerValue === 'false' || lowerValue === '0' || lowerValue === 'no') {
          return false;
        }
        throw new Error(`Option --${optionDef.name} must be a boolean, got: ${stringValue}`);

      case 'array':
        if (Array.isArray(value)) {
          return value;
        }
        return stringValue.split(',').map(s => s.trim());

      case 'string':
      default:
        return stringValue;
    }
  }

  /**
   * Validate option value against definition constraints
   */
  private validateOptionValue(optionDef: OptionDefinition, value: unknown): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check choices constraint
    if (optionDef.choices && optionDef.choices.length > 0) {
      if (!optionDef.choices.includes(String(value))) {
        errors.push(`Option --${optionDef.name} must be one of: ${optionDef.choices.join(', ')}`);
      }
    }

    // Run custom validator if provided
    if (optionDef.validator) {
      const validationResult = optionDef.validator(value);
      if (!validationResult.valid) {
        errors.push(...validationResult.errors);
        warnings.push(...validationResult.warnings);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate argument value against definition constraints
   */
  private validateArgumentValue(argDef: ArgumentDefinition, value: unknown): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Type validation
    switch (argDef.type) {
      case 'number':
        if (isNaN(Number(value))) {
          errors.push(`Argument ${argDef.name} must be a number, got: ${value}`);
        }
        break;
      case 'file':
        // Basic file path validation (more comprehensive validation would check file existence)
        if (typeof value !== 'string' || value.trim().length === 0) {
          errors.push(`Argument ${argDef.name} must be a valid file path`);
        }
        break;
      case 'url':
        // Basic URL validation
        try {
          new URL(String(value));
        } catch {
          errors.push(`Argument ${argDef.name} must be a valid URL`);
        }
        break;
    }

    // Run custom validator if provided
    if (argDef.validator) {
      const validationResult = argDef.validator(value);
      if (!validationResult.valid) {
        errors.push(...validationResult.errors);
        warnings.push(...validationResult.warnings);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Resolve command name (handle aliases)
   */
  private resolveCommandName(commandName: string): string {
    return this.aliases.get(commandName) || commandName;
  }

  /**
   * Validate command definition structure
   */
  private validateCommandDefinition(command: CommandDefinition): ValidationResult {
    const errors: string[] = [];

    if (!command.name || typeof command.name !== 'string') {
      errors.push('Command name is required and must be a string');
    }

    if (!command.description || typeof command.description !== 'string') {
      errors.push('Command description is required and must be a string');
    }

    if (!Array.isArray(command.aliases)) {
      errors.push('Command aliases must be an array');
    }

    if (!Array.isArray(command.options)) {
      errors.push('Command options must be an array');
    }

    if (!Array.isArray(command.arguments)) {
      errors.push('Command arguments must be an array');
    }

    // Validate option definitions
    for (const option of command.options) {
      if (!option.name || typeof option.name !== 'string') {
        errors.push(`Option name is required and must be a string`);
      }
      if (!['string', 'number', 'boolean', 'array'].includes(option.type)) {
        errors.push(`Option ${option.name} has invalid type: ${option.type}`);
      }
    }

    // Validate argument definitions
    for (const arg of command.arguments) {
      if (!arg.name || typeof arg.name !== 'string') {
        errors.push(`Argument name is required and must be a string`);
      }
      if (!['string', 'number', 'file', 'url'].includes(arg.type)) {
        errors.push(`Argument ${arg.name} has invalid type: ${arg.type}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  /**
   * Create a parse result object
   */
  private createParseResult(
    command: string,
    options: Record<string, unknown>,
    errors: string[],
    success: boolean,
    arguments_: unknown[] = []
  ): ParseResult {
    return {
      success,
      command,
      options,
      arguments: arguments_,
      errors,
      warnings: []
    };
  }

  /**
   * Get all registered commands
   */
  getCommands(): CommandDefinition[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get command by name
   */
  getCommand(name: string): CommandDefinition | undefined {
    const resolvedName = this.resolveCommandName(name);
    return this.commands.get(resolvedName);
  }

  /**
   * Check if command exists
   */
  hasCommand(name: string): boolean {
    const resolvedName = this.resolveCommandName(name);
    return this.commands.has(resolvedName);
  }

  /**
   * Generate contextual help for command failures
   */
  generateContextualHelp(error: string, commandName?: string): string {
    return this.helpSystem.generateContextualHelp(error, commandName);
  }

  /**
   * Get help system instance for advanced usage
   */
  getHelpSystem(): HelpSystem {
    return this.helpSystem;
  }
}
import { ArgumentParser } from './ArgumentParser';
import { CommandDefinition } from './interfaces/ArgumentParser';

describe('ArgumentParser', () => {
  let parser: ArgumentParser;

  beforeEach(() => {
    parser = new ArgumentParser();
  });

  describe('Command Registration', () => {
    it('should register a command successfully', () => {
      const command: CommandDefinition = {
        name: 'test',
        aliases: ['t'],
        description: 'Test command',
        usage: 'test [options]',
        examples: [],
        options: [],
        arguments: []
      };

      expect(() => parser.registerCommand(command)).not.toThrow();
      expect(parser.hasCommand('test')).toBe(true);
      expect(parser.hasCommand('t')).toBe(true); // alias
    });

    it('should throw error for invalid command definition', () => {
      const invalidCommand = {
        name: '',
        aliases: [],
        description: '',
        usage: '',
        examples: [],
        options: [],
        arguments: []
      } as CommandDefinition;

      expect(() => parser.registerCommand(invalidCommand)).toThrow();
    });

    it('should throw error for duplicate alias', () => {
      const command1: CommandDefinition = {
        name: 'test1',
        aliases: ['t'],
        description: 'Test command 1',
        usage: 'test1',
        examples: [],
        options: [],
        arguments: []
      };

      const command2: CommandDefinition = {
        name: 'test2',
        aliases: ['t'], // Same alias
        description: 'Test command 2',
        usage: 'test2',
        examples: [],
        options: [],
        arguments: []
      };

      parser.registerCommand(command1);
      expect(() => parser.registerCommand(command2)).toThrow();
    });
  });

  describe('Global Option Parsing', () => {
    it('should parse long global options correctly', () => {
      const result = parser.parseArguments(['node', 'script.js', '--host', 'example.com', '--port', '9223', 'help']);
      
      expect(result.success).toBe(true);
      expect(result.command).toBe('help');
      expect(result.options.host).toBe('example.com');
      expect(result.options.port).toBe(9223);
    });

    it('should parse short global options correctly', () => {
      const result = parser.parseArguments(['node', 'script.js', '-h', 'localhost', '-p', '9222', 'help']);
      
      expect(result.success).toBe(true);
      expect(result.options.host).toBe('localhost');
      expect(result.options.port).toBe(9222);
    });

    it('should parse boolean options correctly', () => {
      const result = parser.parseArguments(['node', 'script.js', '--verbose', '--debug', 'help']);
      
      expect(result.success).toBe(true);
      expect(result.options.verbose).toBe(true);
      expect(result.options.debug).toBe(true);
    });

    it('should parse boolean negation correctly', () => {
      const result = parser.parseArguments(['node', 'script.js', '--no-verbose', '--no-debug', 'help']);
      
      expect(result.success).toBe(true);
      expect(result.options.verbose).toBe(false);
      expect(result.options.debug).toBe(false);
    });

    it('should parse option=value format correctly', () => {
      const result = parser.parseArguments(['node', 'script.js', '--host=example.com', '--port=9223', 'help']);
      
      expect(result.success).toBe(true);
      expect(result.options.host).toBe('example.com');
      expect(result.options.port).toBe(9223);
    });

    it('should handle format choices validation', () => {
      const result = parser.parseArguments(['node', 'script.js', '--format', 'json', 'help']);
      
      expect(result.success).toBe(true);
      expect(result.options.format).toBe('json');
    });
  });

  describe('Command-Specific Parsing', () => {
    beforeEach(() => {
      // Register a test command with options and arguments
      const testCommand: CommandDefinition = {
        name: 'test',
        aliases: ['t'],
        description: 'Test command',
        usage: 'test [options] <arg1> [arg2]',
        examples: [],
        options: [
          {
            name: 'option1',
            short: 'o',
            description: 'Test option 1',
            type: 'string',
            required: true
          },
          {
            name: 'flag',
            short: 'f',
            description: 'Test flag',
            type: 'boolean',
            default: false
          },
          {
            name: 'number',
            short: 'n',
            description: 'Test number',
            type: 'number'
          }
        ],
        arguments: [
          {
            name: 'arg1',
            description: 'First argument',
            type: 'string',
            required: true
          },
          {
            name: 'arg2',
            description: 'Second argument',
            type: 'string',
            required: false
          }
        ]
      };
      parser.registerCommand(testCommand);
    });

    it('should parse command with options and arguments', () => {
      const result = parser.parseArguments([
        'node', 'script.js', 'test', 
        '--option1', 'value1', 
        '--flag', 
        '--number', '42',
        'arg1_value', 'arg2_value'
      ]);
      
      expect(result.success).toBe(true);
      expect(result.command).toBe('test');
      expect(result.options.option1).toBe('value1');
      expect(result.options.flag).toBe(true);
      expect(result.options.number).toBe(42);
      expect(result.arguments).toEqual(['arg1_value', 'arg2_value']);
    });

    it('should parse command using alias', () => {
      const result = parser.parseArguments([
        'node', 'script.js', 't', 
        '--option1', 'value1', 
        'arg1_value'
      ]);
      
      expect(result.success).toBe(true);
      expect(result.command).toBe('test'); // Resolved from alias
    });

    it('should parse short options for command', () => {
      const result = parser.parseArguments([
        'node', 'script.js', 'test', 
        '-o', 'value1', 
        '-f', 
        '-n', '42',
        'arg1_value'
      ]);
      
      expect(result.success).toBe(true);
      expect(result.options.option1).toBe('value1');
      expect(result.options.flag).toBe(true);
      expect(result.options.number).toBe(42);
    });

    it('should handle unknown command', () => {
      const result = parser.parseArguments(['node', 'script.js', 'unknown']);
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Unknown command: unknown. Use \'help\' to see available commands.');
    });

    it('should handle unknown option', () => {
      const result = parser.parseArguments(['node', 'script.js', 'test', '--unknown', 'value']);
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Unknown option: --unknown');
    });
  });

  describe('Type Conversion', () => {
    beforeEach(() => {
      const typeTestCommand: CommandDefinition = {
        name: 'typetest',
        aliases: [],
        description: 'Type test command',
        usage: 'typetest [options]',
        examples: [],
        options: [
          {
            name: 'string-opt',
            description: 'String option',
            type: 'string'
          },
          {
            name: 'number-opt',
            description: 'Number option',
            type: 'number'
          },
          {
            name: 'boolean-opt',
            description: 'Boolean option',
            type: 'boolean'
          },
          {
            name: 'array-opt',
            description: 'Array option',
            type: 'array'
          }
        ],
        arguments: []
      };
      parser.registerCommand(typeTestCommand);
    });

    it('should convert string values correctly', () => {
      const result = parser.parseArguments(['node', 'script.js', 'typetest', '--string-opt', 'hello']);
      
      expect(result.success).toBe(true);
      expect(result.options['string-opt']).toBe('hello');
      expect(typeof result.options['string-opt']).toBe('string');
    });

    it('should convert number values correctly', () => {
      const result = parser.parseArguments(['node', 'script.js', 'typetest', '--number-opt', '42']);
      
      expect(result.success).toBe(true);
      expect(result.options['number-opt']).toBe(42);
      expect(typeof result.options['number-opt']).toBe('number');
    });

    it('should handle invalid number values', () => {
      const result = parser.parseArguments(['node', 'script.js', 'typetest', '--number-opt', 'not-a-number']);
      
      expect(result.success).toBe(false);
      expect(result.errors.some(err => err.includes('must be a number'))).toBe(true);
    });

    it('should convert boolean values correctly', () => {
      const result1 = parser.parseArguments(['node', 'script.js', 'typetest', '--boolean-opt']);
      expect(result1.success).toBe(true);
      expect(result1.options['boolean-opt']).toBe(true);

      const result2 = parser.parseArguments(['node', 'script.js', 'typetest', '--no-boolean-opt']);
      expect(result2.success).toBe(true);
      expect(result2.options['boolean-opt']).toBe(false);
    });

    it('should convert array values correctly', () => {
      const result = parser.parseArguments(['node', 'script.js', 'typetest', '--array-opt', 'a,b,c']);
      
      expect(result.success).toBe(true);
      expect(result.options['array-opt']).toEqual(['a', 'b', 'c']);
    });
  });

  describe('Validation', () => {
    beforeEach(() => {
      const validationCommand: CommandDefinition = {
        name: 'validate',
        aliases: [],
        description: 'Validation test command',
        usage: 'validate [options] <required-arg>',
        examples: [],
        options: [
          {
            name: 'required-opt',
            description: 'Required option',
            type: 'string',
            required: true
          },
          {
            name: 'choice-opt',
            description: 'Choice option',
            type: 'string',
            choices: ['a', 'b', 'c']
          }
        ],
        arguments: [
          {
            name: 'required-arg',
            description: 'Required argument',
            type: 'string',
            required: true
          }
        ]
      };
      parser.registerCommand(validationCommand);
    });

    it('should validate required options', () => {
      const result = parser.parseArguments(['node', 'script.js', 'validate', 'arg-value']);
      
      expect(result.success).toBe(true); // Parsing succeeds
      
      // But validation should fail
      const validation = parser.validateArguments('validate', {
        options: result.options,
        arguments: result.arguments
      });
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(err => err.includes('required-opt'))).toBe(true);
    });

    it('should validate choice constraints', () => {
      const result = parser.parseArguments([
        'node', 'script.js', 'validate', 
        '--required-opt', 'value',
        '--choice-opt', 'invalid',
        'arg-value'
      ]);
      
      expect(result.success).toBe(true); // Parsing succeeds
      
      // But validation should fail due to invalid choice
      const validation = parser.validateArguments('validate', {
        options: result.options,
        arguments: result.arguments
      });
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(err => err.includes('must be one of'))).toBe(true);
    });

    it('should validate required arguments', () => {
      const result = parser.parseArguments([
        'node', 'script.js', 'validate', 
        '--required-opt', 'value'
        // Missing required argument
      ]);
      
      expect(result.success).toBe(true); // Parsing succeeds
      
      // But validation should fail
      const validation = parser.validateArguments('validate', {
        options: result.options,
        arguments: result.arguments
      });
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(err => err.includes('required-arg'))).toBe(true);
    });

    it('should pass validation with valid inputs', () => {
      const result = parser.parseArguments([
        'node', 'script.js', 'validate', 
        '--required-opt', 'value',
        '--choice-opt', 'a',
        'arg-value'
      ]);
      
      expect(result.success).toBe(true);
      
      const validation = parser.validateArguments('validate', {
        options: result.options,
        arguments: result.arguments
      });
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('Help Generation', () => {
    beforeEach(() => {
      const helpCommand: CommandDefinition = {
        name: 'help-test',
        aliases: ['ht'],
        description: 'Help test command',
        usage: 'help-test [options] <arg>',
        examples: [
          { command: 'help-test --option value arg', description: 'Example usage' }
        ],
        options: [
          {
            name: 'option',
            short: 'o',
            description: 'Test option',
            type: 'string',
            default: 'default-value'
          }
        ],
        arguments: [
          {
            name: 'arg',
            description: 'Test argument',
            type: 'string',
            required: true
          }
        ]
      };
      parser.registerCommand(helpCommand);
    });

    it('should generate command-specific help', () => {
      const help = parser.generateHelp('help-test');
      
      expect(help).toContain('HELP-TEST');
      expect(help).toContain('Help test command');
      expect(help).toContain('USAGE');
      expect(help).toContain('ARGUMENTS');
      expect(help).toContain('OPTIONS');
      expect(help).toContain('EXAMPLES');
      expect(help).toContain('ALIASES');
    });

    it('should generate general help', () => {
      const help = parser.generateHelp();
      
      expect(help).toContain('CHROME DEVTOOLS CLI - ENHANCED HELP SYSTEM');
      expect(help).toContain('GLOBAL OPTIONS');
      expect(help).toContain('AVAILABLE COMMANDS');
      expect(help).toContain('help-test');
    });

    it('should handle unknown command in help', () => {
      const help = parser.generateHelp('unknown');
      
      expect(help).toContain('ERROR: Unknown command');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty arguments', () => {
      const result = parser.parseArguments(['node', 'script.js']);
      
      expect(result.success).toBe(true);
      expect(result.command).toBe('help');
    });

    it('should handle version flag', () => {
      // Mock console.log and process.exit for testing
      const originalLog = console.log;
      const originalExit = process.exit;
      
      console.log = jest.fn();
      process.exit = jest.fn() as any;
      
      try {
        parser.parseArguments(['node', 'script.js', '--version']);
        // Should not reach here due to process.exit
      } catch (error) {
        // Expected due to process.exit mock
      }
      
      // Restore original functions
      console.log = originalLog;
      process.exit = originalExit;
    });

    it('should handle parse errors gracefully', () => {
      const result = parser.parseArguments(['node', 'script.js', '--invalid-global-option']);
      
      expect(result.success).toBe(false); // Should fail for invalid option
      expect(result.command).toBe('invalid-global-option'); // Treated as unknown command
    });
  });
});
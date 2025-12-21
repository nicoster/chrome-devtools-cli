import { Logger, LogLevel } from './logger';

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger();
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'info').mockImplementation();
    jest.spyOn(console, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Log levels', () => {
    it('should log error messages at ERROR level', () => {
      logger.setLevel(LogLevel.ERROR);
      logger.error('test error');
      logger.warn('test warn');
      logger.info('test info');

      expect(console.error).toHaveBeenCalledWith('[ERROR] test error');
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
    });

    it('should log warn and error messages at WARN level', () => {
      logger.setLevel(LogLevel.WARN);
      logger.error('test error');
      logger.warn('test warn');
      logger.info('test info');

      expect(console.error).toHaveBeenCalledWith('[ERROR] test error');
      expect(console.warn).toHaveBeenCalledWith('[WARN] test warn');
      expect(console.info).not.toHaveBeenCalled();
    });

    it('should respect quiet mode', () => {
      logger.setQuiet(true);
      logger.error('test error');
      logger.warn('test warn');
      logger.info('test info');

      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
    });
  });

  describe('Message formatting', () => {
    it('should format messages with additional arguments', () => {
      logger.error('test error', { data: 'value' });
      expect(console.error).toHaveBeenCalledWith('[ERROR] test error', { data: 'value' });
    });
  });
});
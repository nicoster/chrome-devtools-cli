import { Logger, LogLevel } from "./logger";

describe("Logger", () => {
  let logger: Logger;
  let stderrWrite: jest.SpyInstance;

  beforeEach(() => {
    logger = new Logger();
    jest.clearAllMocks();
    stderrWrite = jest
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const written = () =>
    stderrWrite.mock.calls.map((c) => String(c[0])).join("");

  describe("Log levels", () => {
    it("should log error messages at ERROR level", () => {
      logger.setLevel(LogLevel.ERROR);
      logger.error("test error");
      logger.warn("test warn");
      logger.info("test info");

      const out = written();
      expect(out).toContain("ERROR");
      expect(out).toContain("test error");
      expect(out).not.toContain("WARN");
      expect(out).not.toContain("test info");
    });

    it("should log warn and error messages at WARN level", () => {
      logger.setLevel(LogLevel.WARN);
      logger.error("test error");
      logger.warn("test warn");
      logger.info("test info");

      const out = written();
      expect(out).toContain("ERROR");
      expect(out).toContain("test error");
      expect(out).toContain("WARN");
      expect(out).toContain("test warn");
      expect(out).not.toContain("test info");
    });

    it("should respect quiet mode", () => {
      logger.setQuiet(true);
      logger.error("test error");
      logger.warn("test warn");
      logger.info("test info");

      expect(stderrWrite).not.toHaveBeenCalled();
    });
  });

  describe("Message formatting", () => {
    it("should format messages with additional arguments", () => {
      logger.error("test error", { data: "value" });
      const out = written();
      expect(out).toContain("ERROR");
      expect(out).toContain("test error");
      expect(out).toContain("Data:");
      expect(out).toContain('"data":"value"');
    });
  });
});

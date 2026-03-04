import { ListConsoleMessagesHandler } from "./ListConsoleMessagesHandler";
import { CDPClient } from "../types";

class MockCDPClient implements CDPClient {
  private eventListeners = new Map<string, Array<(params: unknown) => void>>();

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}

  async send(method: string): Promise<unknown> {
    if (method === "Runtime.enable" || method === "Log.enable") {
      return {};
    }
    return {};
  }

  on(event: string, callback: (params: unknown) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: (params: unknown) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event: string, params: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((cb) => cb(params));
    }
  }
}

describe("ListConsoleMessagesHandler", () => {
  let handler: ListConsoleMessagesHandler;
  let mockClient: MockCDPClient;

  beforeEach(() => {
    handler = new ListConsoleMessagesHandler();
    mockClient = new MockCDPClient();
    jest.spyOn(process, "on").mockImplementation(() => process);
    jest.spyOn(process, "removeAllListeners").mockImplementation(() => process);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Identity
  // ---------------------------------------------------------------------------

  it('should have name "log"', () => {
    expect(handler.name).toBe("log");
  });

  it('should have "console" as alias', () => {
    expect((handler as any).aliases).toContain("console");
  });

  // ---------------------------------------------------------------------------
  // execute()
  // ---------------------------------------------------------------------------

  it("execute() returns isLongRunning result", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const result = await handler.execute(mockClient as any, {});
    expect(result.success).toBe(true);
    expect((result as any).isLongRunning).toBe(true);
    consoleSpy.mockRestore();
  });

  it("execute() with format=json does not print follow header", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    await handler.execute(mockClient as any, { format: "json" });
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Following"),
    );
    consoleSpy.mockRestore();
  });

  // ---------------------------------------------------------------------------
  // buildMatcher() — tested via the private method directly
  // ---------------------------------------------------------------------------

  const match = (
    handler: ListConsoleMessagesHandler,
    params: object,
    text: string,
  ) => (handler as any).buildMatcher(params)(text);

  it("no pattern → always matches", () => {
    expect(match(handler, {}, "anything")).toBe(true);
  });

  it("positional pattern (regex, case-insensitive by default)", () => {
    expect(match(handler, { pattern: "api" }, "Called API endpoint")).toBe(
      true,
    );
    expect(match(handler, { pattern: "api" }, "Called API endpoint")).toBe(
      true,
    );
    expect(match(handler, { pattern: "api" }, "no match here")).toBe(false);
  });

  it("-e / expression: single pattern", () => {
    expect(match(handler, { expression: "error" }, "An error occurred")).toBe(
      true,
    );
    expect(match(handler, { expression: "error" }, "all good")).toBe(false);
  });

  it("-e / expression: multiple patterns use OR logic", () => {
    const params = { expression: ["foo", "bar"] };
    expect(match(handler, params, "foo is here")).toBe(true);
    expect(match(handler, params, "bar is here")).toBe(true);
    expect(match(handler, params, "neither")).toBe(false);
  });

  it("positional + -e are combined as OR", () => {
    const params = { pattern: "foo", expression: "bar" };
    expect(match(handler, params, "foo")).toBe(true);
    expect(match(handler, params, "bar")).toBe(true);
    expect(match(handler, params, "baz")).toBe(false);
  });

  it("-F / fixedStrings: treats regex metacharacters as literals", () => {
    // '[AI' would be an invalid regex but a valid literal
    expect(
      match(handler, { pattern: "[AI", fixedStrings: true }, "[AI] Hello"),
    ).toBe(true);
    expect(
      match(handler, { pattern: "[AI", fixedStrings: true }, "AI Hello"),
    ).toBe(false);
  });

  it('-F / "fixed-strings" key also works', () => {
    expect(
      match(handler, { pattern: "[AI", "fixed-strings": true }, "[AI] Hello"),
    ).toBe(true);
  });

  it("-v / invertMatch: inverts the match", () => {
    expect(
      match(handler, { pattern: "debug", invertMatch: true }, "debug info"),
    ).toBe(false);
    expect(
      match(handler, { pattern: "debug", invertMatch: true }, "info message"),
    ).toBe(true);
  });

  it('-v / "invert-match" key also works', () => {
    expect(
      match(
        handler,
        { pattern: "debug", "invert-match": true },
        "info message",
      ),
    ).toBe(true);
  });

  it("case-insensitive by default", () => {
    expect(match(handler, { pattern: "API" }, "called api endpoint")).toBe(
      true,
    );
    expect(match(handler, { pattern: "api" }, "Called API endpoint")).toBe(
      true,
    );
  });

  it("--case-sensitive disables case folding", () => {
    expect(
      match(handler, { pattern: "API", caseSensitive: true }, "API call"),
    ).toBe(true);
    expect(
      match(handler, { pattern: "API", caseSensitive: true }, "api call"),
    ).toBe(false);
  });

  it("--case-sensitive + -F", () => {
    expect(
      match(
        handler,
        { pattern: "FOO", fixedStrings: true, caseSensitive: true },
        "FOO",
      ),
    ).toBe(true);
    expect(
      match(
        handler,
        { pattern: "FOO", fixedStrings: true, caseSensitive: true },
        "foo",
      ),
    ).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // validateArgs()
  // ---------------------------------------------------------------------------

  it("validateArgs accepts empty args", () => {
    expect(handler.validateArgs({})).toBe(true);
  });

  it("validateArgs accepts valid types", () => {
    expect(handler.validateArgs({ types: ["error", "warn"] })).toBe(true);
  });

  it("validateArgs rejects invalid types", () => {
    expect(handler.validateArgs({ types: ["invalid"] })).toBe(false);
  });

  it("validateArgs accepts valid format", () => {
    expect(handler.validateArgs({ format: "json" })).toBe(true);
  });

  it("validateArgs rejects invalid format", () => {
    expect(handler.validateArgs({ format: "xml" })).toBe(false);
  });

  it("validateArgs accepts pattern string", () => {
    expect(handler.validateArgs({ pattern: "API" })).toBe(true);
  });

  it("validateArgs accepts expression string", () => {
    expect(handler.validateArgs({ expression: "API" })).toBe(true);
  });

  it("validateArgs accepts expression array", () => {
    expect(handler.validateArgs({ expression: ["foo", "bar"] })).toBe(true);
  });

  it("validateArgs rejects non-string pattern", () => {
    expect(handler.validateArgs({ pattern: 123 })).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // getHelp()
  // ---------------------------------------------------------------------------

  it("getHelp contains new grep-like flags", () => {
    const help = handler.getHelp();
    expect(help).toContain("cdp log");
    expect(help).toContain("-e");
    expect(help).toContain("-F");
    expect(help).toContain("-v");
    expect(help).toContain("--case-sensitive");
    expect(help).toContain("--types");
    expect(help).toContain("--format");
  });

  it("getHelp does not contain old --textPattern", () => {
    const help = handler.getHelp();
    expect(help).not.toContain("--textPattern");
  });

  it("getHelp does not reference proxy or historical queries", () => {
    const help = handler.getHelp();
    expect(help).not.toContain("proxy");
    expect(help).not.toContain("--latest");
    expect(help).not.toContain("--maxMessages");
  });
});

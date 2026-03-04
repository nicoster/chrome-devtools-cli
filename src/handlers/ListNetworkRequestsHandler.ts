import { CDPClient, CommandResult, NetworkRequest } from "../types";
import { NetworkMonitor } from "../monitors/NetworkMonitor";

/**
 * Handler for real-time network request monitoring (follow-only mode)
 */
export class ListNetworkRequestsHandler {
  name = "network";
  private networkMonitor: NetworkMonitor | null = null;

  async execute(client: CDPClient, args: unknown): Promise<CommandResult> {
    try {
      const params = args as {
        methods?: string | string[];
        urlPattern?: string;
        statusCodes?: string | number[];
        follow?: boolean;
        f?: boolean;
        format?: "text" | "json" | "pretty";
      };

      return await this.executeFollowMode(client, params);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  private async executeFollowMode(
    client: CDPClient,
    params: any,
  ): Promise<CommandResult> {
    if (!this.networkMonitor) {
      this.networkMonitor = new NetworkMonitor(client);
    }

    await this.networkMonitor.startMonitoring();

    // Normalize comma-separated string params to arrays
    const methods: string[] = this.parseList(params.methods);
    const statusCodes: number[] = this.parseList(params.statusCodes)
      .map(Number)
      .filter((n) => !isNaN(n));
    const urlPattern: string | undefined = params.urlPattern;
    const outputFormat: "text" | "json" | "pretty" = params.format || "text";

    const requestCallback = (request: NetworkRequest) => {
      if (
        !this.shouldOutputRequest(request, methods, urlPattern, statusCodes)
      ) {
        return;
      }
      this.outputRequest(request, outputFormat);
    };

    this.networkMonitor.onRequest(requestCallback);

    let isShuttingDown = false;
    const cleanup = async () => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      this.networkMonitor?.offRequest(requestCallback);
      await this.networkMonitor?.stopMonitoring();
    };

    const signalHandler = async () => {
      process.stderr.write("\n");
      await cleanup();
      process.exit(0);
    };

    process.removeAllListeners("SIGINT");
    process.removeAllListeners("SIGTERM");
    process.on("SIGINT", signalHandler);
    process.on("SIGTERM", signalHandler);

    if (outputFormat === "text") {
      console.log("Following network requests (press Ctrl+C to stop)...\n");
    }

    return {
      success: true,
      data: {
        message:
          "Following network requests in real-time. Press Ctrl+C to stop.",
        isLongRunning: true,
      },
      isLongRunning: true,
    } as CommandResult & { isLongRunning?: boolean };
  }

  private parseList(value: string | string[] | undefined): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private shouldOutputRequest(
    request: NetworkRequest,
    methods: string[],
    urlPattern: string | undefined,
    statusCodes: number[],
  ): boolean {
    if (
      methods.length > 0 &&
      !methods
        .map((m) => m.toUpperCase())
        .includes(request.method.toUpperCase())
    ) {
      return false;
    }
    if (urlPattern) {
      const pattern = new RegExp(urlPattern, "i");
      if (!pattern.test(request.url)) return false;
    }
    if (
      statusCodes.length > 0 &&
      request.status !== undefined &&
      !statusCodes.includes(request.status)
    ) {
      return false;
    }
    return true;
  }

  private outputRequest(
    request: NetworkRequest,
    format: "text" | "json" | "pretty",
  ): void {
    const status = request.status ?? "???";
    const method = request.method.toUpperCase().padEnd(7);
    const time = new Date(request.timestamp).toISOString();

    switch (format) {
      case "json":
        console.log(
          JSON.stringify({
            method: request.method,
            url: request.url,
            status: request.status,
            timestamp: request.timestamp,
          }),
        );
        break;

      case "pretty": {
        const statusColor = this.getStatusColor(request.status);
        console.log(
          `[${time}] ${method} ${statusColor}${status}\x1b[0m ${request.url}`,
        );
        break;
      }

      case "text":
      default:
        console.log(`[${time}] ${method} ${status} ${request.url}`);
        break;
    }
  }

  private getStatusColor(status: number | undefined): string {
    if (status === undefined || status === 0) return "\x1b[31m"; // red — error/failed
    if (status >= 500) return "\x1b[31m"; // red
    if (status >= 400) return "\x1b[33m"; // yellow
    if (status >= 300) return "\x1b[36m"; // cyan
    return "\x1b[32m"; // green
  }

  getHelp(): string {
    return `network - Follow network requests in real-time

Usage:
  cdp network [options]

Options:
  --methods <methods>         Filter by HTTP methods (comma-separated: GET,POST,PUT,DELETE,...)
  --urlPattern <pattern>      Filter by URL pattern (regex, case-insensitive)
  --statusCodes <codes>       Filter by HTTP status codes (comma-separated: 200,404,500)
  --format <format>           Output format: text, json, or pretty (default: text)
  -f, --follow                Alias flag (follow mode is always active)

Examples:
  cdp network                                    # Follow all network requests
  cdp network --methods POST,PUT                 # Follow only POST and PUT requests
  cdp network --urlPattern "/api/"               # Follow requests matching /\\/api\\//i
  cdp network --statusCodes 404,500              # Follow requests with error status
  cdp network --format json                      # Output as JSON (one object per line)
  cdp network --format pretty                    # Colorized output
  cdp network --methods GET --urlPattern "/api"  # Combined filters

Note:
  This command runs continuously and streams network requests in real-time.
  Each entry is printed when the request fully completes (or fails).
  Press Ctrl+C to stop. No background process is required.`;
  }
}

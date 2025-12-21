import { ICommandHandler } from '../interfaces/CommandHandler';
import { CDPClient, CommandResult } from '../types';
import { promises as fs } from 'fs';
import { dirname } from 'path';

/**
 * Arguments for screenshot command
 */
export interface TakeScreenshotArgs {
  filename?: string;        // Output filename (optional)
  width?: number;          // Screenshot width
  height?: number;         // Screenshot height
  format?: 'png' | 'jpeg'; // Image format (default: png)
  quality?: number;        // JPEG quality (1-100, only for jpeg format)
  fullPage?: boolean;      // Capture full page (default: false)
  clip?: {                 // Clip rectangle
    x: number;
    y: number;
    width: number;
    height: number;
    scale?: number;
  };
}

/**
 * CDP Page.captureScreenshot response
 */
interface CaptureScreenshotResponse {
  data: string;  // Base64 encoded image data
}

/**
 * Handler for screenshot command
 * Captures a screenshot of the current page via CDP Page.captureScreenshot
 */
export class TakeScreenshotHandler implements ICommandHandler {
  readonly name = 'screenshot';

  /**
   * Execute screenshot capture
   */
  async execute(client: CDPClient, args: unknown): Promise<CommandResult> {
    const screenshotArgs = args as TakeScreenshotArgs;

    try {
      // Enable Page domain if not already enabled
      await client.send('Page.enable');

      // Prepare screenshot parameters
      const params = this.buildScreenshotParams(screenshotArgs);

      // Capture screenshot
      const response = await client.send('Page.captureScreenshot', params) as CaptureScreenshotResponse;

      if (!response || !response.data) {
        return {
          success: false,
          error: 'Failed to capture screenshot: empty response'
        };
      }

      // Save screenshot to file if filename provided
      if (screenshotArgs.filename) {
        await this.saveScreenshot(response.data, screenshotArgs.filename);
        return {
          success: true,
          data: {
            message: `Screenshot saved to ${screenshotArgs.filename}`,
            filename: screenshotArgs.filename,
            format: screenshotArgs.format || 'png'
          }
        };
      }

      // Return base64 data if no filename provided
      return {
        success: true,
        data: {
          base64: response.data,
          format: screenshotArgs.format || 'png'
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Build CDP parameters for Page.captureScreenshot
   */
  private buildScreenshotParams(args: TakeScreenshotArgs): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    // Set format (default: png)
    params.format = args.format || 'png';

    // Set quality for JPEG format
    if (args.format === 'jpeg' && args.quality !== undefined) {
      if (args.quality < 0 || args.quality > 100) {
        throw new Error('JPEG quality must be between 0 and 100');
      }
      params.quality = args.quality;
    }

    // Set clip rectangle if provided
    if (args.clip) {
      params.clip = {
        x: args.clip.x,
        y: args.clip.y,
        width: args.clip.width,
        height: args.clip.height,
        scale: args.clip.scale || 1
      };
    }

    // Handle viewport sizing
    if (args.width || args.height) {
      // Note: For viewport sizing, we would need to use Emulation.setDeviceMetricsOverride
      // This is handled separately in the viewport management
    }

    // Capture beyond viewport if fullPage is true
    if (args.fullPage) {
      params.captureBeyondViewport = true;
    }

    return params;
  }

  /**
   * Save screenshot data to file
   */
  private async saveScreenshot(base64Data: string, filename: string): Promise<void> {
    try {
      // Ensure directory exists
      const dir = dirname(filename);
      await fs.mkdir(dir, { recursive: true });

      // Convert base64 to buffer and save
      const buffer = Buffer.from(base64Data, 'base64');
      await fs.writeFile(filename, buffer);
    } catch (error) {
      throw new Error(
        `Failed to save screenshot to "${filename}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Validate command arguments
   */
  validateArgs(args: unknown): boolean {
    if (typeof args !== 'object' || args === null) {
      return false;
    }

    const screenshotArgs = args as TakeScreenshotArgs;

    // Validate filename if provided
    if (screenshotArgs.filename !== undefined && typeof screenshotArgs.filename !== 'string') {
      return false;
    }

    // Validate dimensions
    if (screenshotArgs.width !== undefined && (typeof screenshotArgs.width !== 'number' || screenshotArgs.width <= 0)) {
      return false;
    }

    if (screenshotArgs.height !== undefined && (typeof screenshotArgs.height !== 'number' || screenshotArgs.height <= 0)) {
      return false;
    }

    // Validate format
    if (screenshotArgs.format !== undefined && !['png', 'jpeg'].includes(screenshotArgs.format)) {
      return false;
    }

    // Validate quality
    if (screenshotArgs.quality !== undefined) {
      if (typeof screenshotArgs.quality !== 'number' || screenshotArgs.quality < 0 || screenshotArgs.quality > 100) {
        return false;
      }
    }

    // Validate fullPage
    if (screenshotArgs.fullPage !== undefined && typeof screenshotArgs.fullPage !== 'boolean') {
      return false;
    }

    // Validate clip rectangle
    if (screenshotArgs.clip !== undefined) {
      const clip = screenshotArgs.clip;
      if (typeof clip !== 'object' || clip === null) {
        return false;
      }

      if (typeof clip.x !== 'number' || typeof clip.y !== 'number' ||
          typeof clip.width !== 'number' || typeof clip.height !== 'number') {
        return false;
      }

      if (clip.width <= 0 || clip.height <= 0) {
        return false;
      }

      if (clip.scale !== undefined && (typeof clip.scale !== 'number' || clip.scale <= 0)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get command help text
   */
  getHelp(): string {
    return `
screenshot - Capture a screenshot of the current page

Usage:
  screenshot
  screenshot --filename screenshot.png
  screenshot --width 1920 --height 1080 --filename full-hd.png
  screenshot --format jpeg --quality 80 --filename compressed.jpg
  screenshot --full-page --filename full-page.png

Arguments:
  --filename <path>       Output filename (if not provided, returns base64 data)
  --width <pixels>        Screenshot width (requires viewport adjustment)
  --height <pixels>       Screenshot height (requires viewport adjustment)
  --format <png|jpeg>     Image format (default: png)
  --quality <1-100>       JPEG quality (only for jpeg format)
  --full-page             Capture full page beyond viewport (default: false)
  --clip-x <pixels>       Clip rectangle X coordinate
  --clip-y <pixels>       Clip rectangle Y coordinate
  --clip-width <pixels>   Clip rectangle width
  --clip-height <pixels>  Clip rectangle height
  --clip-scale <number>   Clip rectangle scale factor

Examples:
  # Basic screenshot
  screenshot --filename page.png

  # High quality JPEG
  screenshot --format jpeg --quality 95 --filename page.jpg

  # Full page screenshot
  screenshot --full-page --filename full-page.png

  # Clipped screenshot
  screenshot --clip-x 100 --clip-y 100 --clip-width 800 --clip-height 600 --filename clipped.png

  # Return base64 data (no file)
  screenshot --format png
`;
  }
}
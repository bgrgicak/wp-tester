/**
 * Spinner utility for animated loading indicators
 */

export const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export interface SpinnerOptions {
  text: string;
  interval?: number;
}

export class Spinner {
  private frameIndex = 0;
  private intervalId?: NodeJS.Timeout;
  private text: string;
  private interval: number;

  constructor(options: SpinnerOptions) {
    this.text = options.text;
    this.interval = options.interval ?? 80;
  }

  start(): void {
    this.frameIndex = 0;
    this.render();
    this.intervalId = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % SPINNER_FRAMES.length;
      this.render();
    }, this.interval);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    // Clear the line
    process.stdout.write('\r\x1b[K');
  }

  private render(): void {
    const frame = SPINNER_FRAMES[this.frameIndex];
    process.stdout.write(`\r ${frame} ${this.text}`);
  }

  setText(text: string): void {
    this.text = text;
    this.render();
  }
}

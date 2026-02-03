/**
 * Unified Streaming Reporter
 *
 * A streaming reporter that manages multiple test suites (Vitest and PHPUnit)
 * and presents them as a single unified test run. This eliminates the visual
 * pause between different test suite outputs.
 */

import {
  StreamingReporter,
  type StreamingReporterOptions,
  type StreamEvent,
} from "./streaming.js";
import { SPINNER_FRAMES } from "./spinner.js";
import pc from "picocolors";

// ANSI escape codes for cursor control
const HIDE_CURSOR = "\x1b[?25l";
const SHOW_CURSOR = "\x1b[?25h";
const SAVE_CURSOR = "\x1b7";
const RESTORE_CURSOR = "\x1b8";
const CLEAR_TO_END = "\x1b[J";

/**
 * Unified streaming reporter that combines multiple test suite outputs
 *
 * Tracks multiple sequential test runs and only renders final output when
 * all runs are complete. Shows a persistent "Running tests..." spinner that
 * remains active across all test suites until explicitly ended.
 *
 * Usage:
 *   const reporter = new UnifiedStreamingReporter(options);
 *   reporter.startUnifiedRun();  // Start spinner
 *   await runSmokeTests(..., reporter);
 *   await runPhpunitTests(..., reporter);
 *   reporter.endUnifiedRun();    // Stop spinner, show final output
 */
export class UnifiedStreamingReporter extends StreamingReporter {
  private isUnifiedRunActive = false;
  private status = "Running tests";
  private lastLineCount = 0;

  constructor(options: StreamingReporterOptions = {}) {
    super(options);
  }

  /**
   * Update the status message shown in the spinner line.
   * Call this to indicate the current phase of testing.
   */
  setStatus(message: string): void {
    this.status = message;
  }

  /**
   * Start the unified test run.
   * Call this before running any test suites to show the "Running tests..." spinner.
   * The spinner will remain visible until endUnifiedRun() is called.
   */
  startUnifiedRun(): void {
    if (this.isUnifiedRunActive) return;

    this.isUnifiedRunActive = true;
    this.status = "Running tests...";
    this.lastLineCount = 0;

    // Initialize the parent reporter
    super.onRunStart("wp-tester");

    // Start spinner animation
    this.startSpinner();

    if (this.useLogUpdate) {
      // TTY mode: save cursor position, hide cursor, and start rendering
      // Saving cursor allows us to restore and clear even if external output
      // (like deprecation warnings) shifts content down
      process.stdout.write(SAVE_CURSOR + HIDE_CURSOR);
      this.renderImmediate();
    } else {
      // Non-TTY mode: print status once
      this.writer.writeLine("");
      const spinner = pc.cyan(SPINNER_FRAMES[0]);
      this.writer.writeLine(`${spinner} ${this.status}`);
      this.writer.writeLine("");
    }
  }

  /**
   * End the unified test run.
   * Call this after all test suites have completed to stop the spinner
   * and render the final output.
   */
  endUnifiedRun(): void {
    if (!this.isUnifiedRunActive) return;

    this.isUnifiedRunActive = false;
    this.stopSpinner();

    if (this.useLogUpdate) {
      // Clear the spinner area and restore cursor
      // Use try/finally to ensure cursor is always restored even on errors
      try {
        this.clearOutput();
      } finally {
        process.stdout.write(SHOW_CURSOR);
      }
    }

    // Prevent clearThrottle() in super.onRunEnd() from calling renderImmediate()
    // again, which would cause duplicate output (renderImmediate + renderFinal)
    this.pendingRender = false;

    super.onRunEnd();
  }

  /**
   * Clear the current output by restoring cursor and clearing to end.
   * This handles external output (like deprecation warnings) that may have
   * shifted content down, by always clearing from the saved start position.
   */
  private clearOutput(): void {
    // Restore cursor to saved position and clear everything below
    // This is more robust than relative line clearing because it handles
    // any external output that may have been written to stdout
    process.stdout.write(RESTORE_CURSOR + CLEAR_TO_END);
    this.lastLineCount = 0;
  }

  /**
   * Override to prevent individual test suites from triggering run start.
   * The unified run is controlled by startUnifiedRun()/endUnifiedRun().
   */
  onRunStart(_toolName?: string): void {
    // No-op: unified run lifecycle is managed by startUnifiedRun/endUnifiedRun
  }

  /**
   * Override to prevent individual test suites from triggering run end.
   * The unified run is controlled by startUnifiedRun()/endUnifiedRun().
   */
  onRunEnd(): void {
    // No-op: unified run lifecycle is managed by startUnifiedRun/endUnifiedRun
  }

  /**
   * Process stream events with unified handling
   */
  onEvent(event: StreamEvent): void {
    // Let onRunStart/onRunEnd handle run events
    if (event.type === "run:start") {
      this.onRunStart(event.toolName);
      return;
    }

    if (event.type === "run:end") {
      this.onRunEnd();
      return;
    }

    // Forward all other events to parent
    super.onEvent(event);
  }

  /**
   * Override renderImmediate to use manual ANSI cursor control.
   * This avoids log-update issues with cursor tracking.
   */
  protected renderImmediate(): void {
    this.pendingRender = false;

    // In non-TTY mode, skip intermediate renders (final output via renderFinal)
    if (!this.useLogUpdate) {
      return;
    }

    // Build output lines for TTY mode
    const lines: string[] = [];

    // Add spinner header while unified run is active
    if (this.isUnifiedRunActive) {
      const spinner = pc.cyan(SPINNER_FRAMES[this.spinnerFrame]);
      lines.push(`${spinner} ${this.status}`);
      lines.push(""); // Empty line for spacing
    }

    // Render each file's tests
    for (const file of this.state.files.values()) {
      this.renderFile(file, lines);
    }

    // Clear previous output
    this.clearOutput();

    // Write new output
    const output = lines.join("\n");
    process.stdout.write(output + "\n");

    // Track how many lines we wrote (for next clear)
    this.lastLineCount = lines.length;
  }

  /**
   * Generate filter command based on test metadata
   *
   * Detects PHPUnit tests by checking for namespace separators (backslashes)
   * in the suite stack, since PHPUnit uses namespaced class names.
   */
  protected getFilterCommand(
    testName: string,
    suiteName?: string,
    suiteStack?: string[],
  ): string | null {
    const isPHPUnit = suiteStack?.some((s) => s.includes("\\"));

    if (isPHPUnit) {
      // PHPUnit: --filter 'ClassName::testName'
      // Find the last suite that contains a namespace separator (the class name)
      let className: string | undefined;
      if (suiteStack) {
        for (let i = suiteStack.length - 1; i >= 0; i--) {
          if (suiteStack[i].includes("\\")) {
            className = suiteStack[i];
            break;
          }
        }
        className = className ?? suiteStack[0];
      }
      className = className ?? suiteName;

      const filterArg = className
        ? `${className}::${testName}`.replace(/\\/g, "\\\\")
        : testName;
      return `-- --filter '${filterArg}'`;
    }

    // Vitest: -t 'suiteName.*testName'
    const escapedName = testName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const filterArg = suiteName ? `${suiteName}.*${escapedName}` : escapedName;
    return `-- -t '${filterArg}'`;
  }
}

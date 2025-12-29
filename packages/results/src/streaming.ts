/**
 * Streaming Test Reporter
 *
 * Provides real-time test result output in a uniform format.
 * Works with both Vitest and PHPUnit test runners.
 */

import type { Test, TestStatus, Report } from "ctrf";

/**
 * Test event emitted during test execution
 */
export interface TestEvent {
  type: "test:start" | "test:pass" | "test:fail" | "test:skip" | "test:pending";
  name: string;
  suiteName?: string;
  duration?: number;
  message?: string;
  trace?: string;
}

/**
 * Suite event emitted during test execution
 */
export interface SuiteEvent {
  type: "suite:start" | "suite:end";
  name: string;
}

/**
 * Run event emitted at start/end of test run
 */
export interface RunEvent {
  type: "run:start" | "run:end";
  toolName?: string;
  report?: Report;
}

export type StreamEvent = TestEvent | SuiteEvent | RunEvent;

/**
 * Output writer interface for streaming results
 */
export interface StreamWriter {
  write(text: string): void;
  writeLine(text: string): void;
}

/**
 * Default stdout writer
 */
export const stdoutWriter: StreamWriter = {
  write(text: string) {
    process.stdout.write(text);
  },
  writeLine(text: string) {
    process.stdout.write(text + "\n");
  },
};

/**
 * ANSI color codes for terminal output
 */
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Streaming test reporter for real-time test output
 */
export class StreamingReporter {
  private writer: StreamWriter;
  private currentSuite: string | null = null;
  private testCount = 0;
  private passCount = 0;
  private failCount = 0;
  private skipCount = 0;
  private startTime = 0;
  private tests: Test[] = [];
  private toolName = "wp-tester";
  private enabled = true;

  constructor(writer: StreamWriter = stdoutWriter) {
    this.writer = writer;
  }

  /**
   * Enable or disable output (for quiet mode)
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Process a stream event
   */
  onEvent(event: StreamEvent): void {
    switch (event.type) {
      case "run:start":
        this.onRunStart(event.toolName);
        break;
      case "run:end":
        this.onRunEnd();
        break;
      case "suite:start":
        this.onSuiteStart(event.name);
        break;
      case "suite:end":
        this.onSuiteEnd(event.name);
        break;
      case "test:start":
        // Optional: could show "running..." indicator
        break;
      case "test:pass":
        this.onTestPass(event.name, event.duration || 0, event.suiteName);
        break;
      case "test:fail":
        this.onTestFail(
          event.name,
          event.duration || 0,
          event.message,
          event.trace,
          event.suiteName
        );
        break;
      case "test:skip":
        this.onTestSkip(event.name, event.message, event.suiteName);
        break;
      case "test:pending":
        this.onTestPending(event.name, event.suiteName);
        break;
    }
  }

  /**
   * Called when test run starts
   */
  onRunStart(toolName?: string): void {
    this.testCount = 0;
    this.passCount = 0;
    this.failCount = 0;
    this.skipCount = 0;
    this.startTime = Date.now();
    this.tests = [];
    this.currentSuite = null;
    if (toolName) {
      this.toolName = toolName;
    }

    if (this.enabled) {
      this.writer.writeLine("");
      this.writer.writeLine(
        `${colors.cyan}${colors.bold}Running tests: ${this.toolName}${colors.reset}`
      );
      this.writer.writeLine("");
    }
  }

  /**
   * Called when test run ends
   */
  onRunEnd(): void {
    if (!this.enabled) return;

    const duration = Date.now() - this.startTime;
    this.writer.writeLine("");
    this.printSummary(duration);
  }

  /**
   * Called when a test suite starts
   */
  onSuiteStart(name: string): void {
    if (!this.enabled) return;

    this.currentSuite = name;
    this.writer.writeLine(
      `${colors.dim}▸ ${name}${colors.reset}`
    );
  }

  /**
   * Called when a test suite ends
   */
  onSuiteEnd(_name: string): void {
    this.currentSuite = null;
  }

  /**
   * Called when a test passes
   */
  onTestPass(name: string, duration: number, suiteName?: string): void {
    this.testCount++;
    this.passCount++;
    this.tests.push({
      name: this.formatTestName(name, suiteName),
      status: "passed",
      duration,
    });

    if (!this.enabled) return;

    const durationStr = `${colors.gray}(${formatDuration(duration)})${colors.reset}`;
    const displayName = this.formatDisplayName(name, suiteName);
    this.writer.writeLine(
      `  ${colors.green}✓${colors.reset} ${displayName} ${durationStr}`
    );
  }

  /**
   * Called when a test fails
   */
  onTestFail(
    name: string,
    duration: number,
    message?: string,
    trace?: string,
    suiteName?: string
  ): void {
    this.testCount++;
    this.failCount++;
    this.tests.push({
      name: this.formatTestName(name, suiteName),
      status: "failed",
      duration,
      message,
      trace,
    });

    if (!this.enabled) return;

    const durationStr = `${colors.gray}(${formatDuration(duration)})${colors.reset}`;
    const displayName = this.formatDisplayName(name, suiteName);
    this.writer.writeLine(
      `  ${colors.red}✗${colors.reset} ${displayName} ${durationStr}`
    );

    if (message) {
      const indentedMessage = message
        .split("\n")
        .map((line) => `    ${colors.red}${line}${colors.reset}`)
        .join("\n");
      this.writer.writeLine(indentedMessage);
    }
  }

  /**
   * Called when a test is skipped
   */
  onTestSkip(name: string, reason?: string, suiteName?: string): void {
    this.testCount++;
    this.skipCount++;
    this.tests.push({
      name: this.formatTestName(name, suiteName),
      status: "skipped",
      duration: 0,
      message: reason,
    });

    if (!this.enabled) return;

    const displayName = this.formatDisplayName(name, suiteName);
    const reasonStr = reason ? ` ${colors.gray}(${reason})${colors.reset}` : "";
    this.writer.writeLine(
      `  ${colors.yellow}○${colors.reset} ${colors.dim}${displayName}${colors.reset}${reasonStr}`
    );
  }

  /**
   * Called when a test is pending
   */
  onTestPending(name: string, suiteName?: string): void {
    this.testCount++;
    this.tests.push({
      name: this.formatTestName(name, suiteName),
      status: "pending",
      duration: 0,
    });

    if (!this.enabled) return;

    const displayName = this.formatDisplayName(name, suiteName);
    this.writer.writeLine(
      `  ${colors.yellow}◌${colors.reset} ${colors.dim}${displayName}${colors.reset}`
    );
  }

  /**
   * Format test name for CTRF report
   */
  private formatTestName(name: string, suiteName?: string): string {
    if (suiteName) {
      return `${suiteName}::${name}`;
    }
    return name;
  }

  /**
   * Format test name for display (without suite if already shown)
   */
  private formatDisplayName(name: string, suiteName?: string): string {
    // If we're in a suite context, just show the test name
    if (this.currentSuite && suiteName === this.currentSuite) {
      return name;
    }
    // Otherwise show full name
    return this.formatTestName(name, suiteName);
  }

  /**
   * Print final summary
   */
  private printSummary(duration: number): void {
    const total = this.testCount;
    const passed = this.passCount;
    const failed = this.failCount;
    const skipped = this.skipCount;

    this.writer.writeLine(
      `${colors.bold}Test Summary:${colors.reset}`
    );

    if (passed > 0) {
      this.writer.writeLine(
        `  ${colors.green}✓ ${passed} passed${colors.reset}`
      );
    }
    if (failed > 0) {
      this.writer.writeLine(
        `  ${colors.red}✗ ${failed} failed${colors.reset}`
      );
    }
    if (skipped > 0) {
      this.writer.writeLine(
        `  ${colors.yellow}○ ${skipped} skipped${colors.reset}`
      );
    }

    this.writer.writeLine("");
    this.writer.writeLine(
      `${colors.dim}Total: ${total} tests in ${formatDuration(duration)}${colors.reset}`
    );
    this.writer.writeLine("");
  }

  /**
   * Get the current report in CTRF format
   */
  getReport(): Report {
    return {
      reportFormat: "CTRF",
      specVersion: "1.0.0",
      results: {
        tool: {
          name: this.toolName,
        },
        summary: {
          tests: this.testCount,
          passed: this.passCount,
          failed: this.failCount,
          skipped: this.skipCount,
          pending: 0,
          other: 0,
          start: this.startTime,
          stop: Date.now(),
        },
        tests: this.tests,
      },
    };
  }

  /**
   * Get current counts for external tracking
   */
  getCounts(): { total: number; passed: number; failed: number; skipped: number } {
    return {
      total: this.testCount,
      passed: this.passCount,
      failed: this.failCount,
      skipped: this.skipCount,
    };
  }
}

/**
 * Create a CTRF Test object from event data
 */
export function createTestFromEvent(event: TestEvent): Test {
  const status: TestStatus =
    event.type === "test:pass"
      ? "passed"
      : event.type === "test:fail"
        ? "failed"
        : event.type === "test:skip"
          ? "skipped"
          : event.type === "test:pending"
            ? "pending"
            : "other";

  return {
    name: event.suiteName ? `${event.suiteName}::${event.name}` : event.name,
    status,
    duration: event.duration || 0,
    ...(event.message && { message: event.message }),
    ...(event.trace && { trace: event.trace }),
  };
}

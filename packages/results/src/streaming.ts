/**
 * Streaming Test Reporter
 *
 * Provides real-time test result output in a uniform format.
 * Works with both Vitest and PHPUnit test runners.
 *
 * Uses a unified state model with full screen rerendering for clean
 * parallel test execution without output interference.
 */

import type { Test, TestStatus, Report } from "ctrf";
import pc from "picocolors";

/**
 * Spinner frames for animated loader
 */
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

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
  fileId?: string;
}

/**
 * Suite event emitted during test execution
 */
export interface SuiteEvent {
  type: "suite:start" | "suite:end";
  name: string;
  fileId?: string;
}

/**
 * File event emitted when a test file starts/ends
 */
export interface FileEvent {
  type: "file:start" | "file:end";
  fileId: string;
  fileName?: string;
}

/**
 * Run event emitted at start/end of test run
 */
export interface RunEvent {
  type: "run:start" | "run:end";
  toolName?: string;
  report?: Report;
}

export type StreamEvent = TestEvent | SuiteEvent | FileEvent | RunEvent;

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
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Options for StreamingReporter constructor
 */
export interface StreamingReporterOptions {
  writer?: StreamWriter;
  showRunBoundaries?: boolean;
  showSummary?: boolean;
  enabled?: boolean;
}

/**
 * Test status in the unified state
 */
interface TestState {
  name: string;
  suiteName?: string;
  status: "running" | "passed" | "failed" | "skipped" | "pending";
  duration?: number;
  message?: string;
  trace?: string;
}

/**
 * Suite status in the unified state
 */
interface SuiteState {
  name: string;
  depth: number;
  tests: TestState[];
  isLoading: boolean; // True when suite has started but no tests have been reported yet
}

/**
 * File status in the unified state
 */
interface FileState {
  fileId: string;
  fileName?: string;
  suites: SuiteState[];
  currentSuiteStack: string[];
}

/**
 * Unified state for all test runs
 */
interface ReporterState {
  files: Map<string, FileState>;
  toolName: string;
  startTime: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
}

/**
 * Streaming test reporter for real-time test output
 *
 * Uses a unified state model where all test state is centralized and
 * the entire output is rerendered on each update. This approach:
 * - Eliminates output interference between parallel test runs
 * - Simplifies state management (no per-file buffering)
 * - Maintains dynamic UI with loaders/spinners
 * - Makes the code much easier to understand and maintain
 */
export class StreamingReporter {
  private writer: StreamWriter;
  private enabled = true;
  private showRunBoundaries = true;
  private showSummary = true;

  // Unified state
  private state: ReporterState;

  // Rendering state
  private lastOutputLineCount = 0;
  private spinnerFrame = 0;
  private spinnerInterval: NodeJS.Timeout | null = null;

  constructor(options: StreamingReporterOptions = {}) {
    this.writer = options.writer ?? stdoutWriter;
    this.showRunBoundaries = options.showRunBoundaries ?? true;
    this.showSummary = options.showSummary ?? true;
    this.enabled = options.enabled ?? true;

    this.state = {
      files: new Map(),
      toolName: "wp-tester",
      startTime: 0,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
    };
  }

  /**
   * Enable or disable run boundaries (header and summary)
   */
  setShowRunBoundaries(show: boolean): void {
    this.showRunBoundaries = show;
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
      case "file:start":
        this.onFileStart(event.fileId, event.fileName);
        break;
      case "file:end":
        this.onFileEnd(event.fileId);
        break;
      case "suite:start":
        this.onSuiteStart(event.name, event.fileId);
        break;
      case "suite:end":
        this.onSuiteEnd(event.name, event.fileId);
        break;
      case "test:start":
        this.onTestStart(event.name, event.suiteName, event.fileId);
        break;
      case "test:pass":
        this.onTestPass(event.name, event.duration || 0, event.suiteName, event.fileId);
        break;
      case "test:fail":
        this.onTestFail(
          event.name,
          event.duration || 0,
          event.message,
          event.trace,
          event.suiteName,
          event.fileId
        );
        break;
      case "test:skip":
        this.onTestSkip(event.name, event.message, event.suiteName, event.fileId);
        break;
      case "test:pending":
        this.onTestPending(event.name, event.suiteName, event.fileId);
        break;
    }
  }

  /**
   * Start the spinner animation
   */
  private startSpinner(): void {
    if (this.spinnerInterval || !this.enabled) return;

    this.spinnerInterval = setInterval(() => {
      this.spinnerFrame = (this.spinnerFrame + 1) % SPINNER_FRAMES.length;
      this.render();
    }, 80);
  }

  /**
   * Stop the spinner animation
   */
  private stopSpinner(): void {
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
      this.spinnerInterval = null;
    }
  }

  /**
   * Clear the previous output
   */
  private clearPreviousOutput(): void {
    if (!this.enabled || this.lastOutputLineCount === 0) return;

    // Move cursor up and clear each line
    for (let i = 0; i < this.lastOutputLineCount; i++) {
      this.writer.write("\x1b[1A\x1b[2K");
    }
  }

  /**
   * Render the current state to output
   */
  private render(): void {
    if (!this.enabled) return;

    // Build output lines
    const lines: string[] = [];

    // Check if there are any running tests or loading suites
    let hasRunningTests = false;
    for (const file of this.state.files.values()) {
      for (const suite of file.suites) {
        if (suite.isLoading || suite.tests.some(t => t.status === "running")) {
          hasRunningTests = true;
          break;
        }
      }
      if (hasRunningTests) break;
    }

    // Render each file
    for (const file of this.state.files.values()) {
      this.renderFile(file, lines);
    }

    // Clear previous output and render new output
    this.clearPreviousOutput();

    for (const line of lines) {
      this.writer.writeLine(line);
    }

    this.lastOutputLineCount = lines.length;

    // Start/stop spinner based on running tests
    if (hasRunningTests && !this.spinnerInterval) {
      this.startSpinner();
    } else if (!hasRunningTests && this.spinnerInterval) {
      this.stopSpinner();
    }
  }

  /**
   * Render a file's tests to output lines
   */
  private renderFile(file: FileState, lines: string[]): void {
    for (const suite of file.suites) {
      this.renderSuite(suite, lines);
    }
  }

  /**
   * Render a suite and its tests
   */
  private renderSuite(suite: SuiteState, lines: string[]): void {
    const indent = "  ".repeat(suite.depth);

    // Only show spinner if suite is loading AND has no tests yet
    // Don't show spinner if tests have been reported (loading is complete)
    const showSpinner = suite.isLoading && suite.tests.length === 0;

    if (showSpinner) {
      const spinner = pc.cyan(SPINNER_FRAMES[this.spinnerFrame]);
      lines.push(`${indent}${spinner} ${pc.bold(suite.name)}`);
    } else {
      // Use two spaces to replace the spinner character and space, preventing text shift
      lines.push(`${indent}  ${pc.bold(suite.name)}`);
    }

    // Render tests
    for (const test of suite.tests) {
      this.renderTest(test, suite.depth + 1, lines);
    }
  }

  /**
   * Render a single test
   */
  private renderTest(test: TestState, depth: number, lines: string[]): void {
    const indent = "  ".repeat(depth);

    switch (test.status) {
      case "running": {
        const spinner = pc.cyan(SPINNER_FRAMES[this.spinnerFrame]);
        lines.push(`${indent}${spinner} ${pc.dim(test.name)}`);
        break;
      }
      case "passed": {
        const durationStr = test.duration ? pc.dim(` ${formatDuration(test.duration)}`) : "";
        lines.push(`${indent}${pc.green("✓")} ${test.name}${durationStr}`);
        break;
      }
      case "failed": {
        const durationStr = test.duration ? pc.dim(` ${formatDuration(test.duration)}`) : "";
        lines.push(`${indent}${pc.red("✗")} ${test.name}${durationStr}`);
        if (test.message) {
          const messageIndent = "  ".repeat(depth + 1);
          const indentedMessage = test.message
            .split("\n")
            .map((line) => `${messageIndent}${pc.red(line)}`)
            .join("\n");
          lines.push(indentedMessage);
        }
        if (test.trace) {
          const traceIndent = "  ".repeat(depth + 1);
          const indentedTrace = test.trace
            .split("\n")
            .map((line) => `${traceIndent}${pc.dim(line)}`)
            .join("\n");
          lines.push(indentedTrace);
        }
        break;
      }
      case "skipped": {
        const reasonStr = test.message ? ` ${pc.dim(`(${test.message})`)}` : "";
        lines.push(`${indent}${pc.yellow("○ [SKIPPED]")} ${pc.dim(test.name)}${reasonStr}`);
        break;
      }
      case "pending": {
        lines.push(`${indent}${pc.yellow("○ [PENDING]")} ${pc.dim(test.name)}`);
        break;
      }
    }
  }

  /**
   * Get or create a file state
   */
  private getOrCreateFile(fileId: string, fileName?: string): FileState {
    let file = this.state.files.get(fileId);
    if (!file) {
      file = {
        fileId,
        fileName,
        suites: [],
        currentSuiteStack: [],
      };
      this.state.files.set(fileId, file);
    }
    return file;
  }

  /**
   * Find or create a suite in a file
   */
  private getOrCreateSuite(file: FileState, suiteName: string): SuiteState {
    // Find existing suite
    let suite = file.suites.find(s => s.name === suiteName);
    if (!suite) {
      suite = {
        name: suiteName,
        depth: file.currentSuiteStack.length,
        tests: [],
        isLoading: true, // Start in loading state
      };
      file.suites.push(suite);
    }
    return suite;
  }

  /**
   * Called when test run starts
   */
  onRunStart(toolName?: string): void {
    this.state = {
      files: new Map(),
      toolName: toolName || "wp-tester",
      startTime: Date.now(),
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
    };

    this.lastOutputLineCount = 0;
  }

  /**
   * Called when test run ends
   */
  onRunEnd(): void {
    this.stopSpinner();

    // Clean up any tests still in "running" state across all files
    // This ensures we never show spinners in the final output
    for (const file of this.state.files.values()) {
      for (const suite of file.suites) {
        suite.isLoading = false;
        for (const test of suite.tests) {
          if (test.status === "running") {
            test.status = "pending";
          }
        }
      }
    }

    // Final render
    this.render();

    if (!this.enabled || !this.showSummary) return;

    const duration = Date.now() - this.state.startTime;
    this.writer.writeLine("");
    this.printSummary(duration);
  }

  /**
   * Called when a test file starts
   */
  onFileStart(fileId: string, fileName?: string): void {
    this.getOrCreateFile(fileId, fileName);
  }

  /**
   * Called when a test file ends
   */
  onFileEnd(_fileId: string): void {
    // Nothing to do - state is already complete
    // We keep the file in state for final rendering
  }

  /**
   * Called when a test suite starts
   */
  onSuiteStart(name: string, fileId?: string): void {
    const file = fileId ? this.getOrCreateFile(fileId) : this.getOrCreateFile("__global__");
    file.currentSuiteStack.push(name);
    const suite = this.getOrCreateSuite(file, name);

    // When a child suite is created, mark all parent suites as not loading
    // Parent suites are those with depth less than the current suite's depth
    for (const s of file.suites) {
      if (s.depth < suite.depth) {
        s.isLoading = false;
      }
    }

    this.render();
  }

  /**
   * Called when a test suite ends
   */
  onSuiteEnd(name: string, fileId?: string): void {
    const file = fileId ? this.state.files.get(fileId) : this.state.files.get("__global__");
    if (file) {
      const index = file.currentSuiteStack.lastIndexOf(name);
      if (index !== -1) {
        file.currentSuiteStack.splice(index, 1);
      }

      // Mark suite as no longer loading when it ends
      // This ensures loaders are removed even if no tests were reported
      const suite = file.suites.find(s => s.name === name);
      if (suite) {
        suite.isLoading = false;

        // Clean up any tests still in "running" state - they should be marked as pending
        // This handles cases where test:start was received but no completion event followed
        for (const test of suite.tests) {
          if (test.status === "running") {
            test.status = "pending";
          }
        }
      }
    }
    this.render();
  }

  /**
   * Called when a test starts
   */
  onTestStart(name: string, suiteName?: string, fileId?: string): void {
    const file = fileId ? this.getOrCreateFile(fileId) : this.getOrCreateFile("__global__");
    const suite = this.getOrCreateSuite(file, suiteName || "Tests");

    // Mark ALL suites in this file as no longer loading once any test starts
    // This handles nested suite structures where parent suites don't directly contain tests
    for (const s of file.suites) {
      s.isLoading = false;
    }

    suite.tests.push({
      name,
      suiteName,
      status: "running",
    });

    this.render();
  }

  /**
   * Called when a test passes
   */
  onTestPass(name: string, duration: number, suiteName?: string, fileId?: string): void {
    const file = fileId ? this.getOrCreateFile(fileId) : this.getOrCreateFile("__global__");
    const suite = this.getOrCreateSuite(file, suiteName || "Tests");

    // Mark ALL suites in this file as no longer loading once any test completes
    // This handles nested suite structures where parent suites don't directly contain tests
    for (const s of file.suites) {
      s.isLoading = false;
    }

    // Find and update the test - try exact match first, then fallback to name-only match
    let test = suite.tests.find(t => t.name === name && t.suiteName === suiteName);
    if (!test) {
      // Fallback: try to find by name only (handles cases where suiteName might differ)
      test = suite.tests.find(t => t.name === name && t.status === "running");
    }

    if (test) {
      test.status = "passed";
      test.duration = duration;
    } else {
      suite.tests.push({
        name,
        suiteName,
        status: "passed",
        duration,
      });
    }

    this.state.totalTests++;
    this.state.passedTests++;
    this.render();
  }

  /**
   * Called when a test fails
   */
  onTestFail(
    name: string,
    duration: number,
    message?: string,
    trace?: string,
    suiteName?: string,
    fileId?: string
  ): void {
    const file = fileId ? this.getOrCreateFile(fileId) : this.getOrCreateFile("__global__");
    const suite = this.getOrCreateSuite(file, suiteName || "Tests");

    // Mark ALL suites in this file as no longer loading once any test completes
    // This handles nested suite structures where parent suites don't directly contain tests
    for (const s of file.suites) {
      s.isLoading = false;
    }

    // Find and update the test - try exact match first, then fallback to name-only match
    let test = suite.tests.find(t => t.name === name && t.suiteName === suiteName);
    if (!test) {
      // Fallback: try to find by name only (handles cases where suiteName might differ)
      test = suite.tests.find(t => t.name === name && t.status === "running");
    }

    if (test) {
      test.status = "failed";
      test.duration = duration;
      test.message = message;
      test.trace = trace;
    } else {
      suite.tests.push({
        name,
        suiteName,
        status: "failed",
        duration,
        message,
        trace,
      });
    }

    this.state.totalTests++;
    this.state.failedTests++;
    this.render();
  }

  /**
   * Called when a test is skipped
   */
  onTestSkip(name: string, reason?: string, suiteName?: string, fileId?: string): void {
    const file = fileId ? this.getOrCreateFile(fileId) : this.getOrCreateFile("__global__");
    const suite = this.getOrCreateSuite(file, suiteName || "Tests");

    // Mark ALL suites in this file as no longer loading once any test completes
    // This handles nested suite structures where parent suites don't directly contain tests
    for (const s of file.suites) {
      s.isLoading = false;
    }

    // Find and update the test - try exact match first, then fallback to name-only match
    let test = suite.tests.find(t => t.name === name && t.suiteName === suiteName);
    if (!test) {
      // Fallback: try to find by name only (handles cases where suiteName might differ)
      test = suite.tests.find(t => t.name === name && t.status === "running");
    }

    if (test) {
      test.status = "skipped";
      test.message = reason;
    } else {
      suite.tests.push({
        name,
        suiteName,
        status: "skipped",
        message: reason,
      });
    }

    this.state.totalTests++;
    this.state.skippedTests++;
    this.render();
  }

  /**
   * Called when a test is pending
   */
  onTestPending(name: string, suiteName?: string, fileId?: string): void {
    const file = fileId ? this.getOrCreateFile(fileId) : this.getOrCreateFile("__global__");
    const suite = this.getOrCreateSuite(file, suiteName || "Tests");

    // Mark suite as no longer loading once first test completes
    suite.isLoading = false;

    // Find and update the test
    const test = suite.tests.find(t => t.name === name && t.suiteName === suiteName);
    if (test) {
      test.status = "pending";
    } else {
      suite.tests.push({
        name,
        suiteName,
        status: "pending",
      });
    }

    this.state.totalTests++;
    this.render();
  }

  /**
   * Print final summary
   */
  private printSummary(duration: number): void {
    this.writer.writeLine("");

    if (this.state.passedTests > 0) {
      this.writer.writeLine(pc.green(`  ✓ ${this.state.passedTests} passed`));
    }
    if (this.state.failedTests > 0) {
      this.writer.writeLine(pc.red(`  ✗ ${this.state.failedTests} failed`));
    }
    if (this.state.skippedTests > 0) {
      this.writer.writeLine(pc.yellow(`  ○ ${this.state.skippedTests} skipped`));
    }

    this.writer.writeLine("");
    this.writer.writeLine(pc.dim(`  ${this.state.totalTests} tests in ${formatDuration(duration)}`));
    this.writer.writeLine("");

    // Print icon legend
    this.writer.writeLine(pc.dim("  Legend: ✓ passed  ✗ failed  ○ skipped/pending"));
    this.writer.writeLine("");
  }

  /**
   * Get the current report in CTRF format
   */
  getReport(): Report {
    const tests: Test[] = [];

    // Collect all tests from all files
    for (const file of this.state.files.values()) {
      for (const suite of file.suites) {
        for (const test of suite.tests) {
          const ctrf: Test = {
            name: test.suiteName ? `${test.suiteName}::${test.name}` : test.name,
            status: test.status === "running" ? "other" : test.status as TestStatus,
            duration: test.duration || 0,
          };

          if (test.message) {
            ctrf.message = test.message;
          }
          if (test.trace) {
            ctrf.trace = test.trace;
          }

          tests.push(ctrf);
        }
      }
    }

    return {
      reportFormat: "CTRF",
      specVersion: "1.0.0",
      results: {
        tool: {
          name: this.state.toolName,
        },
        summary: {
          tests: this.state.totalTests,
          passed: this.state.passedTests,
          failed: this.state.failedTests,
          skipped: this.state.skippedTests,
          pending: 0,
          other: 0,
          start: this.state.startTime,
          stop: Date.now(),
        },
        tests,
      },
    };
  }

  /**
   * Get current counts for external tracking
   */
  getCounts(): { total: number; passed: number; failed: number; skipped: number } {
    return {
      total: this.state.totalTests,
      passed: this.state.passedTests,
      failed: this.state.failedTests,
      skipped: this.state.skippedTests,
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

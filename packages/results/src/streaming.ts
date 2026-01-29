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
import { applyDiffHighlighting } from "./diff-utils.js";
import { SPINNER_FRAMES } from "./spinner.js";
import logUpdate from "log-update";

/**
 * Test event emitted during test execution
 */
export interface TestEvent {
  type: "test:start" | "test:pass" | "test:fail" | "test:skip" | "test:pending";
  name: string;
  suiteName?: string;
  suiteStack?: string[]; // Full suite hierarchy (e.g., ['ClassName', 'testMethod'] for data providers)
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
 * Filter options for controlling which test statuses are displayed
 */
export interface ReporterFilterOptions {
  /** Show passed tests (default: false) */
  passed?: boolean;
  /** Show failed tests (default: false) */
  failed?: boolean;
  /** Show skipped tests (default: false) */
  skipped?: boolean;
  /** Show pending tests (default: false) */
  pending?: boolean;
  /** Show other test statuses (default: false) */
  other?: boolean;
}

/**
 * Options for StreamingReporter constructor
 */
export interface StreamingReporterOptions {
  writer?: StreamWriter;
  showRunBoundaries?: boolean;
  showSummary?: boolean;
  enabled?: boolean;
  /** Filter options for which test statuses to display */
  filter?: ReporterFilterOptions;
}

/**
 * Test status in the unified state
 */
interface TestState {
  name: string;
  suiteName?: string;
  suiteStack?: string[]; // Full suite hierarchy for generating filters
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
  parentStack: string[]; // Stack of parent suite names when this suite was created
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
  displayName?: string;
  startTime: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  pendingTests: number;
  isRunning: boolean;
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
  private filter: ReporterFilterOptions;
  private useLogUpdate: boolean;

  // Unified state
  private state: ReporterState;

  // Rendering state
  private spinnerFrame = 0;
  private spinnerInterval: NodeJS.Timeout | null = null;

  // Throttling state
  private renderThrottleTimeout: NodeJS.Timeout | null = null;
  private pendingRender = false;
  private readonly renderInterval = 50; // Render at most every 50ms (~20fps)

  constructor(options: StreamingReporterOptions = {}) {
    this.writer = options.writer ?? stdoutWriter;
    this.showRunBoundaries = options.showRunBoundaries ?? true;
    this.showSummary = options.showSummary ?? true;
    this.enabled = options.enabled ?? true;

    // Use log-update only if:
    // - Reporter is enabled
    // - We're using the default stdout writer (not a custom writer)
    // - stdout is a TTY (log-update handles this check internally)
    this.useLogUpdate = this.enabled && this.writer === stdoutWriter && (process.stdout.isTTY ?? false);

    // Default filter: show all statuses (for backwards compatibility)
    this.filter = options.filter ?? {
      passed: true,
      failed: true,
      skipped: true,
      pending: true,
      other: true,
    };

    this.state = {
      files: new Map(),
      toolName: "wp-tester",
      startTime: 0,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      pendingTests: 0,
      isRunning: false,
    };
  }

  /**
   * Generate filter command for re-running a specific test
   * Override in subclasses for framework-specific behavior
   */
  protected getFilterCommand(
    _testName: string,
    _suiteName?: string,
    _suiteStack?: string[],
  ): string | null {
    return null;
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
        this.onTestStart(event.name, event.suiteName, event.suiteStack, event.fileId);
        break;
      case "test:pass":
        this.onTestPass(
          event.name,
          event.duration || 0,
          event.suiteName,
          event.suiteStack,
          event.fileId,
        );
        break;
      case "test:fail":
        this.onTestFail(
          event.name,
          event.duration || 0,
          event.message,
          event.trace,
          event.suiteName,
          event.suiteStack,
          event.fileId,
        );
        break;
      case "test:skip":
        this.onTestSkip(
          event.name,
          event.message,
          event.suiteName,
          event.suiteStack,
          event.fileId,
        );
        break;
      case "test:pending":
        this.onTestPending(event.name, event.suiteName, event.suiteStack, event.fileId);
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
   * Clear throttle timeout and execute any pending render
   */
  private clearThrottle(): void {
    if (this.renderThrottleTimeout) {
      clearTimeout(this.renderThrottleTimeout);
      this.renderThrottleTimeout = null;
    }
    // Execute any pending render
    if (this.pendingRender) {
      this.renderImmediate();
    }
  }

  /**
   * Render the current state to output (throttled)
   */
  private render(): void {
    if (!this.enabled) return;

    // Mark that a render is pending
    this.pendingRender = true;

    // If we're already waiting for a throttled render, just update the flag
    if (this.renderThrottleTimeout) {
      return;
    }

    // Execute render immediately and schedule the next allowed render time
    this.renderThrottleTimeout = setTimeout(() => {
      this.renderThrottleTimeout = null;

      // If another render was requested while throttled, execute it now
      if (this.pendingRender) {
        this.renderImmediate();
      }
    }, this.renderInterval);

    // Execute the first render immediately
    this.renderImmediate();
  }

  /**
   * Execute render immediately without throttling
   */
  private renderImmediate(): void {
    this.pendingRender = false;

    // Build output lines
    const lines: string[] = [];

    // Check if there are any running tests or loading suites
    let hasRunningTests = false;
    for (const file of this.state.files.values()) {
      for (const suite of file.suites) {
        if (
          suite.isLoading ||
          suite.tests.some((t) => t.status === "running")
        ) {
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

    // Render output based on environment
    if (this.useLogUpdate) {
      // TTY mode: use log-update for live updates with clearing
      logUpdate(lines.join('\n'));
    } else {
      // Non-TTY mode or custom writer: render once only when tests complete
      // Skip intermediate renders to avoid duplicate output
      // Tests and non-interactive environments see final state only
    }

    // Start/stop spinner based on running tests
    if (hasRunningTests && !this.spinnerInterval) {
      this.startSpinner();
    } else if (!hasRunningTests && this.spinnerInterval) {
      this.stopSpinner();
    }
  }

  /**
   * Render final output (used in non-interactive mode)
   */
  private renderFinal(): void {
    const lines: string[] = [];

    // Render each file
    for (const file of this.state.files.values()) {
      this.renderFile(file, lines);
    }

    // Write final output
    for (const line of lines) {
      this.writer.writeLine(line);
    }
  }

  /**
   * Check if a suite or any of its descendants has visible content
   */
  private hasVisibleContent(file: FileState, suiteIndex: number): boolean {
    const suite = file.suites[suiteIndex];

    // Check if suite is loading (always visible during loading)
    if (suite.isLoading && suite.tests.length === 0) {
      return true;
    }

    // Check if suite has any visible tests
    const hasVisibleTests = suite.tests.some((test) =>
      this.shouldShowStatus(test.status),
    );
    if (hasVisibleTests) {
      return true;
    }

    // Check if any child suites (with depth > current depth) have visible content
    const currentDepth = suite.depth;
    for (let i = suiteIndex + 1; i < file.suites.length; i++) {
      const nextSuite = file.suites[i];

      // If we've returned to the same or lower depth, we've exited the children
      if (nextSuite.depth <= currentDepth) {
        break;
      }

      // Only check immediate children (depth = current + 1)
      if (nextSuite.depth === currentDepth + 1) {
        if (this.hasVisibleContent(file, i)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Render a file's tests to output lines
   */
  private renderFile(file: FileState, lines: string[]): void {
    for (let i = 0; i < file.suites.length; i++) {
      this.renderSuite(file, i, lines);
    }
  }

  /**
   * Render a suite and its tests
   */
  private renderSuite(
    file: FileState,
    suiteIndex: number,
    lines: string[],
  ): void {
    const suite = file.suites[suiteIndex];
    const indent = "  ".repeat(suite.depth);

    // Only show spinner if suite is loading AND has no tests yet
    // Don't show spinner if tests have been reported (loading is complete)
    const showSpinner = suite.isLoading && suite.tests.length === 0;

    // Collect visible tests first to determine if suite should be shown
    const visibleTestLines: string[] = [];
    for (const test of suite.tests) {
      if (this.shouldShowStatus(test.status)) {
        this.renderTest(test, suite.depth + 1, visibleTestLines);
      }
    }

    // Check if this suite has visible content (tests or child suites with content)
    if (!this.hasVisibleContent(file, suiteIndex)) {
      return; // Skip rendering this suite entirely
    }

    // Render the suite name
    if (showSpinner) {
      const spinner = pc.cyan(SPINNER_FRAMES[this.spinnerFrame]);
      lines.push(`${indent}${spinner} ${pc.bold(suite.name)}`);
    } else {
      // Use two spaces to replace the spinner character and space, preventing text shift
      lines.push(`${indent}  ${pc.bold(suite.name)}`);
    }

    // Add the visible test lines
    lines.push(...visibleTestLines);
  }

  /**
   * Check if a test status should be displayed based on filter settings
   */
  private shouldShowStatus(status: TestState["status"]): boolean {
    // Always show running tests (transient state)
    if (status === "running") {
      return true;
    }

    // Map status to filter property
    const filterMap: Record<
      Exclude<TestState["status"], "running">,
      keyof ReporterFilterOptions
    > = {
      passed: "passed",
      failed: "failed",
      skipped: "skipped",
      pending: "pending",
    };

    const filterKey = filterMap[status];
    return this.filter[filterKey] ?? false;
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
        const durationStr = test.duration
          ? pc.dim(` ${formatDuration(test.duration)}`)
          : "";
        lines.push(`${indent}${pc.green("✓")} ${test.name}${durationStr}`);
        break;
      }
      case "failed": {
        const durationStr = test.duration
          ? pc.dim(` ${formatDuration(test.duration)}`)
          : "";
        lines.push(`${indent}${pc.red("✗")} ${test.name}${durationStr}`);
        if (test.message) {
          const messageIndent = "  ".repeat(depth + 1);
          for (const line of test.message.split("\n")) {
            lines.push(`${messageIndent}${pc.red(line)}`);
          }
        }
        if (test.trace) {
          const traceIndent = "  ".repeat(depth + 1);
          const traceLines = test.trace.split("\n");

          for (let i = 0; i < traceLines.length; i++) {
            const line = traceLines[i];
            const trimmed = line.trim();

            // Detect Expected/Actual labels and color the values (supports multiline values)
            if (trimmed === "Expected:" && i + 1 < traceLines.length) {
              lines.push(`${traceIndent}${pc.dim("Expected:")}`);
              i++; // Move to the first value line

              // Continue processing lines until we hit Actual:, an empty line, or end of trace
              while (i < traceLines.length) {
                const valueLine = traceLines[i];
                const valueTrimmed = valueLine.trim();

                // Stop if we hit the Actual: label or empty line
                if (valueTrimmed === "Actual:" || valueTrimmed === "") {
                  i--; // Back up so the outer loop can process this line
                  break;
                }

                if (valueTrimmed) {
                  lines.push(
                    `${traceIndent}${applyDiffHighlighting(valueLine, pc.red)}`,
                  );
                }
                i++;
              }
            } else if (trimmed === "Actual:" && i + 1 < traceLines.length) {
              lines.push(`${traceIndent}${pc.dim("Actual:")}`);
              i++; // Move to the first value line

              // Continue processing lines until we hit an empty line or end of trace
              while (i < traceLines.length) {
                const valueLine = traceLines[i];
                const valueTrimmed = valueLine.trim();

                // Stop if we hit an empty line
                if (valueTrimmed === "") {
                  i--; // Back up so the outer loop can process this line
                  break;
                }

                if (valueTrimmed) {
                  lines.push(
                    `${traceIndent}${applyDiffHighlighting(
                      valueLine,
                      pc.green,
                    )}`,
                  );
                }
                i++;
              }
            } else if (trimmed) {
              // File paths, context lines, other trace info
              lines.push(`${traceIndent}${pc.dim(line)}`);
            } else {
              // Empty lines (preserve them for spacing)
              lines.push("");
            }
          }

          // Add filter to re-run this specific test
          if (test.name) {
            const filterCmd = this.getFilterCommand(test.name, test.suiteName, test.suiteStack);
            if (filterCmd) {
              lines.push(
                `${traceIndent}${pc.dim("Re-run only this test by appending:")}`,
              );
              lines.push(`${traceIndent}${pc.dim(filterCmd)}`);
            }
          }
        }
        break;
      }
      case "skipped": {
        const reasonStr = test.message
          ? ` ${pc.dim(`(${test.message})`)}`
          : ` ${pc.dim("(Skipped)")}`;
        lines.push(
          `${indent}${pc.yellow("○")} ${pc.dim(test.name)}${reasonStr}`,
        );
        break;
      }
      case "pending": {
        const message = test.message ? ` ${pc.dim(`(${test.message})`)}` : "";
        lines.push(`${indent}${pc.yellow("◔")} ${pc.dim(test.name)}${message}`);
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
    // Find existing suite with matching name, depth, AND parent context
    // This prevents suites with the same name from being confused when they're
    // in different branches of the suite tree (e.g., Test_Accept::test_method
    // vs Test_Reject::test_method both creating a "test_method" sub-suite)
    const currentDepth = file.currentSuiteStack.length;

    // Create a snapshot of the current parent stack (excluding the current suite name)
    const parentStack = [...file.currentSuiteStack];

    // Find a suite with matching name, depth, and parent stack
    let suite = file.suites.find((s) => {
      if (s.name !== suiteName || s.depth !== currentDepth) {
        return false;
      }

      // Check if parent stacks match
      if (s.parentStack.length !== parentStack.length) {
        return false;
      }

      for (let i = 0; i < parentStack.length; i++) {
        if (s.parentStack[i] !== parentStack[i]) {
          return false;
        }
      }

      return true;
    });

    if (!suite) {
      suite = {
        name: suiteName,
        depth: currentDepth,
        tests: [],
        isLoading: true, // Start in loading state
        parentStack: parentStack,
      };
      file.suites.push(suite);
    }
    return suite;
  }

  /**
   * Get display name from tool name
   */
  private getDisplayName(toolName: string): string {
    const nameMap: Record<string, string> = {
      "wp-tester-phpunit": "PHPUnit Tests",
      "wp-tester-smoke": "WordPress Tests",
      "wp-tester": "Tests",
    };
    return nameMap[toolName] || toolName;
  }

  /**
   * Called when test run starts
   */
  onRunStart(toolName?: string): void {
    const tool = toolName || "wp-tester";
    this.state = {
      files: new Map(),
      toolName: tool,
      displayName: this.getDisplayName(tool),
      startTime: Date.now(),
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      pendingTests: 0,
      isRunning: true,
    };

    // Clear any previous log-update state
    if (this.useLogUpdate) {
      logUpdate.clear();
    }

    // Clear any previous throttle state
    if (this.renderThrottleTimeout) {
      clearTimeout(this.renderThrottleTimeout);
      this.renderThrottleTimeout = null;
    }
    this.pendingRender = false;
  }

  /**
   * Called when test run ends
   */
  onRunEnd(): void {
    this.stopSpinner();
    this.clearThrottle(); // Clear any pending throttled renders
    this.state.isRunning = false;

    // Clean up any tests still in "running" state across all files
    // This ensures we never show spinners in the final output
    for (const file of this.state.files.values()) {
      for (const suite of file.suites) {
        suite.isLoading = false;
        for (const test of suite.tests) {
          if (test.status === "running") {
            test.status = "pending";
            test.message = test.message || "Did not complete";
            this.state.pendingTests++;
            this.state.totalTests++;
          }
        }
      }
    }

    // Final render
    if (this.useLogUpdate) {
      // Clear the live updating display
      logUpdate.clear();
      logUpdate.done();
    }

    // Always use renderFinal for the final output to avoid truncation
    // log-update is only for live updates, not for final large output
    this.renderFinal();

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
    const file = fileId
      ? this.getOrCreateFile(fileId)
      : this.getOrCreateFile("__global__");
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
    const file = fileId
      ? this.state.files.get(fileId)
      : this.state.files.get("__global__");
    if (file) {
      const index = file.currentSuiteStack.lastIndexOf(name);
      if (index !== -1) {
        file.currentSuiteStack.splice(index, 1);
      }

      // Mark suite as no longer loading when it ends
      // This ensures loaders are removed even if no tests were reported
      const suite = file.suites.find((s) => s.name === name);
      if (suite) {
        suite.isLoading = false;

        // Clean up any tests still in "running" state - they should be marked as pending
        // This handles cases where test:start was received but no completion event followed
        for (const test of suite.tests) {
          if (test.status === "running") {
            test.status = "pending";
            test.message = test.message || "Did not complete";
            this.state.pendingTests++;
            this.state.totalTests++;
          }
        }
      }
    }
    this.render();
  }

  /**
   * Called when a test starts
   */
  onTestStart(name: string, suiteName?: string, suiteStack?: string[], fileId?: string): void {
    const file = fileId
      ? this.getOrCreateFile(fileId)
      : this.getOrCreateFile("__global__");
    const suite = this.getOrCreateSuite(file, suiteName || "Tests");

    // Mark ALL suites in this file as no longer loading once any test starts
    // This handles nested suite structures where parent suites don't directly contain tests
    for (const s of file.suites) {
      s.isLoading = false;
    }

    // Check if test already exists (completion event arrived before start event)
    const existingTest = suite.tests.find(
      (t) => t.name === name && t.suiteName === suiteName,
    );
    if (!existingTest) {
      // Test doesn't exist yet - create it in running state
      suite.tests.push({
        name,
        suiteName,
        suiteStack,
        status: "running",
      });
    }
    // If test already exists with a completed status, don't change it

    this.render();
  }

  /**
   * Called when a test passes
   */
  onTestPass(
    name: string,
    duration: number,
    suiteName?: string,
    suiteStack?: string[],
    fileId?: string,
  ): void {
    const file = fileId
      ? this.getOrCreateFile(fileId)
      : this.getOrCreateFile("__global__");
    const suite = this.getOrCreateSuite(file, suiteName || "Tests");

    // Mark ALL suites in this file as no longer loading once any test completes
    // This handles nested suite structures where parent suites don't directly contain tests
    for (const s of file.suites) {
      s.isLoading = false;
    }

    // Find and update the test
    // Look for a test in "running" state first (most common case - completion follows start)
    let test = suite.tests.find(
      (t) => t.name === name && t.status === "running",
    );

    if (!test) {
      // Fallback: try exact match with suiteName (handles case where test completed before start event)
      test = suite.tests.find(
        (t) => t.name === name && t.suiteName === suiteName,
      );
    }

    if (test) {
      test.status = "passed";
      test.duration = duration;
      test.suiteName = suiteName; // Ensure suiteName is set
      test.suiteStack = suiteStack;
    } else {
      // Test start event hasn't arrived yet - create the test with completed state
      suite.tests.push({
        name,
        suiteName,
        suiteStack,
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
    suiteStack?: string[],
    fileId?: string,
  ): void {
    const file = fileId
      ? this.getOrCreateFile(fileId)
      : this.getOrCreateFile("__global__");
    const suite = this.getOrCreateSuite(file, suiteName || "Tests");

    // Mark ALL suites in this file as no longer loading once any test completes
    // This handles nested suite structures where parent suites don't directly contain tests
    for (const s of file.suites) {
      s.isLoading = false;
    }

    // Find and update the test
    // Look for a test in "running" state first (most common case - completion follows start)
    let test = suite.tests.find(
      (t) => t.name === name && t.status === "running",
    );

    if (!test) {
      // Fallback: try exact match with suiteName (handles case where test completed before start event)
      test = suite.tests.find(
        (t) => t.name === name && t.suiteName === suiteName,
      );
    }

    if (test) {
      test.status = "failed";
      test.duration = duration;
      test.message = message;
      test.trace = trace;
      test.suiteName = suiteName; // Ensure suiteName is set
      test.suiteStack = suiteStack;
    } else {
      // Test start event hasn't arrived yet - create the test with completed state
      suite.tests.push({
        name,
        suiteName,
        suiteStack,
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
  onTestSkip(
    name: string,
    reason?: string,
    suiteName?: string,
    suiteStack?: string[],
    fileId?: string,
  ): void {
    const file = fileId
      ? this.getOrCreateFile(fileId)
      : this.getOrCreateFile("__global__");
    const suite = this.getOrCreateSuite(file, suiteName || "Tests");

    // Mark ALL suites in this file as no longer loading once any test completes
    // This handles nested suite structures where parent suites don't directly contain tests
    for (const s of file.suites) {
      s.isLoading = false;
    }

    // Find and update the test
    // Look for a test in "running" state first (most common case - completion follows start)
    let test = suite.tests.find(
      (t) => t.name === name && t.status === "running",
    );

    if (!test) {
      // Fallback: try exact match with suiteName (handles case where test completed before start event)
      test = suite.tests.find(
        (t) => t.name === name && t.suiteName === suiteName,
      );
    }

    if (test) {
      test.status = "skipped";
      test.message = reason;
      test.suiteName = suiteName; // Ensure suiteName is set
      test.suiteStack = suiteStack;
    } else {
      // Test start event hasn't arrived yet - create the test with completed state
      suite.tests.push({
        name,
        suiteName,
        suiteStack,
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
  onTestPending(name: string, suiteName?: string, suiteStack?: string[], fileId?: string): void {
    const file = fileId
      ? this.getOrCreateFile(fileId)
      : this.getOrCreateFile("__global__");
    const suite = this.getOrCreateSuite(file, suiteName || "Tests");

    // Mark suite as no longer loading once first test completes
    suite.isLoading = false;

    // Find and update the test
    const test = suite.tests.find(
      (t) => t.name === name && t.suiteName === suiteName,
    );
    if (test) {
      test.status = "pending";
      test.suiteStack = suiteStack;
    } else {
      suite.tests.push({
        name,
        suiteName,
        suiteStack,
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
      this.writer.writeLine(
        pc.yellow(`  ○ ${this.state.skippedTests} skipped`),
      );
    }
    if (this.state.pendingTests > 0) {
      this.writer.writeLine(
        pc.yellow(`  ◔ ${this.state.pendingTests} pending`),
      );
    }

    this.writer.writeLine("");
    this.writer.writeLine(
      pc.dim(`  ${this.state.totalTests} tests in ${formatDuration(duration)}`),
    );
    this.writer.writeLine("");

    // Print icon legend
    this.writer.writeLine(
      pc.dim("  Legend: ✓ passed  ✗ failed  ○ skipped  ◔ pending"),
    );
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
            name: test.suiteName
              ? `${test.suiteName}::${test.name}`
              : test.name,
            status:
              test.status === "running" ? "other" : (test.status as TestStatus),
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
          pending: this.state.pendingTests,
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
  getCounts(): {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    pending: number;
  } {
    return {
      total: this.state.totalTests,
      passed: this.state.passedTests,
      failed: this.state.failedTests,
      skipped: this.state.skippedTests,
      pending: this.state.pendingTests,
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

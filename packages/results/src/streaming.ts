/**
 * Streaming Test Reporter
 *
 * Provides real-time test result output in a uniform format.
 * Works with both Vitest and PHPUnit test runners.
 *
 * Uses Ink (React for CLI) for rendering test output.
 */

import type { Test, TestStatus, Report } from "ctrf";
import {
  createInkRenderer,
  type InkRenderer,
  type TestState,
  type SuiteState,
  type FileState,
  type ReporterState,
} from "./ink-ui.js";

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
 * Output writer interface for streaming results (kept for backwards compatibility)
 */
export interface StreamWriter {
  write(text: string): void;
  writeLine(text: string): void;
}

/**
 * Default stdout writer (kept for backwards compatibility)
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
 * Streaming test reporter for real-time test output
 *
 * Uses a unified state model where all test state is centralized and
 * renders output using Ink (React for CLI).
 */
export class StreamingReporter {
  private enabled = true;
  private showSummary = true;
  private filter: ReporterFilterOptions;

  // Unified state
  private state: ReporterState;

  // Ink renderer
  private inkRenderer: InkRenderer | null = null;

  constructor(options: StreamingReporterOptions = {}) {
    this.showSummary = options.showSummary ?? true;
    this.enabled = options.enabled ?? true;
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
    _suiteName?: string
  ): string | null {
    return null;
  }

  /**
   * Enable or disable run boundaries (header and summary)
   * Note: This is kept for API compatibility but only affects summary display
   */
  setShowRunBoundaries(show: boolean): void {
    this.showSummary = show;
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
        this.onTestPass(
          event.name,
          event.duration || 0,
          event.suiteName,
          event.fileId
        );
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
        this.onTestSkip(
          event.name,
          event.message,
          event.suiteName,
          event.fileId
        );
        break;
      case "test:pending":
        this.onTestPending(event.name, event.suiteName, event.fileId);
        break;
    }
  }

  /**
   * Render the current state using Ink
   */
  private render(): void {
    if (!this.enabled || !this.inkRenderer) return;
    this.inkRenderer.rerender(this.state);
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
      } as FileState & { currentSuiteStack: string[] };
      this.state.files.set(fileId, file);
    }
    return file;
  }

  /**
   * Find or create a suite in a file
   */
  private getOrCreateSuite(
    file: FileState & { currentSuiteStack?: string[] },
    suiteName: string
  ): SuiteState {
    // Find existing suite
    let suite = file.suites.find((s) => s.name === suiteName);
    if (!suite) {
      suite = {
        name: suiteName,
        depth: file.currentSuiteStack?.length ?? 0,
        tests: [],
        isLoading: true, // Start in loading state
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
      startTime: Date.now(),
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      pendingTests: 0,
      isRunning: true,
    };

    // Initialize Ink renderer
    if (this.enabled) {
      this.inkRenderer = createInkRenderer(
        this.filter,
        this.showSummary,
        (testName, suiteName) => this.getFilterCommand(testName, suiteName)
      );
    }
  }

  /**
   * Called when test run ends
   */
  onRunEnd(): void {
    this.state.isRunning = false;

    // Clean up any tests still in "running" state across all files
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

    // Final render and cleanup
    this.render();

    if (this.inkRenderer) {
      this.inkRenderer.unmount();
      this.inkRenderer = null;
    }
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
  }

  /**
   * Called when a test suite starts
   */
  onSuiteStart(name: string, fileId?: string): void {
    const file = fileId
      ? this.getOrCreateFile(fileId)
      : this.getOrCreateFile("__global__");
    const fileWithStack = file as FileState & { currentSuiteStack: string[] };
    if (!fileWithStack.currentSuiteStack) {
      fileWithStack.currentSuiteStack = [];
    }
    fileWithStack.currentSuiteStack.push(name);
    const suite = this.getOrCreateSuite(fileWithStack, name);

    // When a child suite is created, mark all parent suites as not loading
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
      const fileWithStack = file as FileState & { currentSuiteStack?: string[] };
      if (fileWithStack.currentSuiteStack) {
        const index = fileWithStack.currentSuiteStack.lastIndexOf(name);
        if (index !== -1) {
          fileWithStack.currentSuiteStack.splice(index, 1);
        }
      }

      // Mark suite as no longer loading
      const suite = file.suites.find((s) => s.name === name);
      if (suite) {
        suite.isLoading = false;

        // Clean up any tests still in "running" state
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
  onTestStart(name: string, suiteName?: string, fileId?: string): void {
    const file = fileId
      ? this.getOrCreateFile(fileId)
      : this.getOrCreateFile("__global__");
    const suite = this.getOrCreateSuite(
      file as FileState & { currentSuiteStack: string[] },
      suiteName || "Tests"
    );

    // Mark ALL suites in this file as no longer loading
    for (const s of file.suites) {
      s.isLoading = false;
    }

    // Check if test already exists (completion event arrived before start event)
    const existingTest = suite.tests.find(
      (t) => t.name === name && t.suiteName === suiteName
    );
    if (!existingTest) {
      suite.tests.push({
        name,
        suiteName,
        status: "running",
      });
    }

    this.render();
  }

  /**
   * Called when a test passes
   */
  onTestPass(
    name: string,
    duration: number,
    suiteName?: string,
    fileId?: string
  ): void {
    const file = fileId
      ? this.getOrCreateFile(fileId)
      : this.getOrCreateFile("__global__");
    const suite = this.getOrCreateSuite(
      file as FileState & { currentSuiteStack: string[] },
      suiteName || "Tests"
    );

    // Mark ALL suites as no longer loading
    for (const s of file.suites) {
      s.isLoading = false;
    }

    // Find and update the test
    let test = suite.tests.find(
      (t) => t.name === name && t.status === "running"
    );
    if (!test) {
      test = suite.tests.find(
        (t) => t.name === name && t.suiteName === suiteName
      );
    }

    if (test) {
      test.status = "passed";
      test.duration = duration;
      test.suiteName = suiteName;
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
    const file = fileId
      ? this.getOrCreateFile(fileId)
      : this.getOrCreateFile("__global__");
    const suite = this.getOrCreateSuite(
      file as FileState & { currentSuiteStack: string[] },
      suiteName || "Tests"
    );

    // Mark ALL suites as no longer loading
    for (const s of file.suites) {
      s.isLoading = false;
    }

    // Find and update the test
    let test = suite.tests.find(
      (t) => t.name === name && t.status === "running"
    );
    if (!test) {
      test = suite.tests.find(
        (t) => t.name === name && t.suiteName === suiteName
      );
    }

    if (test) {
      test.status = "failed";
      test.duration = duration;
      test.message = message;
      test.trace = trace;
      test.suiteName = suiteName;
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
  onTestSkip(
    name: string,
    reason?: string,
    suiteName?: string,
    fileId?: string
  ): void {
    const file = fileId
      ? this.getOrCreateFile(fileId)
      : this.getOrCreateFile("__global__");
    const suite = this.getOrCreateSuite(
      file as FileState & { currentSuiteStack: string[] },
      suiteName || "Tests"
    );

    // Mark ALL suites as no longer loading
    for (const s of file.suites) {
      s.isLoading = false;
    }

    // Find and update the test
    let test = suite.tests.find(
      (t) => t.name === name && t.status === "running"
    );
    if (!test) {
      test = suite.tests.find(
        (t) => t.name === name && t.suiteName === suiteName
      );
    }

    if (test) {
      test.status = "skipped";
      test.message = reason;
      test.suiteName = suiteName;
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
    const file = fileId
      ? this.getOrCreateFile(fileId)
      : this.getOrCreateFile("__global__");
    const suite = this.getOrCreateSuite(
      file as FileState & { currentSuiteStack: string[] },
      suiteName || "Tests"
    );

    // Mark suite as no longer loading
    suite.isLoading = false;

    // Find and update the test
    const test = suite.tests.find(
      (t) => t.name === name && t.suiteName === suiteName
    );
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
    this.state.pendingTests++;
    this.render();
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

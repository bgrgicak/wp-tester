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

/**
 * Unified streaming reporter that combines multiple test suite outputs
 *
 * This reporter tracks multiple concurrent test runs and only renders
 * final output when all runs are complete. It also handles generating
 * appropriate filter commands for different test types (Vitest vs PHPUnit).
 */
export class UnifiedStreamingReporter extends StreamingReporter {
  private activeRuns = new Set<string>();
  private hasStarted = false;

  constructor(options: StreamingReporterOptions = {}) {
    super(options);
  }

  /**
   * Handle run:start events - track active runs without resetting state
   */
  onRunStart(toolName?: string): void {
    const tool = toolName || "wp-tester";
    this.activeRuns.add(tool);

    // Only initialize state on the very first run
    if (!this.hasStarted) {
      this.hasStarted = true;
      // Use "wp-tester" as the unified tool name
      super.onRunStart("wp-tester");
    }
    // For subsequent runs, don't reset state - just continue accumulating
  }

  /**
   * Handle run:end events - only finalize when all runs are complete
   */
  onRunEnd(): void {
    // Find the most recently started run and remove it
    // We remove the last one added since runs are sequential
    const lastRun = Array.from(this.activeRuns).pop();
    if (lastRun) {
      this.activeRuns.delete(lastRun);
    }

    // Only render final output when all runs are complete
    if (this.activeRuns.size === 0) {
      super.onRunEnd();
    }
  }

  /**
   * Process stream events with unified handling
   */
  onEvent(event: StreamEvent): void {
    // Handle run:start and run:end specially
    if (event.type === "run:start") {
      this.onRunStart(event.toolName);
      return;
    }
    if (event.type === "run:end") {
      this.onRunEnd();
      return;
    }

    // All other events are processed normally
    super.onEvent(event);
  }

  /**
   * Generate filter command based on test metadata
   *
   * Detects test type by checking for namespace separators in the suite stack:
   * - PHPUnit tests have namespaced class names with backslashes
   * - Vitest tests have simple suite names without backslashes
   */
  protected getFilterCommand(
    testName: string,
    suiteName?: string,
    suiteStack?: string[]
  ): string | null {
    // Detect PHPUnit by checking for namespace separators in suite stack
    const isPHPUnit = suiteStack?.some((s) => s.includes("\\"));

    if (isPHPUnit) {
      return this.getPhpunitFilterCommand(testName, suiteName, suiteStack);
    } else {
      return this.getVitestFilterCommand(testName, suiteName);
    }
  }

  /**
   * Generate PHPUnit filter command
   * PHPUnit uses --filter with ClassName::testName format
   */
  private getPhpunitFilterCommand(
    testName: string,
    suiteName?: string,
    suiteStack?: string[]
  ): string | null {
    if (suiteStack && suiteStack.length > 0) {
      // Find the last suite that contains a namespace separator (backslash)
      // This is typically the class name
      let className: string | null = null;
      for (let i = suiteStack.length - 1; i >= 0; i--) {
        if (suiteStack[i].includes("\\")) {
          className = suiteStack[i];
          break;
        }
      }

      if (className) {
        // Escape backslashes for shell
        const filterArg = `${className}::${testName}`.replace(/\\/g, "\\\\");
        return `-- --filter '${filterArg}'`;
      }

      // Fallback to first suite
      const filterArg = `${suiteStack[0]}::${testName}`.replace(/\\/g, "\\\\");
      return `-- --filter '${filterArg}'`;
    }

    // Fallback to suiteName
    const filterArg = suiteName ? `${suiteName}::${testName}` : testName;
    return `-- --filter '${filterArg.replace(/\\/g, "\\\\")}'`;
  }

  /**
   * Generate Vitest filter command
   * Vitest uses -t or --testNamePattern with regex
   */
  private getVitestFilterCommand(
    testName: string,
    suiteName?: string
  ): string | null {
    // Escape special regex characters in test name
    const escapedName = testName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const filterArg = suiteName
      ? `${suiteName}.*${escapedName}`
      : escapedName;
    return `-- -t '${filterArg}'`;
  }
}

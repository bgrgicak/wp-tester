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
 * Tracks multiple sequential test runs and only renders final output when
 * all runs are complete. Detects test type (Vitest vs PHPUnit) based on
 * namespace patterns in suite stack to generate appropriate filter commands.
 */
export class UnifiedStreamingReporter extends StreamingReporter {
  private activeRunCount = 0;
  private hasInitialized = false;

  constructor(options: StreamingReporterOptions = {}) {
    super(options);
  }

  /**
   * Override onRunStart to track active runs without resetting state
   */
  onRunStart(toolName?: string): void {
    this.activeRunCount++;
    // Only initialize on the very first run
    if (!this.hasInitialized) {
      this.hasInitialized = true;
      super.onRunStart("wp-tester");
    }
  }

  /**
   * Override onRunEnd to only finalize when all runs complete
   */
  onRunEnd(): void {
    this.activeRunCount--;
    // Only finalize when all runs complete
    if (this.activeRunCount === 0 && this.hasInitialized) {
      super.onRunEnd();
    }
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
   * Generate filter command based on test metadata
   *
   * Detects PHPUnit tests by checking for namespace separators (backslashes)
   * in the suite stack, since PHPUnit uses namespaced class names.
   */
  protected getFilterCommand(
    testName: string,
    suiteName?: string,
    suiteStack?: string[]
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

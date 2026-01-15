/**
 * Vitest Streaming Reporter Base
 *
 * A streaming reporter implementation for Vitest tests.
 * Extends the base StreamingReporter with Vitest-specific behavior.
 */

import { StreamingReporter, type StreamingReporterOptions } from "./streaming.js";

/**
 * Vitest-specific streaming reporter base class
 */
export class VitestStreamingBase extends StreamingReporter {
  constructor(options: StreamingReporterOptions = {}) {
    super(options);
  }

  /**
   * Generate Vitest filter command for re-running a specific test
   * Vitest uses -t or --testNamePattern with regex
   */
  protected getFilterCommand(testName: string, suiteName?: string): string | null {
    // Escape special regex characters in test name
    const escapedName = testName.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
    const filterArg = suiteName
      ? `${suiteName}.*${escapedName}`
      : escapedName;
    return `-- -t '${filterArg}'`;
  }
}

/**
 * PHPUnit Streaming Reporter
 *
 * A streaming reporter implementation for PHPUnit tests.
 * Extends the base StreamingReporter with PHPUnit-specific behavior.
 */

import { StreamingReporter, type StreamingReporterOptions } from "./streaming.js";

/**
 * PHPUnit-specific streaming reporter
 */
export class PHPUnitStreamingReporter extends StreamingReporter {
  constructor(options: StreamingReporterOptions = {}) {
    super(options);
  }

  /**
   * Generate PHPUnit filter command for re-running a specific test
   * PHPUnit uses --filter with ClassName::testName format
   */
  protected getFilterCommand(testName: string, suiteName?: string): string | null {
    const filterArg = suiteName
      ? `${suiteName}::${testName}`
      : testName;
    return `-- --filter '${filterArg}'`;
  }
}

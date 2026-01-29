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
   *
   * The suite stack typically contains:
   *   - ['ActivityPub', 'Activitypub\\Tests\\Test_Class'] for regular tests
   *   - ['ActivityPub', 'Activitypub\\Tests\\Test_Class', 'test_method'] for data providers
   *
   * We need to find the class name (the suite with namespace separators '\\')
   * and use it for the filter: 'Activitypub\\Tests\\Test_Class::testName'
   */
  protected getFilterCommand(testName: string, suiteName?: string, suiteStack?: string[]): string | null {
    // If we have a suite stack, find the class name (contains namespace separator)
    if (suiteStack && suiteStack.length > 0) {
      // Find the last suite that contains a namespace separator (backslash)
      // This is typically the class name
      let className: string | null = null;
      for (let i = suiteStack.length - 1; i >= 0; i--) {
        if (suiteStack[i].includes('\\')) {
          className = suiteStack[i];
          break;
        }
      }

      // If we found a class name, use it
      if (className) {
        // Escape backslashes for shell (single \ becomes \\)
        // This allows users to copy-paste the filter directly
        const filterArg = `${className}::${testName}`.replace(/\\/g, '\\\\');
        return `-- --filter '${filterArg}'`;
      }

      // Otherwise, fall back to using the first suite
      const filterArg = `${suiteStack[0]}::${testName}`.replace(/\\/g, '\\\\');
      return `-- --filter '${filterArg}'`;
    }

    // Fallback to old behavior if no suite stack is available
    const filterArg = suiteName
      ? `${suiteName}::${testName}`
      : testName;
    return `-- --filter '${filterArg.replace(/\\/g, '\\\\')}'`;
  }
}

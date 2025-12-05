/**
 * WordPress Smoke Test Suite
 *
 * Provides environment validation smoke tests for wp-tester.
 */

import type { WPTesterConfig, Tests } from '@wp-tester/config';
import type { Report } from '@wp-tester/results';

/**
 * Select test files based on test configuration
 * @param tests - Test configuration
 * @returns Array of test file paths relative to package root
 * @throws Error if no test files match configuration
 */
export function selectTestFiles(tests: Tests): string[] {
  const files: string[] = [];

  if (tests.wp === true) {
    files.push('tests/wp.spec.ts');
  }

  // Future: add plugin and theme test selection
  // if (tests.plugin) files.push('tests/plugin.spec.ts');
  // if (tests.theme) files.push('tests/theme.spec.ts');

  if (files.length === 0) {
    throw new Error('No test files selected. Check your tests configuration.');
  }

  return files;
}

/**
 * Run WordPress smoke tests
 *
 * @param config - Test configuration
 * @returns CTRF report with test results
 */
export async function runSmokeTests(_config: WPTesterConfig): Promise<Report> {
  // TODO: Implement test runner integration
  // This will be implemented by the test runner package
  throw new Error('runSmokeTests not yet implemented');
}

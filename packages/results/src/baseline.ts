/**
 * Baseline Comparison
 *
 * Compares test results against a saved baseline to detect regressions.
 */

import type { Report, Test } from 'ctrf';
import pc from 'picocolors';

/**
 * Represents a regression found when comparing to baseline
 */
export interface Regression {
  /** Type of regression */
  type: 'new_failure' | 'new_error';
  /** Test that regressed */
  test: Test;
}

/**
 * Represents an improvement found when comparing to baseline
 */
export interface Improvement {
  /** Type of improvement */
  type: 'fixed' | 'removed';
  /** Test that improved */
  test: Test;
}

/**
 * Result of comparing current results to a baseline
 */
export interface ComparisonResult {
  /** Tests that regressed (were passing, now failing) */
  regressions: Regression[];
  /** Tests that improved (were failing, now passing) */
  improvements: Improvement[];
  /** Whether the comparison passed (no regressions) */
  passed: boolean;
}

/**
 * Create a unique key for a test to identify it across runs
 */
function getTestKey(test: Test): string {
  return test.name;
}

/**
 * Compare current test results against a baseline
 *
 * @param current - Current test results
 * @param baseline - Baseline test results to compare against
 * @returns Comparison result with regressions and improvements
 */
export function compareToBaseline(current: Report, baseline: Report): ComparisonResult {
  const regressions: Regression[] = [];
  const improvements: Improvement[] = [];

  // Build maps of test results by key
  const baselineTests = new Map<string, Test>();
  const currentTests = new Map<string, Test>();

  for (const test of baseline.results.tests) {
    baselineTests.set(getTestKey(test), test);
  }

  for (const test of current.results.tests) {
    currentTests.set(getTestKey(test), test);
  }

  // Check for regressions: tests that were passing but now fail
  for (const [key, currentTest] of currentTests) {
    const baselineTest = baselineTests.get(key);

    if (currentTest.status === 'failed') {
      if (!baselineTest) {
        // New test that's failing
        regressions.push({ type: 'new_failure', test: currentTest });
      } else if (baselineTest.status === 'passed') {
        // Was passing, now failing
        regressions.push({ type: 'new_failure', test: currentTest });
      }
      // If it was already failing in baseline, it's not a regression
    }
  }

  // Check for improvements: tests that were failing but now pass
  for (const [key, baselineTest] of baselineTests) {
    const currentTest = currentTests.get(key);

    if (baselineTest.status === 'failed') {
      if (!currentTest) {
        // Test was removed (could be good or bad, treating as removed)
        improvements.push({ type: 'removed', test: baselineTest });
      } else if (currentTest.status === 'passed') {
        // Was failing, now passing
        improvements.push({ type: 'fixed', test: currentTest });
      }
    }
  }

  return {
    regressions,
    improvements,
    passed: regressions.length === 0,
  };
}

/**
 * Print a comparison report to the console
 *
 * @param result - Comparison result to print
 */
export function printComparisonReport(result: ComparisonResult): void {
  console.log('');
  console.log(pc.bold('Baseline Comparison:'));
  console.log('');

  if (result.regressions.length > 0) {
    console.log(pc.red(`  ✗ ${result.regressions.length} regression(s) found:`));
    for (const regression of result.regressions) {
      console.log(pc.red(`    • ${regression.test.name}`));
      if (regression.test.message) {
        console.log(pc.dim(`      ${regression.test.message}`));
      }
    }
    console.log('');
  }

  if (result.improvements.length > 0) {
    console.log(pc.green(`  ✓ ${result.improvements.length} improvement(s):`));
    for (const improvement of result.improvements) {
      const label = improvement.type === 'fixed' ? 'fixed' : 'removed';
      console.log(pc.green(`    • ${improvement.test.name} (${label})`));
    }
    console.log('');
  }

  if (result.regressions.length === 0 && result.improvements.length === 0) {
    console.log(pc.dim('  No changes from baseline'));
    console.log('');
  }

  if (result.passed) {
    console.log(pc.green(pc.bold('  ✓ No regressions detected')));
  } else {
    console.log(pc.red(pc.bold('  ✗ Regressions detected - failing build')));
  }
  console.log('');
}

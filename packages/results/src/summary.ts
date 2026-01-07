/**
 * Test Summary Output
 *
 * Provides formatted test summary output using clack/prompts for consistent CLI display.
 */

import type { Summary } from "ctrf";
import pc from "picocolors";

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
 * Print test summary to console
 *
 * @param summary - The test summary from a CTRF report
 */
export function printSummary(summary: Summary): void {
  const duration = summary.stop - summary.start;

  console.log("");

  if (summary.passed > 0) {
    console.log(pc.green(`  ✓ ${summary.passed} passed`));
  }
  if (summary.failed > 0) {
    console.log(pc.red(`  ✗ ${summary.failed} failed`));
  }
  if (summary.skipped > 0) {
    console.log(pc.yellow(`  ○ ${summary.skipped} skipped`));
  }
  if (summary.pending > 0) {
    console.log(pc.yellow(`  ○ ${summary.pending} pending`));
  }

  console.log("");
  console.log(pc.dim(`  ${summary.tests} tests in ${formatDuration(duration)}`));
  console.log("");
}

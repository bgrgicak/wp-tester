/**
 * Test Summary Output
 *
 * Provides formatted test summary output using clack/prompts for consistent CLI display.
 */

import type { Summary } from "ctrf";
import pc from "picocolors";

/**
 * Options for filtering summary output based on test statuses
 */
export interface SummaryOptions {
  passed?: boolean;
  failed?: boolean;
  skipped?: boolean;
  pending?: boolean;
  other?: boolean;
}

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
 * @param options - Options for filtering which test statuses to show
 */
export function printSummary(summary: Summary, options?: SummaryOptions): void {
  const duration = summary.stop - summary.start;

  // Default to showing all statuses if no options provided
  const showPassed = options?.passed ?? true;
  const showFailed = options?.failed ?? true;
  const showSkipped = options?.skipped ?? true;
  const showPending = options?.pending ?? true;
  const showOther = options?.other ?? true;

  console.log("");

  if (summary.passed > 0 && showPassed) {
    console.log(pc.green(`  ✓ ${summary.passed} passed`));
  }
  // Always show the number of failed tests
  if (showFailed) {
    console.log(pc.red(`  ✗ ${summary.failed} failed`));
  }
  if (summary.skipped > 0 && showSkipped) {
    console.log(pc.yellow(`  ○ ${summary.skipped} skipped`));
  }
  if (summary.pending > 0 && showPending) {
    console.log(pc.yellow(`  ◔ ${summary.pending} pending`));
  }
  if (summary.other > 0 && showOther) {
    console.log(pc.gray(`  ◆ ${summary.other} other`));
  }

  // Display warnings from summary.extra
  const warnings = summary.extra?.warnings;
  if (Array.isArray(warnings) && warnings.length > 0) {
    for (const warning of warnings) {
      console.log(pc.yellow(`  ⚠ ${warning}`));
    }
  }

  console.log("");
  console.log(
    pc.dim(`  ${summary.tests} tests in ${formatDuration(duration)}`)
  );
  console.log("");

  // Build legend based on enabled statuses
  const legendParts: string[] = [];
  if (showPassed) legendParts.push("✓ passed");
  if (showFailed) legendParts.push("✗ failed");
  if (showSkipped) legendParts.push("○ skipped");
  if (showPending) legendParts.push("◔ pending");
  if (showOther) legendParts.push("◆ other");

  if (legendParts.length > 0) {
    console.log(pc.dim(`  Legend: ${legendParts.join("  ")}`));
    console.log("");
  }
}

/**
 * Test Summary Output
 *
 * Provides formatted test summary output using clack/prompts for consistent CLI display.
 */

import type { Summary } from "ctrf";
import pc from "picocolors";
import { formatHint, formatSummaryLine } from "./log-formatting.js";

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
 * Print test summary to console
 *
 * @param summary - The test summary from a CTRF report
 */
export function printSummary(summary: Summary): void {
  const duration = summary.stop - summary.start;

  // Default to showing all statuses if no options provided
  const showPassed = summary.passed > 0;
  const showFailed = true;
  const showSkipped = summary.skipped > 0;
  const showPending = summary.pending > 0;
  const showOther = summary.other > 0;

  console.log("");

  if (showPassed) {
    console.log(pc.green(`  ✓ ${summary.passed} passed`));
  }
  // Always show the number of failed tests
  console.log(pc.red(`  ✗ ${summary.failed} failed`));
  if (showSkipped) {
    console.log(pc.yellow(`  ○ ${summary.skipped} skipped`));
  }
  if (showPending) {
    console.log(pc.yellow(`  ◔ ${summary.pending} pending`));
  }
  if (showOther) {
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
  console.log(formatSummaryLine(summary.tests, duration));
  console.log("");

  // Build legend based on enabled statuses
  const legendParts: string[] = [];
  if (showPassed) legendParts.push("✓ passed");
  if (showFailed) legendParts.push("✗ failed");
  if (showSkipped) legendParts.push("○ skipped");
  if (showPending) legendParts.push("◔ pending");
  if (showOther) legendParts.push("◆ other");

  if (legendParts.length > 0) {
    console.log(formatHint(`Legend: ${legendParts.join("  ")}`));
    console.log("");
  }
}

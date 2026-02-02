/**
 * Log Formatting Utilities
 *
 * Centralized formatting and styling functions for consistent CLI output.
 * Uses picocolors for terminal color support.
 */

import pc from "picocolors";

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Format a dimmed line (used for hints, legends, and other secondary text)
 * The message should include any prefix (e.g., "Hint:", "Legend:")
 */
export function formatHint(message: string): string {
  return pc.dim(`  ${message}`);
}

/**
 * Format test status symbols with colors
 */
export const statusSymbols = {
  passed: pc.green("✓"),
  failed: pc.red("✗"),
  skipped: pc.yellow("○"),
  pending: pc.yellow("◔"),
  other: pc.gray("◆"),
} as const;

/**
 * Format a test status line with count
 */
export function formatStatusLine(
  status: keyof typeof statusSymbols,
  count: number,
  label?: string
): string {
  const symbol = statusSymbols[status];
  const text = label || status;
  const color = status === "passed" ? pc.green : status === "failed" ? pc.red : pc.yellow;
  return color(`  ${symbol} ${count} ${text}`);
}

/**
 * Format a summary line (e.g., "10 tests in 2.5s")
 */
export function formatSummaryLine(testCount: number, duration: number): string {
  return pc.dim(`  ${testCount} tests in ${formatDuration(duration)}`);
}

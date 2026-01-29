/**
 * Filter utilities for test reports
 *
 * Provides functions to filter test reports based on reporter filter options.
 */

import type { Report, Test, TestStatus } from "ctrf";
import type { ReporterFilterOptions } from "./streaming.js";

/**
 * Filters a test report based on the provided filter options.
 * The tests array is filtered to only include tests matching the filter criteria,
 * while the summary counts remain unchanged to reflect the total test results.
 *
 * If no filter options are provided or all filter options are undefined/false,
 * all tests are included (default behavior).
 *
 * @param report - The report to filter
 * @param filterOptions - Filter options specifying which test statuses to include
 * @returns A new report with filtered tests array but unchanged summary
 */
export function filterReport(
  report: Report,
  filterOptions?: ReporterFilterOptions
): Report {
  // If no filter options provided, return the report as-is
  if (!filterOptions) {
    return report;
  }

  // Check if any filter is explicitly enabled
  const hasActiveFilter =
    filterOptions.passed === true ||
    filterOptions.failed === true ||
    filterOptions.skipped === true ||
    filterOptions.pending === true ||
    filterOptions.other === true;

  // If no filters are explicitly enabled, return all tests (default behavior)
  if (!hasActiveFilter) {
    return report;
  }

  // Check if a test status should be included based on filter settings
  const shouldIncludeStatus = (status: TestStatus): boolean => {
    const filterMap: Record<TestStatus, keyof ReporterFilterOptions> = {
      passed: "passed",
      failed: "failed",
      skipped: "skipped",
      pending: "pending",
      other: "other",
    };

    const filterKey = filterMap[status];
    return filterOptions[filterKey] ?? false;
  };

  // Filter tests array based on filter options
  const filteredTests: Test[] = report.results.tests.filter((test) =>
    shouldIncludeStatus(test.status)
  );

  // Return new report with filtered tests but same summary
  return {
    ...report,
    results: {
      ...report.results,
      tests: filteredTests,
    },
  };
}

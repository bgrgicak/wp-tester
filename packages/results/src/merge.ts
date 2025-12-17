import type { Report } from 'ctrf';
import { EMPTY_REPORT } from '.';

export function mergeReports(reports: Report[]): Report {
  if (reports.length === 0) {
    throw new Error('Cannot merge empty array of reports');
  }

  if (reports.length === 1) {
    const original = reports[0];
    return {
      results: {
        summary: { ...original.results.summary },
        tool: { ...original.results.tool },
        tests: [...original.results.tests],
      },
      reportFormat: original.reportFormat,
      specVersion: original.specVersion,
    };
  }

  // Merge multiple reports
  const summary = {
    tests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    pending: 0,
    other: 0,
    start: Infinity,
    stop: -Infinity,
  };

  const allTests: Report['results']['tests'] = [];

  for (const report of reports) {
    // Sum counts
    summary.tests += report.results.summary.tests;
    summary.passed += report.results.summary.passed;
    summary.failed += report.results.summary.failed;
    summary.skipped += report.results.summary.skipped;
    summary.pending += report.results.summary.pending;
    summary.other += report.results.summary.other;

    // Calculate time span
    summary.start = Math.min(summary.start, report.results.summary.start);
    summary.stop = Math.max(summary.stop, report.results.summary.stop);

    // Concatenate tests
    allTests.push(...report.results.tests);
  }

  return {
    ...EMPTY_REPORT,
    results: {
      summary,
      tool: { name: 'wp-tester' },
      tests: allTests,
    },
  };
}

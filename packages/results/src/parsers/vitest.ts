/**
 * Vitest to CTRF Parser
 *
 * Converts Vitest test results to CTRF (Common Test Report Format).
 */

import type { Report, Test } from 'ctrf';
import type { Vitest } from 'vitest/node';

/**
 * Convert Vitest test results to CTRF report format
 *
 * @param vitest - Vitest instance with test results
 * @param toolName - Name of the tool generating the report (default: 'vitest')
 * @returns CTRF Report object
 */
export function vitestToCTRF(vitest: Vitest, toolName: string = 'vitest'): Report {
  const files = vitest.state.getFiles();
  const startTime = Date.now();

  const report: Report = {
    reportFormat: 'CTRF',
    specVersion: '1.0.0',
    results: {
      tool: {
        name: toolName,
      },
      summary: {
        tests: 0,
        passed: 0,
        failed: 0,
        pending: 0,
        skipped: 0,
        other: 0,
        start: startTime,
        stop: startTime,
      },
      tests: [],
    },
  };

  // Process test results
  for (const file of files) {
    for (const task of file.tasks) {
      const testResult: Test = {
        name: task.name,
        status:
          task.result?.state === 'pass'
            ? 'passed'
            : task.result?.state === 'fail'
            ? 'failed'
            : task.result?.state === 'skip'
            ? 'skipped'
            : 'other',
        duration: task.result?.duration || 0,
      };

      if (task.result?.state === 'fail' && task.result.errors) {
        testResult.message = task.result.errors
          .map((e: unknown) => {
            if (e instanceof Error) {
              return e.message;
            }
            try {
              return String(e);
            } catch {
              return 'Unknown error';
            }
          })
          .join('\n');
      }

      report.results.tests.push(testResult);
      report.results.summary.tests++;

      if (task.result?.state === 'pass') {
        report.results.summary.passed++;
      } else if (task.result?.state === 'fail') {
        report.results.summary.failed++;
      } else if (task.result?.state === 'skip') {
        report.results.summary.skipped++;
      } else {
        report.results.summary.other++;
      }
    }
  }

  // Update stop time
  report.results.summary.stop = Date.now();

  return report;
}

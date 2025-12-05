/**
 * WordPress Smoke Test Suite
 *
 * Provides environment validation smoke tests for wp-tester.
 */

import { startVitest } from 'vitest/node';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync } from 'node:fs';
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
export async function runSmokeTests(config: WPTesterConfig): Promise<Report> {
  // Get package root directory
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const packageRoot = join(__dirname, '..');

  // Select test files based on config
  const testFiles = selectTestFiles(config.tests);

  // Prepare CTRF output file path
  const ctrfDir = join(packageRoot, '.ctrf');
  const ctrfOutputFile = join(ctrfDir, 'ctrf-report.json');

  // Ensure .ctrf directory exists
  mkdirSync(ctrfDir, { recursive: true });

  // Start Vitest programmatically
  const vitest = await startVitest(
    'test',
    [],
    {
      config: join(packageRoot, 'vitest.config.ts'),
      root: packageRoot,
      include: testFiles,
      run: true,
      reporters: ['default'],
      provide: {
        config: config
      }
    }
  );

  if (!vitest) {
    throw new Error('Failed to start Vitest');
  }

  // Wait for tests to complete
  await vitest.close();

  // Generate CTRF report from Vitest state
  const state = vitest.state;
  const files = state.getFiles();

  const startTime = Date.now();
  const report: Report = {
    reportFormat: 'CTRF',
    specVersion: '1.0.0',
    results: {
      tool: {
        name: 'wp-tester'
      },
      summary: {
        tests: 0,
        passed: 0,
        failed: 0,
        pending: 0,
        skipped: 0,
        other: 0,
        start: startTime,
        stop: startTime
      },
      tests: []
    }
  };

  // Process test results
  for (const file of files) {
    for (const task of file.tasks) {
      const testResult: Report['results']['tests'][0] = {
        name: task.name,
        status: task.result?.state === 'pass' ? 'passed' :
                task.result?.state === 'fail' ? 'failed' :
                task.result?.state === 'skip' ? 'skipped' : 'other',
        duration: task.result?.duration || 0
      };

      if (task.result?.state === 'fail' && task.result.errors) {
        testResult.message = task.result.errors.map(e => e.message || e.toString()).join('\n');
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

  // Write CTRF report to file
  writeFileSync(ctrfOutputFile, JSON.stringify(report, null, 2), 'utf-8');

  return report;
}

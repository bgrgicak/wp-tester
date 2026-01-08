/**
 * Test Result Reporters
 *
 * Handles output of test results in various formats.
 * Supports console output (default) and JSON file output for CI/comparison.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Report } from 'ctrf';
import { printSummary } from './summary.js';

/**
 * JSON reporter configuration options
 * (Duplicated from @wp-tester/config to avoid circular dependency)
 */
export interface JsonReporterOptions {
  outputFile: string;
}

/**
 * Reporter configuration
 * (Duplicated from @wp-tester/config to avoid circular dependency)
 */
export type Reporter = "default" | ["json", JsonReporterOptions];

/**
 * Default directory for wp-tester results relative to project root
 */
export const RESULTS_DIR = '.wp-tester/results';

/**
 * Default filename for latest test results
 */
export const LATEST_RESULTS_FILE = 'latest.json';

/**
 * Default filename for baseline results
 */
export const BASELINE_FILE = 'baseline.json';

/**
 * Ensure directory exists, creating it recursively if needed
 */
function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Write a CTRF report to a JSON file
 *
 * @param report - The CTRF report to write
 * @param outputPath - Absolute path to the output file
 */
export function writeJsonReport(report: Report, outputPath: string): void {
  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
}

/**
 * Read a CTRF report from a JSON file
 *
 * @param inputPath - Absolute path to the report file
 * @returns The parsed CTRF report, or null if file doesn't exist
 */
export function readJsonReport(inputPath: string): Report | null {
  if (!fs.existsSync(inputPath)) {
    return null;
  }
  const content = fs.readFileSync(inputPath, 'utf-8');
  return JSON.parse(content) as Report;
}

/**
 * Get the default results directory for a project
 *
 * @param projectRoot - Absolute path to the project root
 * @returns Absolute path to the results directory
 */
export function getResultsDir(projectRoot: string): string {
  return path.join(projectRoot, RESULTS_DIR);
}

/**
 * Get the path to the latest results file
 *
 * @param projectRoot - Absolute path to the project root
 * @returns Absolute path to latest.json
 */
export function getLatestResultsPath(projectRoot: string): string {
  return path.join(getResultsDir(projectRoot), LATEST_RESULTS_FILE);
}

/**
 * Get the path to the baseline file
 *
 * @param projectRoot - Absolute path to the project root
 * @returns Absolute path to baseline.json
 */
export function getBaselinePath(projectRoot: string): string {
  return path.join(getResultsDir(projectRoot), BASELINE_FILE);
}

/**
 * Execute all configured reporters
 *
 * @param report - The CTRF report to output
 * @param reporters - Array of reporter configurations
 * @param projectRoot - Absolute path to the project root (for resolving relative paths)
 */
export function runReporters(
  report: Report,
  reporters: Reporter[],
  projectRoot: string
): void {
  for (const reporter of reporters) {
    if (reporter === 'default') {
      // Default reporter: print failed tests and summary to console
      runDefaultReporter(report);
    } else if (Array.isArray(reporter) && reporter[0] === 'json') {
      // JSON reporter: write to file
      const options = reporter[1] as JsonReporterOptions;
      runJsonReporter(report, options, projectRoot);
    }
  }
}

/**
 * Run the default console reporter
 */
function runDefaultReporter(report: Report): void {
  const { summary, tests } = report.results;

  // Print failed test details
  const failedTests = tests.filter(test => test.status === 'failed');
  if (failedTests.length > 0) {
    for (const test of failedTests) {
      if (test.trace) {
        console.error(`\n${test.name}:\n${test.trace}`);
      }
    }
  }

  // Print summary
  printSummary(summary);
}

/**
 * Run the JSON file reporter
 */
function runJsonReporter(
  report: Report,
  options: JsonReporterOptions,
  projectRoot: string
): void {
  const outputPath = path.isAbsolute(options.outputFile)
    ? options.outputFile
    : path.join(projectRoot, options.outputFile);

  writeJsonReport(report, outputPath);
}

/**
 * Save results as the latest run (always happens, regardless of reporters config)
 *
 * @param report - The CTRF report to save
 * @param projectRoot - Absolute path to the project root
 */
export function saveLatestResults(report: Report, projectRoot: string): void {
  const latestPath = getLatestResultsPath(projectRoot);
  writeJsonReport(report, latestPath);
}

/**
 * Save current results as the baseline
 *
 * @param report - The CTRF report to save as baseline
 * @param projectRoot - Absolute path to the project root
 */
export function saveBaseline(report: Report, projectRoot: string): void {
  const baselinePath = getBaselinePath(projectRoot);
  writeJsonReport(report, baselinePath);
}

/**
 * Load the baseline results
 *
 * @param projectRoot - Absolute path to the project root
 * @returns The baseline report, or null if no baseline exists
 */
export function loadBaseline(projectRoot: string): Report | null {
  const baselinePath = getBaselinePath(projectRoot);
  return readJsonReport(baselinePath);
}

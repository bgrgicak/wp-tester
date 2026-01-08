/**
 * Test Result Reporters
 *
 * Handles output of test results in various formats.
 * Supports console output (default) and JSON file output for CI/comparison.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
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
 * Options that define a unique test run signature
 */
export interface TestSignature {
  /** Test type filter (e.g., "wp", "phpunit", "plugin", "theme") */
  testType?: string;
  /** Additional arguments (e.g., PHPUnit args) */
  args?: string[];
}

/**
 * Base directory for wp-tester data in user's home directory
 */
export const WP_TESTER_DIR = '.wp-tester';

/**
 * Subdirectory for test results
 */
export const RESULTS_SUBDIR = 'results';

/**
 * Default filename for latest test results
 */
export const LATEST_RESULTS_FILE = 'latest.json';

/**
 * Default filename for snapshot results
 */
export const SNAPSHOT_FILE = 'snapshot.json';

/**
 * Create a short hash of a string for directory naming
 */
function hashString(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex').substring(0, 12);
}

/**
 * Create a canonical string from test signature for hashing
 */
function buildSignatureString(signature: TestSignature): string {
  const parts: string[] = [];

  // Test type (default to "all")
  parts.push(`type:${signature.testType || 'all'}`);

  // Args (sorted for consistency)
  if (signature.args && signature.args.length > 0) {
    const sortedArgs = [...signature.args].sort();
    parts.push(`args:${sortedArgs.join(',')}`);
  }

  return parts.join('|');
}

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
 * Get the results directory for a project and test signature
 *
 * Results are stored in ~/.wp-tester/results/<project-hash>/<signature-hash>/
 * where:
 * - project-hash is a short hash of the project path
 * - signature-hash is a short hash of the test signature (type + args)
 *
 * @param projectRoot - Absolute path to the project root
 * @param signature - Test signature (test type, args, etc.)
 * @returns Absolute path to the results directory
 */
export function getResultsDir(projectRoot: string, signature: TestSignature = {}): string {
  const projectHash = hashString(projectRoot);
  const signatureString = buildSignatureString(signature);
  const signatureHash = hashString(signatureString);
  return path.join(os.homedir(), WP_TESTER_DIR, RESULTS_SUBDIR, projectHash, signatureHash);
}

/**
 * Get the path to the latest results file
 *
 * @param projectRoot - Absolute path to the project root
 * @param signature - Test signature (test type, args, etc.)
 * @returns Absolute path to latest.json
 */
export function getLatestResultsPath(projectRoot: string, signature: TestSignature = {}): string {
  return path.join(getResultsDir(projectRoot, signature), LATEST_RESULTS_FILE);
}

/**
 * Get the path to the snapshot file
 *
 * @param projectRoot - Absolute path to the project root
 * @param signature - Test signature (test type, args, etc.)
 * @returns Absolute path to snapshot.json
 */
export function getSnapshotPath(projectRoot: string, signature: TestSignature = {}): string {
  return path.join(getResultsDir(projectRoot, signature), SNAPSHOT_FILE);
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
 * @param signature - Test signature (test type, args, etc.)
 */
export function saveLatestResults(report: Report, projectRoot: string, signature: TestSignature = {}): void {
  const latestPath = getLatestResultsPath(projectRoot, signature);
  writeJsonReport(report, latestPath);
}

/**
 * Save current results as the snapshot
 *
 * @param report - The CTRF report to save as snapshot
 * @param projectRoot - Absolute path to the project root
 * @param signature - Test signature (test type, args, etc.)
 */
export function saveSnapshot(report: Report, projectRoot: string, signature: TestSignature = {}): void {
  const snapshotPath = getSnapshotPath(projectRoot, signature);
  writeJsonReport(report, snapshotPath);
}

/**
 * Load the snapshot results
 *
 * @param projectRoot - Absolute path to the project root
 * @param signature - Test signature (test type, args, etc.)
 * @returns The snapshot report, or null if no snapshot exists
 */
export function loadSnapshot(projectRoot: string, signature: TestSignature = {}): Report | null {
  const snapshotPath = getSnapshotPath(projectRoot, signature);
  return readJsonReport(snapshotPath);
}

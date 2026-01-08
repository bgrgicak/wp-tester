/**
 * Test Result Types and Utilities
 *
 * Re-exports CTRF (Common Test Report Format) types from the official ctrf package.
 * See https://ctrf.io for more information about the CTRF standard.
 */

import { Report } from "ctrf";

export type {
  Report,
  Results,
  Summary,
  Test,
  TestStatus,
  Tool,
} from 'ctrf';

export { vitestToCTRF } from './parsers/vitest.js';
export { mergeReports } from './merge.js';
export {
  StreamingReporter,
  stdoutWriter,
  createTestFromEvent,
  type StreamEvent,
  type TestEvent,
  type SuiteEvent,
  type RunEvent,
  type StreamWriter,
  type StreamingReporterOptions,
} from './streaming.js';
export {
  VitestStreamingReporter,
  createVitestStreamingReporter,
} from './vitest-streaming-reporter.js';
export {
  TeamCityParser,
  createTeamCityParserStream,
  parseTeamCityOutput,
} from './teamcity-parser.js';
export { printSummary } from './summary.js';
export {
  writeJsonReport,
  readJsonReport,
  getResultsDir,
  getLatestResultsPath,
  getBaselinePath,
  runReporters,
  saveLatestResults,
  saveBaseline,
  loadBaseline,
  WP_TESTER_DIR,
  RESULTS_SUBDIR,
  LATEST_RESULTS_FILE,
  BASELINE_FILE,
  type Reporter,
  type JsonReporterOptions,
} from './reporters.js';
export {
  compareToBaseline,
  printComparisonReport,
  type ComparisonResult,
  type Regression,
  type Improvement,
} from './baseline.js';

export const EMPTY_REPORT: Report = {
  results: {
    summary: {
      tests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      start: Date.now(),
      stop: Date.now(),
      pending: 0,
      other: 0,
    },
    tool: {
      name: "wp-tester-smoke-tests",
    },
    tests: [],
  },
  reportFormat: "CTRF",
  specVersion: "0.0.4",
};
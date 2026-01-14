/**
 * WordPress Smoke Test Suite
 *
 * Provides environment validation smoke tests for wp-tester.
 */

import { startVitest, type Reporter } from "vitest/node";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { WPTesterConfig, Tests, TestType } from "@wp-tester/config";
import { resolveConfig } from "@wp-tester/config";
import {
  EMPTY_REPORT,
  VitestStreamingReporter,
  StreamingReporter,
} from "@wp-tester/results";
import type { Report } from "@wp-tester/results";

// These values will be replaced during the build process:
// - In src (dev): "src" and "ts"
// - In dist (prod): "dist" and "js"
const TEST_DIR = "src";
const TEST_EXT = "ts";
const CONFIG_FILE = "src/smoke-tests/vitest.config.ts";

export function shouldRunSmokeTests(config: WPTesterConfig): boolean {
  return (
    config.tests.wp === true ||
    config.tests.plugin !== undefined ||
    config.tests.theme !== undefined
  );
}

/**
 * Select test files based on test configuration
 * @param tests - Test configuration
 * @param test - Optional filter to run only specific test type (wp, plugin, or theme)
 * @returns Array of test file paths relative to package root
 * @throws Error if no test files match configuration
 */
export function selectTestFiles(
  tests: Tests,
  test?: TestType | false
): string[] {
  if (test === false) {
    return [];
  }

  const testConfigs: Array<{ type: keyof Tests; path: string }> = [
    { type: "wp", path: `${TEST_DIR}/smoke-tests/wp.spec.${TEST_EXT}` },
    { type: "plugin", path: `${TEST_DIR}/smoke-tests/plugin.spec.${TEST_EXT}` },
    { type: "theme", path: `${TEST_DIR}/smoke-tests/theme.spec.${TEST_EXT}` },
  ];

  const files = testConfigs
    .filter(({ type }) => !test || type === test)
    .filter(({ type }) => tests[type])
    .map(({ path }) => path);

  if (files.length === 0) {
    throw new Error("No test files selected. Check your tests configuration.");
  }

  return files;
}

/**
 * Options for running smoke tests
 */
export interface RunSmokeTestsOptions {
  /** Only display failed tests in output */
  failedOnly?: boolean;
}

/**
 * Run WordPress smoke tests
 *
 * @param config - Test configuration or path to config file
 * @param test - Optional filter to run only specific test type (wp, plugin, or theme)
 * @param options - Additional options for the test run
 * @returns CTRF report with test results
 */
export async function runSmokeTests(
  config: WPTesterConfig | string,
  test?: TestType | false,
  options?: RunSmokeTestsOptions
): Promise<Report> {
  // Resolve config (loads from path if string, resolves paths)
  const resolvedConfig = await resolveConfig(config);

  // Check if any tests are configured
  if (!shouldRunSmokeTests(resolvedConfig)) {
    return Promise.resolve(EMPTY_REPORT);
  }
  // Get package root directory
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const packageRoot = join(__dirname, "..");

  // Select test files based on config and filter
  const testFiles = selectTestFiles(resolvedConfig.tests, test);

  if (testFiles.length === 0) {
    return Promise.resolve(EMPTY_REPORT);
  }

  // Determine if streaming should be enabled (default reporter is configured)
  const useStreaming = resolvedConfig.reporters?.default !== undefined;

  // Get filter options from config or CLI override
  const defaultReporterOptions = resolvedConfig.reporters?.default;
  const filter = options?.failedOnly
    ? { passed: false, failed: true, skipped: false, pending: false, other: false }
    : defaultReporterOptions;

  // Create Vitest streaming reporter with streaming configured
  // Disable summary since the CLI will print a combined summary
  const vitestReporter = new VitestStreamingReporter(
    "wp-tester-smoke-tests",
    new StreamingReporter({ enabled: useStreaming, showSummary: false, filter })
  );
  const reporter = vitestReporter.getStreamingReporter();

  // Build reporters array - use our streaming reporter
  const reporters: Reporter[] = [vitestReporter];

  // Start Vitest programmatically with our streaming reporter
  const vitest = await startVitest("test", [], {
    config: join(packageRoot, CONFIG_FILE),
    root: packageRoot,
    include: testFiles,
    run: true,
    reporters,
    provide: {
      config: resolvedConfig,
    },
  });

  if (!vitest) {
    throw new Error("Failed to start Vitest");
  }

  // Wait for tests to complete
  await vitest.close();

  // Get report from streaming reporter
  const result = reporter.getReport();

  return result;
}

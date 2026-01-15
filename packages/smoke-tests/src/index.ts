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
  VitestStreamingBase,
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
 * Run WordPress smoke tests
 *
 * @param config - Test configuration or path to config file
 * @param test - Optional filter to run only specific test type (wp, plugin, or theme)
 * @param vitestArgs - Additional arguments to pass to Vitest CLI
 * @returns CTRF report with test results
 */
export async function runSmokeTests(
  config: WPTesterConfig | string,
  test?: TestType | false,
  vitestArgs?: string[]
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

  // Determine if streaming should be enabled
  const useStreaming = resolvedConfig.reporters?.includes("default") ?? true;

  // Create Vitest streaming reporter with streaming configured
  // Disable summary since the CLI will print a combined summary
  const streamingBase = new VitestStreamingBase({
    enabled: useStreaming,
    showSummary: false
  });
  const vitestReporter = new VitestStreamingReporter(
    "wp-tester-smoke-tests",
    streamingBase
  );
  const reporter = vitestReporter.getStreamingReporter();

  // Build reporters array - use our streaming reporter
  const reporters: Reporter[] = [vitestReporter];

  // Parse Vitest args to extract test name pattern filter
  let testNamePattern: string | undefined;
  if (vitestArgs && vitestArgs.length > 0) {
    // Look for -t or --testNamePattern flag
    const tIndex = vitestArgs.indexOf('-t');
    const patternIndex = vitestArgs.indexOf('--testNamePattern');

    if (tIndex !== -1 && tIndex + 1 < vitestArgs.length) {
      testNamePattern = vitestArgs[tIndex + 1];
    } else if (patternIndex !== -1 && patternIndex + 1 < vitestArgs.length) {
      testNamePattern = vitestArgs[patternIndex + 1];
    }
  }

  // Start Vitest programmatically with our streaming reporter
  const vitest = await startVitest("test", [], {
    config: join(packageRoot, CONFIG_FILE),
    root: packageRoot,
    include: testFiles,
    run: true,
    reporters,
    testNamePattern,
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

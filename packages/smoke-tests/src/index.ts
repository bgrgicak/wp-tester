/**
 * WordPress Smoke Test Suite
 *
 * Provides environment validation smoke tests for wp-tester.
 */

import { startVitest, parseCLI, type Reporter } from "vitest/node";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { WPTesterConfig, Tests, TestType, ResolvedWPTesterConfig, ResolvedTests } from "@wp-tester/config";
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

export function shouldRunSmokeTests(config: WPTesterConfig | ResolvedWPTesterConfig): boolean {
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
  tests: Tests | ResolvedTests,
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
 * @param config - Resolved test configuration
 * @param test - Optional filter to run only specific test type (wp, plugin, or theme)
 * @param vitestArgs - Additional arguments to pass to Vitest CLI
 * @returns CTRF report with test results
 */
export async function runSmokeTests(
  config: ResolvedWPTesterConfig,
  test?: TestType | false,
  vitestArgs?: string[]
): Promise<Report> {
  // Check if any tests are configured
  if (!shouldRunSmokeTests(config)) {
    return Promise.resolve(EMPTY_REPORT);
  }
  // Get package root directory
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const packageRoot = join(__dirname, "..");

  // Select test files based on config and filter
  const testFiles = selectTestFiles(config.tests, test);

  if (testFiles.length === 0) {
    return Promise.resolve(EMPTY_REPORT);
  }

  // Determine if streaming should be enabled (default reporter is configured)
  const useStreaming = config.reporters?.default !== undefined;

  // Get filter options from config reporters (only if it's an object, not boolean)
  const filter = typeof config.reporters?.default === 'object'
    ? config.reporters.default
    : undefined;

  // Create Vitest streaming reporter with streaming configured
  // Disable summary since the CLI will print a combined summary
  const streamingBase = new VitestStreamingBase({
    enabled: useStreaming,
    showSummary: false,
    filter
  });
  const vitestReporter = new VitestStreamingReporter(
    "wp-tester-smoke-tests",
    streamingBase
  );
  const reporter = vitestReporter.getStreamingReporter();

  // Build reporters array - use our streaming reporter
  const reporters: Reporter[] = [vitestReporter];

  // Parse all Vitest CLI arguments using Vitest's built-in parser
  // parseCLI expects "vitest" as the first argument (like process.argv)
  const parsedArgs = vitestArgs && vitestArgs.length > 0
    ? parseCLI(["vitest", ...vitestArgs], { allowUnknownOptions: true })
    : { options: {}, filter: [] };

  // Start Vitest programmatically with our streaming reporter
  // Merge parsed CLI options with our required overrides
  const vitest = await startVitest("test", parsedArgs.filter, {
    config: join(packageRoot, CONFIG_FILE),
    root: packageRoot,
    include: testFiles,
    run: true,
    reporters,
    provide: {
      config,
    },
    // Spread parsed CLI options - these will override defaults but be overridden by explicit options above
    ...parsedArgs.options,
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

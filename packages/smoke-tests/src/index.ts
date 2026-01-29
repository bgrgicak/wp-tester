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
  type StreamingReporter,
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
 * Options for running smoke tests
 */
export interface RunSmokeTestsOptions {
  /** Optional filter to run only specific test type (wp, plugin, or theme) */
  test?: TestType | false;
  /** Additional arguments to pass to Vitest CLI */
  vitestArgs?: string[];
  /** Shared streaming reporter for unified output across test suites */
  sharedReporter?: StreamingReporter;
}

/**
 * Run WordPress smoke tests
 *
 * @param config - Resolved test configuration
 * @param testOrOptions - Optional filter to run only specific test type, or options object
 * @param vitestArgs - Additional arguments to pass to Vitest CLI (deprecated, use options object)
 * @returns CTRF report with test results
 */
export async function runSmokeTests(
  config: ResolvedWPTesterConfig,
  testOrOptions?: TestType | false | RunSmokeTestsOptions,
  vitestArgs?: string[]
): Promise<Report> {
  // Support both old signature (test, vitestArgs) and new signature (options object)
  let test: TestType | false | undefined;
  let extraArgs: string[] | undefined;
  let sharedReporter: StreamingReporter | undefined;

  // Check if testOrOptions is an options object (has specific properties, not a string/boolean)
  if (testOrOptions !== undefined &&
      testOrOptions !== null &&
      typeof testOrOptions === 'object' &&
      !Array.isArray(testOrOptions)) {
    // New signature: options object
    test = testOrOptions.test;
    extraArgs = testOrOptions.vitestArgs;
    sharedReporter = testOrOptions.sharedReporter;
  } else if (typeof testOrOptions === 'string' || testOrOptions === false || testOrOptions === undefined) {
    // Old signature: test type and vitestArgs
    test = testOrOptions;
    extraArgs = vitestArgs;
  }
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

  // Use shared reporter if provided, otherwise create a new one
  // When using shared reporter, the summary is handled by the unified reporter
  let reporter: StreamingReporter;
  if (sharedReporter) {
    reporter = sharedReporter;
  } else {
    reporter = new VitestStreamingBase({
      enabled: useStreaming,
      showSummary: false,
      filter
    });
  }

  // Create Vitest streaming reporter wrapper
  const vitestReporter = new VitestStreamingReporter(
    "wp-tester-smoke-tests",
    reporter
  );

  // Build reporters array - use our streaming reporter
  const reporters: Reporter[] = [vitestReporter];

  // Parse all Vitest CLI arguments using Vitest's built-in parser
  // parseCLI expects "vitest" as the first argument (like process.argv)
  const parsedArgs = extraArgs && extraArgs.length > 0
    ? parseCLI(["vitest", ...extraArgs], { allowUnknownOptions: true })
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

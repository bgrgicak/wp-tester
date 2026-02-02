import { access, constants, stat, writeFile } from 'fs/promises';
import path from 'path';
import * as clack from '../../cli/theme';
import { runSmokeTests } from "@wp-tester/smoke-tests";
import { runPhpunitTests } from "@wp-tester/phpunit";
import {
  mergeReports,
  printSummary,
  formatHint,
  type Report,
} from "@wp-tester/results";
import type { TestType, ResolvedWPTesterConfig } from "@wp-tester/config";
import { resolveConfig } from "@wp-tester/config";
import { validateConfig } from "../config/validate";
import { getConfigPath } from "@wp-tester/config";

/**
 * Options for the test runner
 */
export interface RunTestsOptions {
  /** Type of test to run (phpunit, wp, plugin, theme) */
  testType?: TestType;
  /** Additional arguments to pass to test runners */
  extraArgs?: string[];
  /** Allow the test suite to pass when no tests are executed (CLI override) */
  passWithNoTests?: boolean;
  /** Display all test results, not just failed tests (CLI override) */
  verbose?: boolean;
}

/**
 * Check if user has explicitly configured filter options in their config.
 * Returns true if any of the filter options (passed, failed, skipped, pending, other)
 * are explicitly set.
 */
function hasUserFilterConfig(config: ResolvedWPTesterConfig): boolean {
  const defaultReporter = config.reporters?.default;
  if (!defaultReporter || typeof defaultReporter !== "object") {
    return false;
  }

  // Check if any filter option is explicitly set
  return (
    defaultReporter.passed !== undefined ||
    defaultReporter.failed !== undefined ||
    defaultReporter.skipped !== undefined ||
    defaultReporter.pending !== undefined ||
    defaultReporter.other !== undefined
  );
}

/**
 * Apply filter options to config reporters based on CLI flags and user config.
 * Priority: user config > verbose flag > default (failed only)
 */
function applyFilterOverride(
  config: ResolvedWPTesterConfig,
  verbose?: boolean
): ResolvedWPTesterConfig {
  // If default reporter is not enabled, don't apply any filter
  // This happens when user only configures JSON reporter without default reporter
  if (config.reporters?.default === undefined) {
    return config;
  }

  // If user has explicit filter config, don't override
  if (hasUserFilterConfig(config)) {
    return config;
  }

  // Determine filter based on verbose flag
  const filter = verbose
    ? {
        passed: true,
        failed: true,
        skipped: true,
        pending: true,
        other: true,
      }
    : {
        passed: false,
        failed: true,
        skipped: false,
        pending: false,
        other: false,
      };

  return {
    ...config,
    reporters: {
      ...config.reporters,
      default:
        typeof config.reporters.default === "object"
          ? { ...config.reporters.default, ...filter }
          : filter,
    },
  };
}

async function resolveConfigPath(configPath: string): Promise<string> {
  const resolvedPath = getConfigPath(configPath);

  try {
    const stats = await stat(resolvedPath);

    if (stats.isDirectory()) {
      return path.join(resolvedPath, "wp-tester.json");
    }
  } catch {
    // File doesn't exist yet, but that's ok - return the resolved path
    // The caller will handle the missing file case
  }

  return resolvedPath;
}

async function checkConfigExists(configPath: string): Promise<boolean> {
  try {
    const resolvedPath = getConfigPath(configPath);
    await access(resolvedPath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Determines if the given test type is a smoke test type.
 * Returns the test type if it's a smoke test, undefined if no filter needed, or false if it should be skipped.
 */
function getSmokeTestFilter(testType?: TestType): TestType | undefined | false {
  const smokeTestTypes: TestType[] = ["wp", "plugin", "theme"];

  if (!testType) {
    return undefined; // Run all smoke tests
  }

  return smokeTestTypes.includes(testType) ? testType : false;
}

export interface TestResult {
  success: boolean;
  hasTests: boolean;
}

/**
 * Execute tests and return results without exiting the process.
 * Used internally and by watch mode.
 */
export const executeTests = async (
  configPath: string,
  options?: RunTestsOptions,
): Promise<TestResult> => {
  const { testType, extraArgs, verbose } = options || {};
  const finalConfigPath = await resolveConfigPath(configPath);

  // Validate configuration before running tests
  const isValid = await validateConfig(finalConfigPath);
  if (!isValid) {
    process.exit(1);
  }

  // Resolve config and apply CLI overrides
  let resolvedConfig = await resolveConfig(finalConfigPath);
  // Apply filter override (respects user config, uses verbose flag, or defaults to failed-only)
  resolvedConfig = applyFilterOverride(resolvedConfig, verbose);

  // Run all test suites and collect results
  const reports: Report[] = [];

  // Determine which tests to run based on testType parameter
  const shouldRunPhpUnit = !testType || testType === "phpunit";

  // Run smoke tests (wp, plugin, theme) - smoke tests package handles whether to run
  const smokeTestFilter = getSmokeTestFilter(testType);
  if (smokeTestFilter !== false) {
    const smokeTestReport = await runSmokeTests(
      resolvedConfig,
      smokeTestFilter,
      extraArgs,
    );
    // Check if tests actually ran by verifying time elapsed (stop > start)
    // EMPTY_REPORT has start === stop, real test runs have stop > start
    const testsRan =
      smokeTestReport.results.summary.stop >
      smokeTestReport.results.summary.start;
    if (testsRan) {
      reports.push(smokeTestReport);
    }
  }

  // Run PHPUnit tests
  if (shouldRunPhpUnit) {
    const phpunitReport = await runPhpunitTests(resolvedConfig, extraArgs);
    // Check if tests actually ran by verifying time elapsed
    const testsRan =
      phpunitReport.results.summary.stop > phpunitReport.results.summary.start;
    if (testsRan) {
      reports.push(phpunitReport);
    }
  }

  // No tests were run
  if (reports.length === 0) {
    clack.log.error("No tests were run. Check your configuration.");
    return { success: false, hasTests: false };
  }

  // Merge results from all test suites
  const mergedReport = mergeReports(reports);

  // Write JSON report if configured
  const jsonReporter = resolvedConfig.reporters?.json;
  if (jsonReporter) {
    await writeFile(
      jsonReporter.outputFile,
      JSON.stringify(mergedReport, null, 2),
    );
  }

  // Display unified summary
  const { summary } = mergedReport.results;
  const success = summary.failed === 0;

  printSummary(summary);

  // Show hint about verbose mode if not already enabled
  if (!verbose) {
    console.log(formatHint("Hint: Use --verbose to see the output of all tests"));
  }

  return { success, hasTests: true };
};

export const runTests = async (
  configPath: string,
  options?: RunTestsOptions
): Promise<void> => {
  const { passWithNoTests } = options || {};
  let finalConfigPath = await resolveConfigPath(configPath);

  // Check if config file exists
  while (!(await checkConfigExists(finalConfigPath))) {
    const resolvedPath = getConfigPath(finalConfigPath);
    clack.log.error(`Config file not found: ${resolvedPath}`);

    // In non-interactive environments (like CI), exit immediately with error
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      process.exit(1);
    }

    const newPath = await clack.text({
      message: "Enter the correct path to your config file:",
      placeholder: "./wp-tester.json",
      validate: (value) => {
        if (!value) return "Config path is required";
      },
    });

    if (clack.isCancel(newPath)) {
      clack.cancel("Test cancelled.");
      process.exit(0);
    }

    finalConfigPath = newPath;
  }

  const result = await executeTests(finalConfigPath, options);

  if (!result.hasTests) {
    // If passWithNoTests is enabled, treat no tests as success
    if (passWithNoTests) {
      clack.log.info("No tests were run. Check your configuration.");
      process.exit(0);
    }
    process.exit(1);
  }

  // Determine exit code based on test results
  if (!result.success) {
    process.exit(1);
  }

  process.exit(0);
};

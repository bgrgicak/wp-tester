import { access, constants, stat, writeFile } from 'fs/promises';
import path from 'path';
import * as clack from '../../cli/theme';
import { runSmokeTests } from "@wp-tester/smoke-tests";
import { runPhpunitTests } from "@wp-tester/phpunit";
import { mergeReports, printSummary, filterReport, type Report } from "@wp-tester/results";
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
  /** Only display failed tests in output (CLI override) */
  failedOnly?: boolean;
}

/**
 * Apply --failed-only CLI override to config reporters.
 * Sets all filter options to false except failed: true.
 */
function applyFailedOnlyOverride(
  config: ResolvedWPTesterConfig
): ResolvedWPTesterConfig {
  const failedOnlyFilter = {
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
        config.reporters?.default !== undefined
          ? typeof config.reporters.default === "object"
            ? { ...config.reporters.default, ...failedOnlyFilter }
            : failedOnlyFilter
          : failedOnlyFilter,
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
  options?: RunTestsOptions
): Promise<TestResult> => {
  const { testType, extraArgs, failedOnly } = options || {};
  const finalConfigPath = await resolveConfigPath(configPath);

  // Validate configuration before running tests
  const isValid = await validateConfig(finalConfigPath);
  if (!isValid) {
    process.exit(1);
  }

  // Resolve config and apply CLI overrides
  let resolvedConfig = await resolveConfig(finalConfigPath);
  if (failedOnly) {
    resolvedConfig = applyFailedOnlyOverride(resolvedConfig);
  }

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
    // Apply JSON reporter filter options to the report
    const filteredReport = filterReport(mergedReport, jsonReporter);
    await writeFile(
      jsonReporter.outputFile,
      JSON.stringify(filteredReport, null, 2),
    );
  }

  // Display unified summary
  const { summary } = mergedReport.results;
  const success = summary.failed === 0;


  printSummary(summary);

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

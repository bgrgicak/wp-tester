import { access, constants, stat, writeFile } from 'fs/promises';
import path from 'path';
import * as clack from '../../cli/theme';
import { runSmokeTests } from "@wp-tester/smoke-tests";
import { runPhpunitTests } from "@wp-tester/phpunit";
import { mergeReports, printSummary, type Report } from "@wp-tester/results";
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
      extraArgs
    );
    if (smokeTestReport.results.summary.tests > 0) {
      reports.push(smokeTestReport);
    }
  }

  // Run PHPUnit tests
  if (shouldRunPhpUnit) {
    const phpunitReport = await runPhpunitTests(resolvedConfig, extraArgs);
    // Always include report if PHPUnit was configured to run
    // This ensures bootstrap failures are visible
    if (phpunitReport.results.summary.tests > 0) {
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
    await writeFile(jsonReporter.outputFile, JSON.stringify(mergedReport, null, 2));
  }

  // Display unified summary
  const { summary } = mergedReport.results;
  const success = summary.failed === 0;

  // Print final combined summary with default reporter options
  const defaultReporterOptions = resolvedConfig.reporters?.default;

  // Convert reporter options to summary options (handle boolean shorthand)
  // When false or true (boolean shorthand), pass undefined to use printSummary defaults
  // When an object, pass it directly since SummaryOptions now matches BaseReporterOptions
  const summaryOptions =
    typeof defaultReporterOptions === "object"
      ? defaultReporterOptions
      : undefined;

  printSummary(summary, summaryOptions);

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

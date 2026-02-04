import { access, constants, stat, writeFile } from 'fs/promises';
import path from 'path';
import * as clack from '../../cli/theme';
import { runSmokeTests } from "@wp-tester/smoke-tests";
import { runPhpunitTests } from "@wp-tester/phpunit";
import { printSummary, UnifiedStreamingReporter, formatHint } from "@wp-tester/results";
import type { TestType, ResolvedWPTesterConfig } from "@wp-tester/config";
import { resolveConfig } from "@wp-tester/config";
import { validateConfig } from "../config/validate";
import { getConfigPath } from "@wp-tester/config";

/**
 * Options for the test runner
 */
export interface RunTestsOptions {
  /** Type of test to run (smoke or phpunit) */
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
 * Determines if smoke tests should run based on test type.
 * Returns true if smoke tests should run, false otherwise.
 */
function shouldRunSmokeTests(testType?: TestType): boolean {
  return !testType || testType === "smoke";
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

  // Determine which tests to run based on testType parameter
  const runPhpUnit = !testType || testType === "phpunit";
  const runSmoke = shouldRunSmokeTests(testType);

  // Get streaming configuration
  // Default to true if not explicitly disabled (was causing regression where no output showed)
  const useStreaming = resolvedConfig.reporters?.default !== false;
  const filter = typeof resolvedConfig.reporters?.default === 'object'
    ? resolvedConfig.reporters.default
    : undefined;

  // Create unified streaming reporter for all test suites
  const unifiedReporter = new UnifiedStreamingReporter({
    enabled: useStreaming,
    showSummary: false,
    filter,
  });

  // Start the unified test run
  unifiedReporter.startUnifiedRun();

  try {
    // Run smoke tests
    if (runSmoke) {
      unifiedReporter.setStatus("Running smoke tests");
      await runSmokeTests(resolvedConfig, extraArgs, unifiedReporter);
    }

    // Run PHPUnit tests
    if (runPhpUnit) {
      unifiedReporter.setStatus("Running PHPUnit tests");
      await runPhpunitTests(resolvedConfig, extraArgs, unifiedReporter);
    }
  } finally {
    // End the unified test run (stops spinner, shows final output)
    unifiedReporter.endUnifiedRun();
  }

  // Get the final report from the unified reporter
  const mergedReport = unifiedReporter.getReport();
  if (mergedReport.results.summary.tests === 0) {
    clack.log.error("No tests were run. Check your configuration.");
    return { success: false, hasTests: false };
  }

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

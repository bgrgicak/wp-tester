import { access, constants, stat } from 'fs/promises';
import path from 'path';
import * as clack from '../../cli/theme';
import { runSmokeTests } from "@wp-tester/smoke-tests";
import { runPhpunitTests } from "@wp-tester/phpunit";
import {
  mergeReports,
  runReporters,
  saveLatestResults,
  saveSnapshot,
  loadSnapshot,
  compareToSnapshot,
  printComparisonReport,
  type Report,
  type TestSignature,
} from "@wp-tester/results";
import { resolveConfig, type TestType } from "@wp-tester/config";

export interface RegressionOptions {
  regression?: boolean;
  clear?: boolean;
}

async function resolveConfigPath(configPath: string): Promise<string> {
  const resolvedPath = path.resolve(process.cwd(), configPath);

  try {
    const stats = await stat(resolvedPath);

    if (stats.isDirectory()) {
      const configFile = path.join(resolvedPath, "wp-tester.json");

      try {
        await access(configFile, constants.F_OK);
        return configFile;
      } catch {
        clack.log.error(`Config file not found in directory: ${resolvedPath}`);
        clack.log.error(
          "Please provide a path to a valid WP Tester config file."
        );
        process.exit(1);
      }
    }
  } catch {
    clack.log.error(`Path not found: ${resolvedPath}`);
    clack.log.error("Please provide a path to a valid WP Tester config file.");
    process.exit(1);
  }

  return resolvedPath;
}

async function checkConfigExists(configPath: string): Promise<boolean> {
  try {
    const resolvedPath = path.resolve(process.cwd(), configPath);
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

export const runTests = async (
  configPath: string,
  testType?: TestType,
  phpunitArgs?: string[],
  options: RegressionOptions = {}
): Promise<void> => {
  let finalConfigPath = await resolveConfigPath(configPath);

  // Check if config file exists
  while (!(await checkConfigExists(finalConfigPath))) {
    const resolvedPath = path.resolve(process.cwd(), finalConfigPath);
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

  const absoluteConfigPath = path.resolve(process.cwd(), finalConfigPath);

  // Resolve config to get reporters and project root
  const resolvedConfig = await resolveConfig(absoluteConfigPath);

  // Run all test suites and collect results
  const reports: Report[] = [];

  // Determine which tests to run based on testType parameter
  const shouldRunPhpUnit = !testType || testType === "phpunit";

  // Run smoke tests (wp, plugin, theme) - smoke tests package handles whether to run
  const smokeTestFilter = getSmokeTestFilter(testType);
  const smokeTestReport = await runSmokeTests(
    absoluteConfigPath,
    smokeTestFilter
  );
  if (smokeTestReport.results.summary.tests > 0) {
    reports.push(smokeTestReport);
  }

  // Run PHPUnit tests
  if (shouldRunPhpUnit) {
    const phpunitReport = await runPhpunitTests(absoluteConfigPath, phpunitArgs);
    // Always include report if PHPUnit was configured to run
    // This ensures bootstrap failures are visible
    if (phpunitReport.results.summary.tests > 0) {
      reports.push(phpunitReport);
    }
  }

  // Merge all reports
  if (reports.length === 0) {
    clack.log.error("No tests were run. Check your configuration.");
    process.exit(1);
  }

  // Merge results from all test suites
  const mergedReport = mergeReports(reports);

  // Build test signature for unique baseline identification
  const testSignature: TestSignature = {
    testType,
    args: phpunitArgs,
  };

  // Save results to ~/.wp-tester/results/<project>/<signature>/latest.json
  saveLatestResults(mergedReport, resolvedConfig.projectHostPath, testSignature);

  // Run configured reporters (default prints to console, json writes to file)
  runReporters(mergedReport, resolvedConfig.reporters, resolvedConfig.projectHostPath);

  const { regression, clear } = options;

  // --clear requires --regression
  if (clear && !regression) {
    clack.log.error('--clear requires --regression');
    process.exit(1);
  }

  // Handle --regression: compare against snapshot (auto-capture if none exists)
  if (regression) {
    // If --clear, always capture new snapshot
    if (clear) {
      saveSnapshot(mergedReport, resolvedConfig.projectHostPath, testSignature);
      clack.log.success('Snapshot cleared and updated with current results.');
      process.exit(0);
    }

    const snapshot = loadSnapshot(resolvedConfig.projectHostPath, testSignature);

    if (!snapshot) {
      // No snapshot exists - capture one automatically
      saveSnapshot(mergedReport, resolvedConfig.projectHostPath, testSignature);
      clack.log.info('No snapshot found. Current results saved as snapshot.');
      process.exit(0);
    }

    const comparison = compareToSnapshot(mergedReport, snapshot);
    printComparisonReport(comparison);

    // Exit based on regression status (ignore regular test failures)
    process.exit(comparison.passed ? 0 : 1);
  }

  // Normal mode: exit based on test results
  const success = mergedReport.results.summary.failed === 0;
  process.exit(success ? 0 : 1);
};

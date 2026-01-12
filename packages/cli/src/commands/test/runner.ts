import { access, constants, stat } from 'fs/promises';
import path from 'path';
import * as clack from '../../cli/theme';
import { runSmokeTests } from "@wp-tester/smoke-tests";
import { runPhpunitTests } from "@wp-tester/phpunit";
import { mergeReports, printSummary, type Report } from "@wp-tester/results";
import { resolveConfig, type TestType } from "@wp-tester/config";
import { setupHandler } from "../setup";

/**
 * Options for the test runner
 */
export interface RunTestsOptions {
  /** Allow the test suite to pass when no tests are executed (CLI override) */
  passWithNoTests?: boolean;
}

/**
 * Prompt the user to run setup when no configuration file is found.
 * Returns the path to the config file after setup, or exits if the user cancels.
 */
async function promptSetupOnMissingConfig(): Promise<string> {
  clack.log.error("No configuration found. Run `wp-tester setup` to create one.");

  const runSetup = await clack.confirm({
    message: "Would you like to run setup now?",
  });

  if (clack.isCancel(runSetup) || !runSetup) {
    clack.cancel("Test cancelled.");
    process.exit(0);
  }

  await setupHandler();

  return path.resolve(process.cwd(), "wp-tester.json");
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
        return promptSetupOnMissingConfig();
      }
    }
  } catch {
    return promptSetupOnMissingConfig();
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
  options?: RunTestsOptions
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

  // Load config to check for passWithNoTests setting
  const config = await resolveConfig(absoluteConfigPath);
  // CLI option takes precedence, then config option, default is false
  const passWithNoTests = options?.passWithNoTests ?? config.tests.passWithNoTests ?? false;

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
    // Include report if it has tests OR if it has warnings (for "no tests executed" scenarios)
    const hasWarning = phpunitReport.results.extra?.warning !== undefined;
    if (phpunitReport.results.summary.tests > 0 || hasWarning) {
      reports.push(phpunitReport);
    }
  }

  // Collect warnings from all reports before merging
  const warnings: string[] = [];
  for (const report of reports) {
    const warning = report.results.extra?.warning;
    if (typeof warning === 'string') {
      warnings.push(warning);
    }
  }

  // Merge all reports
  if (reports.length === 0) {
    clack.log.error("No tests were run. Check your configuration.");
    process.exit(1);
  }

  // Merge results from all test suites
  const mergedReport = mergeReports(reports);

  // Display unified summary
  const { summary, tests } = mergedReport.results;

  // Print failed test details
  const failedTests = tests.filter(test => test.status === 'failed');
  if (failedTests.length > 0) {
    for (const test of failedTests) {
      if (test.trace) {
        console.error(`\n${test.name}:\n${test.trace}`);
      }
    }
  }

  // Print final combined summary with any warnings
  printSummary(summary, { warnings });

  // Determine exit code
  // - Failed tests always cause exit code 1
  // - Warnings (like "no tests executed") cause exit code 1 by default
  // - Use --passWithNoTests or config tests.passWithNoTests to allow warnings to pass
  const hasFailures = summary.failed > 0;
  const hasWarnings = warnings.length > 0;

  if (hasFailures) {
    process.exit(1);
  }

  if (hasWarnings && !passWithNoTests) {
    clack.log.warn("No tests were executed. Use --passWithNoTests to allow this to pass.");
    process.exit(1);
  }

  process.exit(0);
};

import { access, constants, stat } from 'fs/promises';
import path from 'path';
import * as clack from '../../cli/theme';
import { runSmokeTests } from "@wp-tester/smoke-tests";
import { runPhpunitTests } from "@wp-tester/phpunit";
import { mergeReports, printSummary, type Report } from "@wp-tester/results";
import type { TestType } from "@wp-tester/config";
import { validateConfig } from '../config/validate';
import { setupHandler } from "../setup";

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
  testType?: TestType,
  phpunitArgs?: string[]
): Promise<TestResult> => {
  const absoluteConfigPath = path.resolve(process.cwd(), configPath);

  // Validate configuration before running tests
  const isValid = await validateConfig(absoluteConfigPath);
  if (!isValid) {
    process.exit(1);
  }

  // Run all test suites and collect results
  const reports: Report[] = [];

  // Determine which tests to run based on testType parameter
  const shouldRunPhpUnit = !testType || testType === "phpunit";

  // Run smoke tests (wp, plugin, theme) - smoke tests package handles whether to run
  const smokeTestFilter = getSmokeTestFilter(testType);
  if (smokeTestFilter !== false) {
    const smokeTestReport = await runSmokeTests(
      absoluteConfigPath,
      smokeTestFilter
    );
    if (smokeTestReport.results.summary.tests > 0) {
      reports.push(smokeTestReport);
    }
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

  // No tests were run
  if (reports.length === 0) {
    clack.log.error("No tests were run. Check your configuration.");
    return { success: false, hasTests: false };
  }

  // Merge results from all test suites
  const mergedReport = mergeReports(reports);

  // Display unified summary
  const { summary, tests } = mergedReport.results;
  const success = summary.failed === 0;

  // Print failed test details
  const failedTests = tests.filter(test => test.status === 'failed');
  if (failedTests.length > 0) {
    for (const test of failedTests) {
      if (test.trace) {
        console.error(`\n${test.name}:\n${test.trace}`);
      }
    }
  }

  // Print final combined summary
  printSummary(summary);

  return { success, hasTests: true };
};

export const runTests = async (
  configPath: string,
  testType?: TestType,
  phpunitArgs?: string[]
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

  const result = await executeTests(finalConfigPath, testType, phpunitArgs);

  if (!result.hasTests) {
    process.exit(1);
  }

  process.exit(result.success ? 0 : 1);
};

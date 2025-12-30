import { access, constants, stat } from 'fs/promises';
import path from 'path';
import * as clack from '../../cli/theme';
import { runSmokeTests } from "@wp-tester/smoke-tests";
import { runPhpunitTests } from "@wp-tester/phpunit";
import { mergeReports, type Report } from "@wp-tester/results";
import type { TestType, WPTesterConfig } from "@wp-tester/config";
import { mergePhpunitArgs } from "@wp-tester/config";

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

  const absoluteConfigPath = path.resolve(process.cwd(), finalConfigPath);

  // Load and merge config with CLI args
  let configForTests: string | WPTesterConfig = absoluteConfigPath;
  if (phpunitArgs && phpunitArgs.length > 0) {
    configForTests = await mergePhpunitArgs(absoluteConfigPath, phpunitArgs);
  }

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
    const phpunitReport = await runPhpunitTests(configForTests);
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

  // Display results using CTRF format
  const { summary } = mergedReport.results;
  const duration = summary.stop - summary.start;
  const success = summary.failed === 0;

  if (success) {
    clack.log.success(
      `All tests passed! ${summary.passed}/${summary.tests} tests passed in ${duration}ms`
    );
    process.exit(0);
  } else {
    clack.log.error(
      `Tests failed: ${summary.failed}/${summary.tests} tests failed`
    );
    process.exit(1);
  }
};

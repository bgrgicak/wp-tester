import { access, constants, stat } from 'fs/promises';
import path from 'path';
import * as clack from '../../cli/theme';
import { runSmokeTests, shouldRunSmokeTests } from "@wp-tester/smoke-tests";
import { runPhpUnitTests } from "@wp-tester/phpunit";
import type { Report } from "@wp-tester/results";
import type { TestType } from "@wp-tester/config";

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

export const runTests = async (
  configPath: string,
  testType?: TestType
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

  // Run all test suites and collect results
  const reports: Report[] = [];

  // Determine which tests to run based on testType parameter
  const shouldRunPhpUnit = !testType || testType === "phpunit";

  // Run smoke tests (wp, plugin, theme) - smoke tests package handles whether to run
  const smokeTestFilter = testType && ["wp", "plugin", "theme"].includes(testType)
    ? testType
    : undefined;
  const smokeTestReport = await runSmokeTests(absoluteConfigPath, smokeTestFilter);
  if (smokeTestReport.results.summary.tests > 0) {
    reports.push(smokeTestReport);
  }

  // Run PHPUnit tests
  if (shouldRunPhpUnit) {
    const phpunitReport = await runPhpUnitTests(absoluteConfigPath);
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
  const mergedReport = reports[0];
  for (let i = 1; i < reports.length; i++) {
    const current = reports[i];
    mergedReport.results.summary.tests += current.results.summary.tests;
    mergedReport.results.summary.passed += current.results.summary.passed;
    mergedReport.results.summary.failed += current.results.summary.failed;
    mergedReport.results.summary.skipped += current.results.summary.skipped;
    mergedReport.results.summary.pending += current.results.summary.pending;
    mergedReport.results.summary.other += current.results.summary.other;
    mergedReport.results.tests.push(...current.results.tests);
  }

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

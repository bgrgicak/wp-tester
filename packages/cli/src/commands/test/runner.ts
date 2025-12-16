import { access, constants, stat } from 'fs/promises';
import path from 'path';
import * as clack from '../../cli/theme';
import { runSmokeTests } from "@wp-tester/smoke-tests";

async function resolveConfigPath(configPath: string): Promise<string> {
  const resolvedPath = path.resolve(process.cwd(), configPath);

  try {
    const stats = await stat(resolvedPath);

    if (stats.isDirectory()) {
      const configFile = path.join(resolvedPath, 'wp-tester.json');

      try {
        await access(configFile, constants.F_OK);
        return configFile;
      } catch {
        clack.log.error(`Config file not found in directory: ${resolvedPath}`);
        clack.log.error('Please provide a path to a valid WP Tester config file.');
        process.exit(1);
      }
    }
  } catch {
    clack.log.error(`Path not found: ${resolvedPath}`);
    clack.log.error('Please provide a path to a valid WP Tester config file.');
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

export const runTests = async (configPath: string): Promise<void> => {
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

  // Pass the config path instead of the config object
  // This allows runSmokeTests to resolve relative paths
  const report = await runSmokeTests(absoluteConfigPath);

  // Display results using CTRF format
  const { summary } = report.results;
  const duration = summary.stop - summary.start;
  const success = summary.failed === 0;

  if (success) {
    clack.log.success(
      `All tests passed! ${summary.passed}/${summary.tests} tests passed in ${duration}ms`
    );
  } else {
    clack.log.error(
      `Tests failed: ${summary.failed}/${summary.tests} tests failed`
    );
    process.exit(1);
  }
};

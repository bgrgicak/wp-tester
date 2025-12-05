import { access, constants } from 'fs/promises';
import path from 'path';
import * as clack from '../../cli/theme';
import { readConfigFile, type WPTesterConfig } from '@wp-tester/config';
import { runSmokeTests } from '@wp-tester/smoke-tests';

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
  let finalConfigPath = configPath;

  // Check if config file exists
  while (!(await checkConfigExists(finalConfigPath))) {
    const resolvedPath = path.resolve(process.cwd(), finalConfigPath);
    clack.log.error(`Config file not found: ${resolvedPath}`);

    const newPath = await clack.text({
      message: 'Enter the correct path to your config file:',
      placeholder: './wp-tester.json',
      validate: (value) => {
        if (!value) return 'Config path is required';
      },
    });

    if (clack.isCancel(newPath)) {
      clack.cancel('Test cancelled.');
      process.exit(0);
    }

    finalConfigPath = newPath;
  }

  // Load config
  const config = await readConfigFile();

  // Validate config has required fields
  if (!config.environments || !config.tests) {
    clack.log.error('Invalid config: missing required fields');
    process.exit(1);
  }

  // Check if any tests are configured
  if (!config.tests.wp && !config.tests.plugin && !config.tests.theme) {
    clack.log.warn('No tests configured to run. Check your wp-tester.json config.');
    return;
  }

  // Run smoke tests if enabled
  if (config.tests.wp) {
    const report = await runSmokeTests(config as WPTesterConfig);

    // Display results using CTRF format
    const { summary } = report.results;
    const duration = summary.stop - summary.start;
    const success = summary.failed === 0;

    if (success) {
      clack.log.success(`All tests passed! ${summary.passed}/${summary.tests} tests passed in ${duration}ms`);
    } else {
      clack.log.error(`Tests failed: ${summary.failed}/${summary.tests} tests failed`);
      process.exit(1);
    }
  }

  // Future: add plugin and theme test runners
  if (config.tests?.plugin) {
    clack.log.warn('Plugin tests are not yet implemented');
  }

  if (config.tests?.theme) {
    clack.log.warn('Theme tests are not yet implemented');
  }
};

import { runTests, executeTests } from './runner';
import { runWatchMode } from './watcher';
import type { TestType } from '@wp-tester/config';
import { getConfigPath, readConfigFile } from '@wp-tester/config';
import * as clack from "@clack/prompts";

/**
 * Count how many test types are configured in the config.
 */
function countConfiguredTestTypes(tests: {
  plugin?: string;
  theme?: string;
  wp?: boolean;
  phpunit?: unknown;
}): number {
  let count = 0;
  if (tests.plugin) count++;
  if (tests.theme) count++;
  if (tests.wp) count++;
  if (tests.phpunit) count++;
  return count;
}

interface TestArgs {
  config?: string;
  test?: TestType;
  watch?: boolean;
  passWithNoTests?: boolean;
  'failed-only'?: boolean;
  '--'?: string[];
}

export const testHandler = async (argv: TestArgs): Promise<void> => {
  const { config = './wp-tester.json', test, watch, passWithNoTests } = argv;
  const failedOnly = argv['failed-only'];
  const extraArgs = argv["--"] || [];

  if (extraArgs.length > 0 && test === undefined) {
    // Only enforce this rule when there's more than one set of tests to run
    const absoluteConfigPath = getConfigPath(config);
    const rawConfig = await readConfigFile(absoluteConfigPath);
    const configuredTestCount = countConfiguredTestTypes(rawConfig.tests);

    if (configuredTestCount > 1) {
      clack.log.error(
        "You provided extra arguments but didn't specify which tests to run.\n\nExtra arguments are passed to the test runner, so we need to know whether to pass them to PHPUnit or Smoke tests.\n\nPlease use --test to specify the test type."
      );
      process.exit(1);
    }
  }

  if (watch) {
    const absoluteConfigPath = getConfigPath(config);
    await runWatchMode({
      configPath: absoluteConfigPath,
      onRunTests: async () => {
        await executeTests(absoluteConfigPath, {
          testType: test,
          extraArgs,
          passWithNoTests,
          failedOnly,
        });
      },
    });
  } else {
    clack.log.info(" Test Run\n");
    await runTests(config, {
      testType: test,
      extraArgs,
      passWithNoTests,
      failedOnly,
    });
  }
};

export default testHandler;

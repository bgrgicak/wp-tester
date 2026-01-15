import { runTests, executeTests } from './runner';
import { runWatchMode } from './watcher';
import type { TestType } from '@wp-tester/config';
import { getWorkingDirectory } from '@wp-tester/config';
import * as clack from "@clack/prompts";
import path from "path";

interface TestArgs {
  config?: string;
  test?: TestType;
  watch?: boolean;
  passWithNoTests?: boolean;
  "--"?: string[];
}

export const testHandler = async (argv: TestArgs): Promise<void> => {
  const { config = "./wp-tester.json", test, watch, passWithNoTests } = argv;
  const extraArgs = argv["--"] || [];

  if (extraArgs.length > 0 && test === undefined) {
    clack.log.error(
      "You provided extra arguments but didn't specify which tests to run.\n\nExtra arguments are passed to the test runner, so we need to know whether to pass them to PHPUnit or Smoke tests.\n\nPlease use --test to specify the test type."
    );
    process.exit(1);
  }

  if (watch) {
    const cwd = getWorkingDirectory();
    const absoluteConfigPath = path.resolve(cwd, config);
    await runWatchMode({
      configPath: absoluteConfigPath,
      onRunTests: async () => {
        await executeTests(absoluteConfigPath, {
          testType: test,
          extraArgs,
          passWithNoTests,
        });
      },
    });
  } else {
    await runTests(config, {
      testType: test,
      extraArgs,
      passWithNoTests,
    });
  }
};

export default testHandler;

import { runTests, executeTests } from './runner';
import { runWatchMode } from './watcher';
import type { TestType } from '@wp-tester/config';
import { getWorkingDirectory } from '@wp-tester/config';
import path from 'path';

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

  const phpunitArgs = argv['--'] || [];

  if (watch) {
    const cwd = getWorkingDirectory();
    const absoluteConfigPath = path.resolve(cwd, config);
    await runWatchMode({
      configPath: absoluteConfigPath,
      onRunTests: async () => {
        await executeTests(absoluteConfigPath, { testType: test, phpunitArgs, passWithNoTests, failedOnly });
      },
    });
  } else {
    await runTests(config, { testType: test, phpunitArgs, passWithNoTests, failedOnly });
  }
};

export default testHandler;

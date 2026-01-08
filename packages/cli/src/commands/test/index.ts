import { runTests, executeTests } from './runner';
import { runWatchMode } from './watcher';
import type { TestType } from '@wp-tester/config';
import path from 'path';

interface TestArgs {
  config: string;
  test?: TestType;
  watch?: boolean;
  '--'?: string[];
}

export const testHandler = async (argv: TestArgs): Promise<void> => {
  const { config, test, watch } = argv;
  const phpunitArgs = argv['--'] || [];

  if (watch) {
    const absoluteConfigPath = path.resolve(process.cwd(), config);
    await runWatchMode({
      configPath: absoluteConfigPath,
      onRunTests: async () => {
        await executeTests(absoluteConfigPath, test, phpunitArgs);
      },
    });
  } else {
    await runTests(config, test, phpunitArgs);
  }
};

export default testHandler;

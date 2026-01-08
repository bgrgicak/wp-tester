import { runTests } from './runner';
import type { TestType } from '@wp-tester/config';

interface TestArgs {
  config: string;
  test?: TestType;
  regression?: boolean;
  clear?: boolean;
  '--'?: string[];
}

export const testHandler = async (argv: TestArgs): Promise<void> => {
  const { config, test, regression, clear } = argv;
  const phpunitArgs = argv['--'] || [];
  await runTests(config, test, phpunitArgs, { regression, clear });
};

export default testHandler;

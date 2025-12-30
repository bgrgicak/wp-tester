import { runTests } from './runner';
import type { TestType } from '@wp-tester/config';

interface TestArgs {
  config: string;
  test?: TestType;
  '--'?: string[];
}

export const testHandler = async (argv: TestArgs): Promise<void> => {
  const { config, test } = argv;
  const phpunitArgs = argv['--'] || [];
  await runTests(config, test, phpunitArgs);
};

export default testHandler;

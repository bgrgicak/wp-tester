import { runTests } from './runner';
import type { TestType } from '@wp-tester/config';

export type BaselineMode = 'capture' | 'compare';

interface TestArgs {
  config: string;
  test?: TestType;
  baseline?: BaselineMode;
  '--'?: string[];
}

export const testHandler = async (argv: TestArgs): Promise<void> => {
  const { config, test, baseline } = argv;
  const phpunitArgs = argv['--'] || [];
  await runTests(config, test, phpunitArgs, baseline);
};

export default testHandler;

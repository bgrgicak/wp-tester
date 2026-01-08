import { runTests } from './runner';
import type { TestType } from '@wp-tester/config';

interface TestArgs {
  config: string;
  test?: TestType;
  regression?: boolean;
  'update-baseline'?: boolean;
  '--'?: string[];
}

export const testHandler = async (argv: TestArgs): Promise<void> => {
  const { config, test, regression, 'update-baseline': updateBaseline } = argv;
  const phpunitArgs = argv['--'] || [];
  await runTests(config, test, phpunitArgs, { regression, updateBaseline });
};

export default testHandler;

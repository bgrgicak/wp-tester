import { runTests } from './runner';
import type { TestType } from '@wp-tester/config';

interface TestArgs {
  config: string;
  test?: TestType;
  passWithNoTests?: boolean;
  '--'?: string[];
}

export const testHandler = async (argv: TestArgs): Promise<void> => {
  const { config, test, passWithNoTests } = argv;
  const phpunitArgs = argv['--'] || [];
  await runTests(config, { testType: test, phpunitArgs, passWithNoTests });
};

export default testHandler;

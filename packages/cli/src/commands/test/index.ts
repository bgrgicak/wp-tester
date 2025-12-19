import { runTests } from './runner';
import type { TestType } from '@wp-tester/config';

interface TestArgs {
  config: string;
  test?: TestType;
}

export const testHandler = async (argv: TestArgs): Promise<void> => {
  const { config, test } = argv;
  await runTests(config, test);
};

export default testHandler;

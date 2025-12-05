import { runTests } from './runner';

interface TestArgs {
  config: string;
}

export const testHandler = async (argv: TestArgs): Promise<void> => {
  const { config } = argv;
  await runTests(config);
};

export default testHandler;

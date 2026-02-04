import type { WPTesterConfig, Tests } from '../types';
import * as clack from "@clack/prompts";

export async function smokeTestsOption(
  config: WPTesterConfig,
): Promise<WPTesterConfig> {
  const tests: Tests = { ...config.tests };

  // Ask about smoke tests
  const runSmokeTests = await clack.select({
    message: "Run smoke tests?",
    options: [
      {
        value: true,
        label: "Yes",
        hint: "Verifies your project doesn't break standard WordPress functionality.",
      },
      { value: false, label: "No" },
    ],
    initialValue: true,
  });

  if (clack.isCancel(runSmokeTests)) {
    clack.cancel("Setup cancelled.");
    process.exit(0);
  }

  tests.smokeTests = runSmokeTests;

  return {
    ...config,
    tests,
  };
}

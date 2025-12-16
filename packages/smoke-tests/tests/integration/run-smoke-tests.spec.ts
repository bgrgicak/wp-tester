import { describe, it, expect } from 'vitest';
import { runSmokeTests } from '../../src/index.js';
import type { WPTesterConfig } from '@wp-tester/config';
import { TEST_PLUGIN_CONFIG } from "@wp-tester/test-fixtures";

describe('runSmokeTests integration', () => {
  it("should run wp tests and return CTRF report", async () => {
    const config: WPTesterConfig = {
      environments: [
        {
          name: "Test Environment",
          blueprint: {
            landingPage: "/",
          },
        },
      ],
      tests: {
        wp: true,
      },
    };

    const report = await runSmokeTests(config);

    expect(report).toBeDefined();
    expect(report.results).toBeDefined();
    expect(report.results.summary).toBeDefined();
    expect(report.results.summary.tests).toBeGreaterThan(0);
  }, 60000); // 60s timeout for WordPress boot

  it.skip("should run plugin tests and return CTRF report", async () => {
    const report = await runSmokeTests(TEST_PLUGIN_CONFIG);

    expect(report).toBeDefined();
    expect(report.results).toBeDefined();
    expect(report.results.summary).toBeDefined();

    // Verify plugin tests actually ran (at least one test executed)
    expect(report.results.summary.tests).toBeGreaterThan(0);

    // Verify we have plugin-related tests in the results
    const hasPluginTests = report.results.tests.some((test) =>
      test.name.toLowerCase().includes("plugin")
    );
    expect(hasPluginTests).toBe(true);
  }, 60000); // 60s timeout for WordPress boot

  it("should throw error when no tests are configured", async () => {
    const config: WPTesterConfig = {
      environments: [
        {
          name: "Test Environment",
          blueprint: { landingPage: "/" },
        },
      ],
      tests: {},
    };

    await expect(runSmokeTests(config)).rejects.toThrow(
      "No test files selected"
    );
  });
});

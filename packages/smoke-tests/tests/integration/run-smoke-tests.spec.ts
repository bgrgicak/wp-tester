import { describe, it, expect } from 'vitest';
import { runSmokeTests } from '../../src/index.js';
import type { WPTesterConfig } from '@wp-tester/config';
import { TEST_PLUGIN_CONFIG_PATH } from "@wp-tester/test-fixtures";
import { EMPTY_REPORT } from "@wp-tester/results";

describe("runSmokeTests integration", () => {
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

  it("should run plugin tests and return CTRF report", async () => {
    const report = await runSmokeTests(TEST_PLUGIN_CONFIG_PATH);

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

  it("should return a EMPTY_REPORT when no tests are configured", async () => {
    const config: WPTesterConfig = {
      environments: [
        {
          name: "Test Environment",
          blueprint: { landingPage: "/" },
        },
      ],
      tests: {},
    };

    await expect(await runSmokeTests(config)).toBe(EMPTY_REPORT);
  });
});

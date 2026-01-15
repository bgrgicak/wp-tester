import { describe, it, expect } from 'vitest';
import { runSmokeTests } from '../../src/index.js';
import type { WPTesterConfig } from '@wp-tester/config';
import { resolveConfig } from "@wp-tester/config";
import { TEST_PLUGIN_CONFIG_PATH, TEST_THEME_CONFIG_PATH } from "@wp-tester/test-fixtures";
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

    const resolvedConfig = await resolveConfig(config);
    const report = await runSmokeTests(resolvedConfig);

    expect(report).toBeDefined();
    expect(report.results).toBeDefined();
    expect(report.results.summary).toBeDefined();
    expect(report.results.summary.tests).toBeGreaterThan(0);
  });

  it("should run plugin tests and return CTRF report", async () => {
    const resolvedConfig = await resolveConfig(TEST_PLUGIN_CONFIG_PATH);
    const report = await runSmokeTests(resolvedConfig);

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
  });

  it("should run theme tests and return CTRF report", async () => {
    const resolvedConfig = await resolveConfig(TEST_THEME_CONFIG_PATH);
    const report = await runSmokeTests(resolvedConfig);

    expect(report).toBeDefined();
    expect(report.results).toBeDefined();
    expect(report.results.summary).toBeDefined();

    // Verify theme tests actually ran (at least one test executed)
    expect(report.results.summary.tests).toBeGreaterThan(0);

    // Verify we have theme-related tests in the results
    const hasThemeTests = report.results.tests.some((test) =>
      test.name.toLowerCase().includes("theme")
    );
    expect(hasThemeTests).toBe(true);
  });

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

    const resolvedConfig = await resolveConfig(config);
    await expect(await runSmokeTests(resolvedConfig)).toBe(EMPTY_REPORT);
  });
});

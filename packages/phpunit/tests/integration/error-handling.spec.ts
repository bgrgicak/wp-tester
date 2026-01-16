import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runPhpunitTests } from "../../src/index";
import { resolveConfig } from "@wp-tester/config";
import { TEST_PLUGIN_CONFIG_PATH } from "@wp-tester/test-fixtures";
import path from "path";

describe("PHPUnit error handling", () => {
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		// Spy on console.error to capture error messages
		consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		// Restore console.error after each test
		consoleErrorSpy.mockRestore();
	});
	it(
		"should handle missing PHPUnit config file gracefully",
		async () => {
      const config = await resolveConfig(TEST_PLUGIN_CONFIG_PATH);

      // Point to a non-existent phpunit.xml.dist
      config.projectHostPath = "/non/existent/path";

      const result = await runPhpunitTests(config);

      // Should return a report with 1 failed test per environment indicating the error (2 environments)
      expect(result.results.summary.tests).toBe(2);
      expect(result.results.summary.failed).toBe(2);
    }
	);

	it(
		"should handle missing vendor/bin/phpunit gracefully",
		async () => {
      const config = await resolveConfig(TEST_PLUGIN_CONFIG_PATH);

      // Create a config that points to a directory without PHPUnit installed
      const tempDir = path.join(process.cwd(), "tests", "fixtures");
      config.projectHostPath = tempDir;

      const result = await runPhpunitTests(config);

      // Should return a report with 1 failed test per environment indicating the error (2 environments)
      expect(result.results.summary.tests).toBe(2);
      expect(result.results.summary.failed).toBe(2);
    }
	);

	it("should return empty report when no tests are configured", async () => {
		const config = await resolveConfig(TEST_PLUGIN_CONFIG_PATH);
		config.tests.phpunit = undefined;

		// When phpunit is undefined, the runner should skip execution
		// This test validates the shouldRunPhpUnitTests check
		const result = await runPhpunitTests(config);

		// The runner should return an empty or minimal report
		expect(result.results.summary.tests).toBe(0);
	});

	it("should handle empty environments array", async () => {
		const config = await resolveConfig(TEST_PLUGIN_CONFIG_PATH);
		config.environments = [];

		const result = await runPhpunitTests(config);

		// With no environments, no tests should run
		expect(result.results.summary.tests).toBe(0);
	});

	it("should create synthetic test with error details when PHPUnit executable not found", async () => {
		const config = await resolveConfig(TEST_PLUGIN_CONFIG_PATH);

		// Point to a non-existent PHPUnit executable
		config.tests.phpunit!.phpunitPath = "/absolutely/nonexistent/phpunit";

		const result = await runPhpunitTests(config);

		// Should create a synthetic failed test with the error (1 per environment = 2)
		expect(result.results.summary.tests).toBe(2);
		expect(result.results.summary.failed).toBe(2);
		expect(result.results.tests[0].name).toBe('PHPUnit Bootstrap');
		expect(result.results.tests[0].status).toBe('failed');
		expect(result.results.tests[0].trace).toContain('Could not open input file');
	});
});

import { describe, it, expect } from "vitest";
import { runPhpUnitTests } from "../../src/index";
import { resolveConfig } from "@wp-tester/config";
import { TEST_PLUGIN_CONFIG_PATH } from "@wp-tester/test-fixtures";
import path from "path";

describe("PHPUnit error handling", () => {
	it(
		"should handle missing PHPUnit config file gracefully",
		async () => {
			const config = await resolveConfig(TEST_PLUGIN_CONFIG_PATH);

			// Point to a non-existent phpunit.xml.dist
			config.projectHostPath = "/non/existent/path";

			const result = await runPhpUnitTests(config);

			// Should return empty report when config file is missing
			expect(result.results.summary.tests).toBe(0);
		},
		60000
	);

	it(
		"should handle missing vendor/bin/phpunit gracefully",
		async () => {
			const config = await resolveConfig(TEST_PLUGIN_CONFIG_PATH);

			// Create a config that points to a directory without PHPUnit installed
			const tempDir = path.join(process.cwd(), "tests", "fixtures");
			config.projectHostPath = tempDir;

			const result = await runPhpUnitTests(config);

			// Should return empty report when phpunit binary is missing
			expect(result.results.summary.tests).toBe(0);
		},
		60000
	);

	it("should return empty report when no tests are configured", async () => {
		const config = await resolveConfig(TEST_PLUGIN_CONFIG_PATH);
		config.tests.phpunit = undefined;

		// When phpunit is disabled, the runner should skip execution
		// This test validates the shouldRunPhpUnitTests check
		const result = await runPhpUnitTests(config);

		// The runner should return an empty or minimal report
		expect(result.results.summary.tests).toBe(0);
	});

	it("should handle empty environments array", async () => {
		const config = await resolveConfig(TEST_PLUGIN_CONFIG_PATH);
		config.environments = [];

		const result = await runPhpUnitTests(config);

		// With no environments, no tests should run
		expect(result.results.summary.tests).toBe(0);
	});
});

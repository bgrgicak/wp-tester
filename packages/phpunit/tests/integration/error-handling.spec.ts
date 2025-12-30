import { describe, it, expect, vi } from "vitest";
import { runPhpunitTests } from "../../src/index";
import { resolveConfig } from "@wp-tester/config";
import { TEST_PLUGIN_CONFIG_PATH } from "@wp-tester/test-fixtures";
import path from "path";
import { execSync } from "child_process";

// Check if we have network access by trying to ping WordPress.org
function hasNetworkAccess(): boolean {
	try {
		// Try to resolve wordpress.org DNS
		execSync("getent hosts wordpress.org || nslookup wordpress.org || ping -c 1 -W 1 wordpress.org", {
			stdio: "pipe",
			timeout: 2000,
		});
		return true;
	} catch {
		return false;
	}
}

const skipTests = !hasNetworkAccess();
if (skipTests) {
	console.warn("Skipping PHPUnit error handling integration tests: No network access");
}

// Mock the WordPress release resolver to avoid additional network calls
vi.mock("@wp-playground/wordpress", () => ({
	resolveWordPressRelease: vi.fn().mockResolvedValue({
		releaseUrl: "https://wordpress.org/wordpress-6.6.2.zip",
		version: "6.6.2",
		source: "cache",
	}),
}));

describe("PHPUnit error handling", () => {
	it.skipIf(skipTests)(
		"should handle missing PHPUnit config file gracefully",
		async () => {
      const config = await resolveConfig(TEST_PLUGIN_CONFIG_PATH);

      // Point to a non-existent phpunit.xml.dist
      config.projectHostPath = "/non/existent/path";

      const result = await runPhpunitTests(config);

      // Should return empty report when config file is missing
      expect(result.results.summary.tests).toBe(0);
    }
	);

	it.skipIf(skipTests)(
		"should handle missing vendor/bin/phpunit gracefully",
		async () => {
      const config = await resolveConfig(TEST_PLUGIN_CONFIG_PATH);

      // Create a config that points to a directory without PHPUnit installed
      const tempDir = path.join(process.cwd(), "tests", "fixtures");
      config.projectHostPath = tempDir;

      const result = await runPhpunitTests(config);

      // Should return empty report when phpunit binary is missing
      expect(result.results.summary.tests).toBe(0);
    }
	);

	it("should return empty report when no tests are configured", async () => {
		const config = await resolveConfig(TEST_PLUGIN_CONFIG_PATH);
		config.tests.phpunit = undefined;

		// When phpunit is disabled, the runner should skip execution
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
});

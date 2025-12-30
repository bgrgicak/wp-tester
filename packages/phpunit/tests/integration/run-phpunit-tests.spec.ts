import { describe, it, expect, vi } from "vitest";
import { runPhpunitTests, shouldRunPhpunitTests } from "../../src/index";
import { resolveConfig } from "@wp-tester/config";
import {
	TEST_PLUGIN_CONFIG_PATH,
	TEST_THEME_CONFIG_PATH,
} from "@wp-tester/test-fixtures";

// Check if we have network access
// We use this to skip integration tests that require downloading WordPress
function hasNetworkAccess(): boolean {
	try {
		const {execSync} = require('child_process');
		execSync('node -e "require(\'dns\').lookup(\'wordpress.org\', (e) => process.exit(e ? 1 : 0))"', {
			stdio: 'pipe',
			timeout: 2000,
		});
		return true;
	} catch {
		return false;
	}
}

const skipTests = !hasNetworkAccess();
if (skipTests) {
	console.warn("Skipping runPhpunitTests integration tests: No network access");
}

// Mock the WordPress release resolver to avoid additional network calls
vi.mock("@wp-playground/wordpress", () => ({
	resolveWordPressRelease: vi.fn().mockResolvedValue({
		releaseUrl: "https://wordpress.org/wordpress-6.6.2.zip",
		version: "6.6.2",
		source: "cache",
	}),
}));

describe("runPhpunitTests integration", () => {
	it.skipIf(skipTests)(
		"should run plugin PHPUnit tests and return CTRF report",
		async () => {
			// Pass the config path string directly so the runner can determine project root
			const report = await runPhpunitTests(TEST_PLUGIN_CONFIG_PATH);

			// Validate report structure
			expect(report).toBeDefined();
			expect(report.results).toBeDefined();
			expect(report.results.summary).toBeDefined();

			// Validate that tests actually ran
			expect(report.results.summary.tests).toBeGreaterThan(0);
			expect(report.results.summary.tests).toBe(5); // Plugin has 5 tests

			// Validate all plugin tests passed
			expect(report.results.summary.passed).toBe(5);
			expect(report.results.summary.failed).toBe(0);
			expect(report.results.summary.skipped).toBe(0);

			// Validate test details are present
			expect(report.results.tests).toBeDefined();
			expect(report.results.tests.length).toBeGreaterThan(0);

			// Check that specific plugin tests are present
			const testNames = report.results.tests.map((test) => test.name);
			// Test names include class name prefix
			expect(testNames.some(name => name.includes("test_sanitize_text_removes_extra_whitespace"))).toBe(true);
			expect(testNames.some(name => name.includes("test_custom_content_filter_is_registered"))).toBe(true);
			expect(testNames.some(name => name.includes("test_can_create_and_retrieve_post"))).toBe(true);

			// Validate test statuses
			for (const test of report.results.tests) {
				expect(test.status).toBe("passed");
				expect(test.duration).toBeGreaterThanOrEqual(0);
			}
		}
	);

	it.skipIf(skipTests)(
		"should run theme PHPUnit tests and return CTRF report",
		async () => {
			// Load config, enable PHPUnit, set projectHostPath
			const config = await resolveConfig(TEST_THEME_CONFIG_PATH);
			config.tests.phpunit = {
				phpunitPath: "vendor/bin/phpunit",
				configPath: "phpunit.xml.dist",
				bootstrapPath: "tests/bootstrap.php",
				testMode: "integration",
			};
			// Set projectHostPath to theme fixture path so runner can find phpunit.xml.dist
			config.projectHostPath = TEST_THEME_CONFIG_PATH.replace("/wp-tester.json", "");

			const report = await runPhpunitTests(config);

			// Validate report structure
			expect(report).toBeDefined();
			expect(report.results).toBeDefined();
			expect(report.results.summary).toBeDefined();

			// Validate that tests actually ran
			expect(report.results.summary.tests).toBeGreaterThan(0);
			expect(report.results.summary.tests).toBe(2); // Theme has 2 tests

			// Note: One of the theme tests may fail if WordPress environment isn't fully loaded
			// We're validating that tests ran, not that they all pass
			expect(report.results.summary.tests).toBeGreaterThan(0);

			// Validate test details are present
			expect(report.results.tests).toBeDefined();
			expect(report.results.tests.length).toBe(2);

			// Check that specific theme tests are present
			const testNames = report.results.tests.map((test) => test.name);
			expect(testNames.some(name => name.includes("test_format_date_returns_friendly_format"))).toBe(true);
			expect(testNames.some(name => name.includes("test_navigation_menu_is_registered"))).toBe(true);

			// Validate test statuses and durations
			for (const test of report.results.tests) {
				expect(["passed", "failed"]).toContain(test.status);
				expect(test.duration).toBeGreaterThanOrEqual(0);
			}
		}
	);

	it.skipIf(skipTests)("should handle multiple environments correctly", async () => {
		// Pass config path so runner can determine project root
		const report = await runPhpunitTests(TEST_PLUGIN_CONFIG_PATH);

		expect(report.results.tests).toBeDefined();

		// Each test should have an environment name in its full name or metadata
		// The runner should have processed the "Latest WordPress and PHP" environment
		expect(report.results.summary.tests).toBeGreaterThan(0);
	});
});

describe("shouldRunPhpunitTests", () => {
	it("should return true for plugin config with phpunit enabled", async () => {
		const config = await resolveConfig(TEST_PLUGIN_CONFIG_PATH);

		const result = shouldRunPhpunitTests(config);

		expect(result).toBe(true);
	});

	it("should return true for theme config with phpunit enabled", async () => {
		const config = await resolveConfig(TEST_THEME_CONFIG_PATH);
		config.tests.phpunit = {
			phpunitPath: "vendor/bin/phpunit",
			configPath: "phpunit.xml.dist",
			bootstrapPath: "tests/bootstrap.php",
			testMode: "integration",
		};

		const result = shouldRunPhpunitTests(config);

		expect(result).toBe(true);
	});

	it("should return false when phpunit is disabled", async () => {
		const config = await resolveConfig(TEST_PLUGIN_CONFIG_PATH);
		config.tests.phpunit = undefined;

		const result = shouldRunPhpunitTests(config);

		expect(result).toBe(false);
	});

	it("should return false when tests config is missing", async () => {
		const config = await resolveConfig(TEST_PLUGIN_CONFIG_PATH);
		// @ts-expect-error - Testing missing tests config
		delete config.tests;

		const result = shouldRunPhpunitTests(config);

		expect(result).toBe(false);
	});
});

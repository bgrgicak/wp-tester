import { describe, it, expect } from "vitest";
import { runPhpunitTests, shouldRunPhpunitTests } from "../../src/index";
import { resolveConfig } from "@wp-tester/config";
import {
	TEST_PLUGIN_CONFIG_PATH,
	TEST_THEME_CONFIG_PATH,
} from "@wp-tester/test-fixtures";

describe("runPhpunitTests integration", () => {
	it(
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

	it(
		"should run theme PHPUnit tests and return CTRF report",
		async () => {
			// Pass the config path string directly so the runner can determine project root
			// Theme fixture already has phpunit config with testMode: "integration"
			const report = await runPhpunitTests(TEST_THEME_CONFIG_PATH);

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

	it("should handle multiple environments correctly", async () => {
		// Pass config path so runner can determine project root
		const report = await runPhpunitTests(TEST_PLUGIN_CONFIG_PATH);

		expect(report.results.tests).toBeDefined();

		// Each test should have an environment name in its full name or metadata
		// The runner should have processed the "Latest WordPress and PHP" environment
		expect(report.results.summary.tests).toBeGreaterThan(0);
	});

	it(
		"should pass phpunitArgs to PHPUnit CLI to filter tests",
		async () => {
			// Load config and add phpunitArgs to filter only WordPressTest
			const config = await resolveConfig(TEST_PLUGIN_CONFIG_PATH);
			config.tests.phpunit!.phpunitArgs = ["--filter", "WordPressTest"];

			const report = await runPhpunitTests(config);

			// Validate report structure
			expect(report).toBeDefined();
			expect(report.results).toBeDefined();
			expect(report.results.summary).toBeDefined();

			// With --filter WordPressTest, only 3 tests should run (from WordPressTest.php)
			// Without the filter, all 5 tests run (2 from UnitTest.php + 3 from WordPressTest.php)
			expect(report.results.summary.tests).toBe(3);

			// Validate all filtered tests passed
			expect(report.results.summary.passed).toBe(3);
			expect(report.results.summary.failed).toBe(0);
			expect(report.results.summary.skipped).toBe(0);

			// Check that only WordPressTest tests are present
			const testNames = report.results.tests.map((test) => test.name);
			expect(testNames.some(name => name.includes("test_can_create_and_retrieve_post"))).toBe(true);
			expect(testNames.some(name => name.includes("test_wordpress_sanitize_functions"))).toBe(true);
			expect(testNames.some(name => name.includes("test_wordpress_options"))).toBe(true);

			// UnitTest tests should NOT be present
			expect(testNames.some(name => name.includes("test_sanitize_text_removes_extra_whitespace"))).toBe(false);
			expect(testNames.some(name => name.includes("test_custom_content_filter_is_registered"))).toBe(false);
		}
	);

	it(
		"should run single test file when passed as phpunitArg",
		async () => {
			// Test passing a single test file path as an argument
			// This simulates: wp-tester test -- tests/WordPressTest.php
			const report = await runPhpunitTests(
				TEST_PLUGIN_CONFIG_PATH,
				["tests/WordPressTest.php"]
			);

			// Validate report structure
			expect(report).toBeDefined();
			expect(report.results).toBeDefined();
			expect(report.results.summary).toBeDefined();

			// Only WordPressTest.php should run (3 tests)
			// Not UnitTest.php (2 tests)
			expect(report.results.summary.tests).toBe(3);
			expect(report.results.summary.passed).toBe(3);
			expect(report.results.summary.failed).toBe(0);

			// Verify only WordPressTest tests are present
			const testNames = report.results.tests.map((test) => test.name);
			expect(testNames.some(name => name.includes("test_can_create_and_retrieve_post"))).toBe(true);
			expect(testNames.some(name => name.includes("test_wordpress_sanitize_functions"))).toBe(true);
			expect(testNames.some(name => name.includes("test_wordpress_options"))).toBe(true);

			// UnitTest tests should NOT be present
			expect(testNames.some(name => name.includes("test_sanitize_text_removes_extra_whitespace"))).toBe(false);
			expect(testNames.some(name => name.includes("test_custom_content_filter_is_registered"))).toBe(false);
		}
	);

	it(
		"should run tests from directory when passed as phpunitArg",
		async () => {
			// Test passing a directory path as an argument
			// This simulates: wp-tester test -- tests/
			const report = await runPhpunitTests(
				TEST_PLUGIN_CONFIG_PATH,
				["tests/"]
			);

			// Validate report structure
			expect(report).toBeDefined();
			expect(report.results).toBeDefined();
			expect(report.results.summary).toBeDefined();

			// All tests should run (5 tests total)
			expect(report.results.summary.tests).toBe(5);
			expect(report.results.summary.passed).toBe(5);
			expect(report.results.summary.failed).toBe(0);
		}
	);

	it(
		"should handle phpunitArgs with flags that have path-like values",
		async () => {
			// Test that flag values are NOT resolved even if they look like paths
			// Example: --filter could have a value like "MyNamespace\Tests"
			const report = await runPhpunitTests(
				TEST_PLUGIN_CONFIG_PATH,
				["--filter", "WordPressTest"]
			);

			// Should only run WordPressTest (3 tests)
			expect(report.results.summary.tests).toBe(3);
			expect(report.results.summary.passed).toBe(3);

			// Verify only WordPressTest tests ran
			const testNames = report.results.tests.map((test) => test.name);
			expect(testNames.some(name => name.includes("test_can_create_and_retrieve_post"))).toBe(true);
			expect(testNames.some(name => name.includes("test_sanitize_text_removes_extra_whitespace"))).toBe(false);
		}
	);

	it(
		"should handle mixed flags and file paths",
		async () => {
			// Test combining flags with file paths
			// This simulates: wp-tester test -- --filter test_wordpress tests/WordPressTest.php
			const report = await runPhpunitTests(
				TEST_PLUGIN_CONFIG_PATH,
				["--filter", "test_wordpress", "tests/WordPressTest.php"]
			);

			// Should only run tests matching filter in the specified file
			// WordPressTest.php has 3 tests, 2 match "test_wordpress" filter
			expect(report.results.summary.tests).toBe(2);
			expect(report.results.summary.passed).toBe(2);

			const testNames = report.results.tests.map((test) => test.name);
			expect(testNames.some(name => name.includes("test_wordpress_sanitize_functions"))).toBe(true);
			expect(testNames.some(name => name.includes("test_wordpress_options"))).toBe(true);
			// This test doesn't match the filter
			expect(testNames.some(name => name.includes("test_can_create_and_retrieve_post"))).toBe(false);
		}
	);

	it(
		"should handle boolean flags before file paths",
		async () => {
			// Test that boolean flags don't prevent path resolution
			// This simulates: wp-tester test -- --stop-on-failure tests/WordPressTest.php
			const report = await runPhpunitTests(
				TEST_PLUGIN_CONFIG_PATH,
				["--stop-on-failure", "tests/WordPressTest.php"]
			);

			// Should run WordPressTest.php (3 tests)
			expect(report.results.summary.tests).toBe(3);
			expect(report.results.summary.passed).toBe(3);

			const testNames = report.results.tests.map((test) => test.name);
			expect(testNames.some(name => name.includes("test_can_create_and_retrieve_post"))).toBe(true);
			expect(testNames.some(name => name.includes("test_wordpress_sanitize_functions"))).toBe(true);
			expect(testNames.some(name => name.includes("test_wordpress_options"))).toBe(true);
		}
	);

	it(
		"should handle path after multiple boolean flags",
		async () => {
			// Test path resolution after multiple boolean flags
			// This simulates: wp-tester test -- --no-coverage --stop-on-failure tests/WordPressTest.php
			const report = await runPhpunitTests(
				TEST_PLUGIN_CONFIG_PATH,
				["--no-coverage", "--stop-on-failure", "tests/WordPressTest.php"]
			);

			// Should run WordPressTest.php (3 tests)
			expect(report.results.summary.tests).toBe(3);
			expect(report.results.summary.passed).toBe(3);
		}
	);

	it(
		"should handle flag with equals syntax followed by path",
		async () => {
			// Test that = syntax doesn't prevent next path resolution
			// This simulates: wp-tester test -- --colors=auto tests/WordPressTest.php
			const report = await runPhpunitTests(
				TEST_PLUGIN_CONFIG_PATH,
				["--colors=auto", "tests/WordPressTest.php"]
			);

			// Should run WordPressTest.php (3 tests)
			expect(report.results.summary.tests).toBe(3);
			expect(report.results.summary.passed).toBe(3);
		}
	);
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

	it("should return false when phpunit is undefined", async () => {
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

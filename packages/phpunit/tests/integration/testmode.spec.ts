import { describe, it, expect } from "vitest";
import { runPhpunitTests } from "../../src/index";
import { resolveConfig } from "@wp-tester/config";
import { TEST_PLUGIN_CONFIG_PATH } from "@wp-tester/test-fixtures";
import { readFile } from 'fs/promises';
import { dirname } from 'path';

describe("PHPUnit testMode integration", () => {

	it("should run in unit mode with WordPress test library", async () => {
		// Load config and override testMode to "unit"
		const config = await resolveConfig(TEST_PLUGIN_CONFIG_PATH);
		config.tests.phpunit = {
			...config.tests.phpunit!,
			testMode: "unit",
		};

		const report = await runPhpunitTests(config);

		// Verify report structure
		expect(report).toBeDefined();
		expect(report.results).toBeDefined();
		expect(report.results.summary).toBeDefined();

		// In unit mode with WP test library, all tests in UnitTest.php should pass
		const unitTests = report.results.tests.filter(test =>
			test.name.includes("UnitTest")
		);
		expect(unitTests.length).toBeGreaterThan(0);
		unitTests.forEach(test => {
			expect(test.status).toBe("passed");
		});

		// In unit mode with WP test library, WordPress is loaded via the test library
		// so tests in WordPressTest.php should also pass
		const wpTests = report.results.tests.filter(test =>
			test.name.includes("WordPressTest")
		);
		expect(wpTests.length).toBeGreaterThan(0);
		wpTests.forEach(test => {
			expect(test.status).toBe("passed");
		});
	});

	it("should run in integration mode with WordPress", { retry: 2 }, async () => {
		// Load config with default testMode from fixture (already "integration")
		const config = await resolveConfig(TEST_PLUGIN_CONFIG_PATH);

		// Verify the fixture has testMode set to "integration"
		expect(config.tests.phpunit?.testMode).toBe("integration");

		const report = await runPhpunitTests(config);

		// Verify report structure
		expect(report).toBeDefined();
		expect(report.results).toBeDefined();
		expect(report.results.summary).toBeDefined();

		// Verify tests were actually run
		expect(report.results.summary.tests, "Expected tests to run but got 0 tests. This may indicate PHPUnit failed to start or execute.").toBeGreaterThan(0);
		expect(report.results.tests.length, "Expected test results array to be populated").toBeGreaterThan(0);

		// In integration mode, all tests in UnitTest.php should pass
		const unitTests = report.results.tests.filter(test =>
			test.name.includes("UnitTest")
		);
		expect(unitTests.length, `Expected to find UnitTest tests but found ${unitTests.length}. Available tests: ${report.results.tests.map(t => t.name).join(", ")}`).toBeGreaterThan(0);
		unitTests.forEach(test => {
			expect(test.status, `Test ${test.name} should have passed but got status: ${test.status}`).toBe("passed");
		});

		// In integration mode, all tests in WordPressTest.php should also pass
		const wpTests = report.results.tests.filter(test =>
			test.name.includes("WordPressTest")
		);
		expect(wpTests.length, `Expected to find WordPressTest tests but found ${wpTests.length}. Available tests: ${report.results.tests.map(t => t.name).join(", ")}`).toBeGreaterThan(0);
		wpTests.forEach(test => {
			expect(test.status, `Test ${test.name} should have passed but got status: ${test.status}`).toBe("passed");
		});
	});

	it("should default to unit mode when testMode is not specified", async () => {
		// Load config without testMode to test default behavior
		// Read the test plugin config
		const configContent = JSON.parse(await readFile(TEST_PLUGIN_CONFIG_PATH, 'utf-8'));

		// Remove testMode from the raw config before resolution
		if (configContent.tests?.phpunit) {
			delete configContent.tests.phpunit.testMode;
		}

		// Add projectHostPath so paths can be resolved relative to the test plugin directory
		configContent.projectHostPath = dirname(TEST_PLUGIN_CONFIG_PATH);

		// Now resolve the config - it should default testMode to "unit"
		const config = await resolveConfig(configContent);

		const report = await runPhpunitTests(config);

		// Verify report structure
		expect(report).toBeDefined();
		expect(report.results).toBeDefined();
		expect(report.results.summary).toBeDefined();

		// Without testMode specified, defaults to unit mode with WP test library
		// All tests in UnitTest.php should pass
		const unitTests = report.results.tests.filter(test =>
			test.name.includes("UnitTest")
		);
		expect(unitTests.length).toBeGreaterThan(0);
		unitTests.forEach(test => {
			expect(test.status).toBe("passed");
		});

		// In unit mode with WP test library, WordPress is loaded via the test library
		// so all tests in WordPressTest.php should also pass
		const wpTests = report.results.tests.filter(test =>
			test.name.includes("WordPressTest")
		);
		expect(wpTests.length).toBeGreaterThan(0);
		wpTests.forEach(test => {
			expect(test.status).toBe("passed");
		});
	});
});

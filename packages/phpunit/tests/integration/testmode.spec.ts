import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runPhpUnitTests } from "../../src/index";
import { resolveConfig } from "@wp-tester/config";
import { TEST_PLUGIN_CONFIG_PATH } from "@wp-tester/test-fixtures";

describe("PHPUnit testMode integration", () => {
	let consoleLogSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		// Spy on console.log to capture output
		consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		// Restore console.log
		consoleLogSpy.mockRestore();
	});

	it("should run in unit mode without WordPress", async () => {
		// Load config and override testMode to "unit"
		const config = await resolveConfig(TEST_PLUGIN_CONFIG_PATH);
		config.tests.phpunit = {
			...config.tests.phpunit!,
			testMode: "unit",
		};

		const report = await runPhpUnitTests(config);

		// Verify report structure
		expect(report).toBeDefined();
		expect(report.results).toBeDefined();
		expect(report.results.summary).toBeDefined();

		// Verify console output shows unit mode
		expect(consoleLogSpy).toHaveBeenCalledWith(
			expect.stringContaining("Running PHPUnit unit tests (without WordPress)")
		);

		// In unit mode, all tests in UnitTest.php should pass
		const unitTests = report.results.tests.filter(test =>
			test.name.includes("UnitTest")
		);
		expect(unitTests.length).toBeGreaterThan(0);
		unitTests.forEach(test => {
			expect(test.status).toBe("passed");
		});

		// In unit mode, all tests in WordPressTest.php should fail
		const wpTests = report.results.tests.filter(test =>
			test.name.includes("WordPressTest")
		);
		expect(wpTests.length).toBeGreaterThan(0);
		wpTests.forEach(test => {
			expect(test.status).toBe("failed");
		});
	});

	it("should run in integration mode with WordPress", async () => {
		// Load config with default testMode from fixture (already "integration")
		const config = await resolveConfig(TEST_PLUGIN_CONFIG_PATH);

		// Verify the fixture has testMode set to "integration"
		expect(config.tests.phpunit?.testMode).toBe("integration");

		const report = await runPhpUnitTests(config);

		// Verify report structure
		expect(report).toBeDefined();
		expect(report.results).toBeDefined();
		expect(report.results.summary).toBeDefined();

		// Verify console output shows integration mode
		expect(consoleLogSpy).toHaveBeenCalledWith(
			expect.stringContaining("Running PHPUnit integration tests (with WordPress)")
		);

		// In integration mode, all tests in UnitTest.php should pass
		const unitTests = report.results.tests.filter(test =>
			test.name.includes("UnitTest")
		);
		expect(unitTests.length).toBeGreaterThan(0);
		unitTests.forEach(test => {
			expect(test.status).toBe("passed");
		});

		// In integration mode, all tests in WordPressTest.php should also pass
		const wpTests = report.results.tests.filter(test =>
			test.name.includes("WordPressTest")
		);
		expect(wpTests.length).toBeGreaterThan(0);
		wpTests.forEach(test => {
			expect(test.status).toBe("passed");
		});
	});

	it("should default to unit mode when testMode is not specified", async () => {
		// Load config and remove testMode to test default behavior
		const config = await resolveConfig(TEST_PLUGIN_CONFIG_PATH);
		if (config.tests.phpunit) {
			// Remove testMode to test default behavior
			const { testMode, ...rest } = config.tests.phpunit;
			config.tests.phpunit = rest as any;
		}

		const report = await runPhpUnitTests(config);

		// Verify report structure
		expect(report).toBeDefined();
		expect(report.results).toBeDefined();
		expect(report.results.summary).toBeDefined();

		// Verify console output shows unit mode (the default)
		expect(consoleLogSpy).toHaveBeenCalledWith(
			expect.stringContaining("Running PHPUnit unit tests (without WordPress)")
		);

		// Without testMode specified, defaults to unit mode
		// All tests in UnitTest.php should pass
		const unitTests = report.results.tests.filter(test =>
			test.name.includes("UnitTest")
		);
		expect(unitTests.length).toBeGreaterThan(0);
		unitTests.forEach(test => {
			expect(test.status).toBe("passed");
		});

		// All tests in WordPressTest.php should fail
		const wpTests = report.results.tests.filter(test =>
			test.name.includes("WordPressTest")
		);
		expect(wpTests.length).toBeGreaterThan(0);
		wpTests.forEach(test => {
			expect(test.status).toBe("failed");
		});
	});
});

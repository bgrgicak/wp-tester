import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runPhpunitTests } from "../../src/index";
import { resolveConfig } from "@wp-tester/config";
import { TEST_PLUGIN_CONFIG_PATH } from "@wp-tester/test-fixtures";

// Check if we have network access
// We use this to skip integration tests that require downloading WordPress
function hasNetworkAccess(): boolean {
	try {
		// Use Node's child_process to check DNS resolution
		// This is safer than using shell commands with arbitrary input
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
	console.warn("Skipping PHPUnit testMode integration tests: No network access");
}

// Mock the WordPress release resolver to avoid additional network calls
vi.mock("@wp-playground/wordpress", () => ({
	resolveWordPressRelease: vi.fn().mockResolvedValue({
		releaseUrl: "https://wordpress.org/wordpress-6.6.2.zip",
		version: "6.6.2",
		source: "cache",
	}),
}));

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

	it.skipIf(skipTests)("should run in unit mode with WordPress test library", async () => {
		// Load config and override testMode to "unit"
		const config = await resolveConfig(TEST_PLUGIN_CONFIG_PATH);
		config.tests.phpunit = {
			...config.tests.phpunit!,
			testMode: "unit",
		};
		// Use a specific WordPress version to avoid network calls
		config.environments[0].blueprint.preferredVersions.wp = "6.6.2";

		const report = await runPhpunitTests(config);

		// Verify report structure
		expect(report).toBeDefined();
		expect(report.results).toBeDefined();
		expect(report.results.summary).toBeDefined();

		// Verify console output shows unit mode
		expect(consoleLogSpy).toHaveBeenCalledWith(
			expect.stringContaining("Running PHPUnit unit tests (with WordPress test library)")
		);

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

	it.skipIf(skipTests)("should run in integration mode with WordPress", async () => {
		// Load config with default testMode from fixture (already "integration")
		const config = await resolveConfig(TEST_PLUGIN_CONFIG_PATH);

		// Verify the fixture has testMode set to "integration"
		expect(config.tests.phpunit?.testMode).toBe("integration");

		// Use a specific WordPress version to avoid network calls
		config.environments[0].blueprint.preferredVersions.wp = "6.6.2";

		const report = await runPhpunitTests(config);

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

	it.skipIf(skipTests)("should default to unit mode when testMode is not specified", async () => {
		// Load config and remove testMode to test default behavior
		const config = await resolveConfig(TEST_PLUGIN_CONFIG_PATH);
		if (config.tests.phpunit) {
			// Remove testMode to test default behavior
			const { testMode, ...rest } = config.tests.phpunit;
			config.tests.phpunit = rest as any;
		}
		// Use a specific WordPress version to avoid network calls
		config.environments[0].blueprint.preferredVersions.wp = "6.6.2";

		const report = await runPhpunitTests(config);

		// Verify report structure
		expect(report).toBeDefined();
		expect(report.results).toBeDefined();
		expect(report.results.summary).toBeDefined();

		// Verify console output shows unit mode (the default)
		expect(consoleLogSpy).toHaveBeenCalledWith(
			expect.stringContaining("Running PHPUnit unit tests (with WordPress test library)")
		);

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

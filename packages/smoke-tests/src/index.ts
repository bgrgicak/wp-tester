/**
 * WordPress Smoke Test Suite
 *
 * Provides environment validation smoke tests for wp-tester.
 */

import { startVitest } from "vitest/node";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { WPTesterConfig, Tests } from "@wp-tester/config";
import { resolveConfig } from "@wp-tester/config";
import { vitestToCTRF, EMPTY_REPORT } from "@wp-tester/results";
import type { Report } from "@wp-tester/results";

export function shouldRunSmokeTests(config: WPTesterConfig): boolean {
  return (
    config.tests.wp === true ||
    config.tests.plugin !== undefined ||
    config.tests.theme !== undefined
  );
}

/**
 * Select test files based on test configuration
 * @param tests - Test configuration
 * @returns Array of test file paths relative to package root
 * @throws Error if no test files match configuration
 */
export function selectTestFiles(tests: Tests): string[] {
  const files: string[] = [];

  if (tests.wp === true) {
    files.push("src/smoke-tests/wp.spec.ts");
  }

  if (tests.plugin) {
    files.push("src/smoke-tests/plugin.spec.ts");
  }

  // Future: add theme test selection
  // if (tests.theme) files.push('src/smoke-tests/theme.spec.ts');

  if (files.length === 0) {
    throw new Error("No test files selected. Check your tests configuration.");
  }

  return files;
}

/**
 * Run WordPress smoke tests
 *
 * @param config - Test configuration or path to config file
 * @returns CTRF report with test results
 */
export async function runSmokeTests(
  config: WPTesterConfig | string
): Promise<Report> {
  // Resolve config (loads from path if string, resolves paths)
  const resolvedConfig = await resolveConfig(config);

  // Check if any tests are configured
  if (!shouldRunSmokeTests(resolvedConfig)) {
    return Promise.resolve(EMPTY_REPORT) as Promise<Report>;
  }
  // Get package root directory
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const packageRoot = join(__dirname, "..");

  // Select test files based on config
  const testFiles = selectTestFiles(resolvedConfig.tests);

  const reporters = [];
  if (resolvedConfig.reporters?.includes("default")) {
    reporters.push("default");
  }

  // Start Vitest programmatically
  const vitest = await startVitest("test", [], {
    config: join(packageRoot, "src/smoke-tests/vitest.config.ts"),
    root: packageRoot,
    include: testFiles,
    run: true,
    reporters,
    provide: {
      config: resolvedConfig,
    },
  });

  if (!vitest) {
    throw new Error("Failed to start Vitest");
  }

  // Wait for tests to complete
  await vitest.close();

  // Keep the filter active to suppress any lingering output
  // Don't restore stdout here

  const result = vitestToCTRF(vitest, "wp-tester");

  return result;
}

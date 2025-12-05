/**
 * WordPress Smoke Test Suite
 *
 * Provides environment validation smoke tests for wp-tester.
 */

import { startVitest } from "vitest/node";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { WPTesterConfig, Tests } from "@wp-tester/config";
import { vitestToCTRF } from "@wp-tester/results";
import type { Report } from "@wp-tester/results";

/**
 * Select test files based on test configuration
 * @param tests - Test configuration
 * @returns Array of test file paths relative to package root
 * @throws Error if no test files match configuration
 */
export function selectTestFiles(tests: Tests): string[] {
  const files: string[] = [];

  if (tests.wp === true) {
    files.push("tests/wp.spec.ts");
  }

  // Future: add plugin and theme test selection
  // if (tests.plugin) files.push('tests/plugin.spec.ts');
  // if (tests.theme) files.push('tests/theme.spec.ts');

  if (files.length === 0) {
    throw new Error("No test files selected. Check your tests configuration.");
  }

  return files;
}

/**
 * Run WordPress smoke tests
 *
 * @param config - Test configuration
 * @returns CTRF report with test results
 */
export async function runSmokeTests(config: WPTesterConfig): Promise<Report> {
  // Get package root directory
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const packageRoot = join(__dirname, "..");

  // Select test files based on config
  const testFiles = selectTestFiles(config.tests);

  const reporters = ["json"];
  if (config.reporters?.includes("default")) {
    reporters.push("default");
  }

  // Start Vitest programmatically
  const vitest = await startVitest("test", [], {
    config: join(packageRoot, "vitest.config.ts"),
    root: packageRoot,
    include: testFiles,
    run: true,
    reporters,
    provide: {
      config: config,
    },
  });

  if (!vitest) {
    throw new Error("Failed to start Vitest");
  }

  // Wait for tests to complete
  await vitest.close();

  return vitestToCTRF(vitest, "wp-tester");
}

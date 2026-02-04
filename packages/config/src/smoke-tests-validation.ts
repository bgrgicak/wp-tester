import type { SmokeTests } from "./wp-tester-config";

/**
 * Known smoke test names.
 * Must be kept in sync with SMOKE_TEST_REGISTRY in @wp-tester/smoke-tests.
 */
export const KNOWN_SMOKE_TESTS: readonly string[] = [
  // WordPress tests
  "wpBoot",
  "wpAdminLoads",
  "wpRestApiAvailable",
  // Plugin tests
  "pluginActivates",
  "pluginDeactivates",
  "pluginLoads",
  // Theme tests
  "themeActivates",
  "themeLoads",
] as const;

/**
 * Result of validating smokeTests configuration.
 */
export interface SmokeTestsValidationResult {
  /** Any warnings about unknown test names */
  warnings: string[];
}

/**
 * Validate smokeTests configuration.
 *
 * @param smokeTests - The smokeTests configuration to validate
 * @returns Validation result with warnings
 * @throws Error if include and exclude are both specified
 */
export function validateSmokeTests(
  smokeTests: SmokeTests
): SmokeTestsValidationResult {
  const warnings: string[] = [];

  // Boolean is always valid
  if (typeof smokeTests === "boolean") {
    return { warnings };
  }

  // Check for mutually exclusive include/exclude
  const hasInclude = smokeTests.include !== undefined;
  const hasExclude = smokeTests.exclude !== undefined;

  if (hasInclude && hasExclude) {
    throw new Error(
      "smokeTests cannot have both 'include' and 'exclude'. Use one or the other."
    );
  }

  // Check for unknown test names
  const knownSet = new Set(KNOWN_SMOKE_TESTS);

  if (smokeTests.include) {
    for (const testName of smokeTests.include) {
      if (!knownSet.has(testName)) {
        warnings.push(
          `Unknown smoke test '${testName}' in include. Available tests: ${KNOWN_SMOKE_TESTS.join(", ")}`
        );
      }
    }
  }

  if (smokeTests.exclude) {
    for (const testName of smokeTests.exclude) {
      if (!knownSet.has(testName)) {
        warnings.push(
          `Unknown smoke test '${testName}' in exclude. Available tests: ${KNOWN_SMOKE_TESTS.join(", ")}`
        );
      }
    }
  }

  return { warnings };
}

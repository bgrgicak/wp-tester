/**
 * WordPress Smoke Test Suite
 *
 * Provides environment validation smoke tests for wp-tester.
 */

import { startVitest, parseCLI, type Reporter } from "vitest/node";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { WPTesterConfig, ResolvedWPTesterConfig, SmokeTests } from "@wp-tester/config";
import {
  EMPTY_REPORT,
  VitestStreamingReporter,
  UnifiedStreamingReporter,
  type StreamingReporter,
} from "@wp-tester/results";
import type { Report } from "@wp-tester/results";

// These values will be replaced during the build process:
// - In src (dev): "src" and "ts"
// - In dist (prod): "dist" and "js"
const TEST_DIR = "src";
const TEST_EXT = "ts";
const CONFIG_FILE = "src/smoke-tests/vitest.config.ts";

/**
 * Smoke test category - determines when a test is applicable
 */
export type SmokeTestCategory = "wp" | "plugin" | "theme";

/**
 * Smoke test definition
 */
export interface SmokeTestDefinition {
  /** Category determines applicability (wp tests always run, plugin/theme require config) */
  category: SmokeTestCategory;
  /** Human-readable description */
  description: string;
  /** The spec file containing this test */
  specFile: string;
}

/**
 * Registry of all known smoke tests.
 * New tests can be added here without schema changes.
 */
export const SMOKE_TEST_REGISTRY: Record<string, SmokeTestDefinition> = {
  // WordPress tests (always applicable)
  wpBoot: {
    category: "wp",
    description: "WordPress boots without fatal errors",
    specFile: "wp.spec",
  },
  wpAdminLoads: {
    category: "wp",
    description: "WP Admin dashboard loads",
    specFile: "wp.spec",
  },
  wpRestApiAvailable: {
    category: "wp",
    description: "REST API responds",
    specFile: "wp.spec",
  },

  // Plugin tests (require tests.plugin to be set)
  pluginActivates: {
    category: "plugin",
    description: "Plugin activates without errors",
    specFile: "plugin.spec",
  },
  pluginDeactivates: {
    category: "plugin",
    description: "Plugin deactivates without errors",
    specFile: "plugin.spec",
  },
  pluginLoads: {
    category: "plugin",
    description: "Pages load with plugin active",
    specFile: "plugin.spec",
  },

  // Theme tests (require tests.theme to be set)
  themeActivates: {
    category: "theme",
    description: "Theme activates without errors",
    specFile: "theme.spec",
  },
  themeLoads: {
    category: "theme",
    description: "Pages load with theme active",
    specFile: "theme.spec",
  },
};

/**
 * Get all known smoke test names
 */
export function getKnownSmokeTestNames(): string[] {
  return Object.keys(SMOKE_TEST_REGISTRY);
}

/**
 * Check if a category is applicable based on config
 */
function isCategoryApplicable(
  category: SmokeTestCategory,
  config: WPTesterConfig | ResolvedWPTesterConfig
): boolean {
  switch (category) {
    case "wp":
      return true; // WP tests are always applicable
    case "plugin":
      // Plugin tests run when projectType is "plugin"
      return config.projectType === "plugin";
    case "theme":
      // Theme tests run when projectType is "theme"
      return config.projectType === "theme";
    default:
      return false;
  }
}

/**
 * Get the spec files to run based on smokeTests configuration
 */
function getSpecFilesFromSmokeTests(
  smokeTests: SmokeTests,
  config: WPTesterConfig | ResolvedWPTesterConfig
): Set<string> {
  const specFiles = new Set<string>();

  // Handle boolean
  if (typeof smokeTests === "boolean") {
    if (!smokeTests) {
      return specFiles; // Empty set - no tests
    }
    // true means run all applicable tests
    for (const [, def] of Object.entries(SMOKE_TEST_REGISTRY)) {
      if (isCategoryApplicable(def.category, config)) {
        specFiles.add(def.specFile);
      }
    }
    return specFiles;
  }

  // Handle object with include/exclude
  const { include, exclude } = smokeTests;

  if (include && include.length > 0) {
    // Only run included tests (that are applicable)
    for (const testName of include) {
      const def = SMOKE_TEST_REGISTRY[testName];
      if (def && isCategoryApplicable(def.category, config)) {
        specFiles.add(def.specFile);
      }
      // Unknown test names are silently skipped (forward compatibility)
    }
  } else if (exclude && exclude.length > 0) {
    // Run all applicable tests except excluded ones
    const excludedSpecFiles = new Set<string>();
    for (const testName of exclude) {
      const def = SMOKE_TEST_REGISTRY[testName];
      if (def) {
        excludedSpecFiles.add(def.specFile);
      }
    }
    for (const [, def] of Object.entries(SMOKE_TEST_REGISTRY)) {
      if (isCategoryApplicable(def.category, config) && !excludedSpecFiles.has(def.specFile)) {
        specFiles.add(def.specFile);
      }
    }
  } else {
    // Empty object {} means run all applicable tests (same as true)
    for (const [, def] of Object.entries(SMOKE_TEST_REGISTRY)) {
      if (isCategoryApplicable(def.category, config)) {
        specFiles.add(def.specFile);
      }
    }
  }

  return specFiles;
}

export function shouldRunSmokeTests(config: WPTesterConfig | ResolvedWPTesterConfig): boolean {
  const { tests } = config;

  // smokeTests must be explicitly set
  if (tests.smokeTests === undefined) {
    return false;
  }

  if (typeof tests.smokeTests === "boolean") {
    return tests.smokeTests;
  }

  // Object form - check if any tests would run
  const specFiles = getSpecFilesFromSmokeTests(tests.smokeTests, config);
  return specFiles.size > 0;
}

/**
 * Select test files based on test configuration
 * @param config - Full configuration (needed for projectType)
 * @returns Array of test file paths relative to package root
 * @throws Error if no test files match configuration
 */
export function selectTestFiles(
  config: WPTesterConfig | ResolvedWPTesterConfig
): string[] {
  const { tests } = config;

  // Map spec file names to full paths
  const specToPath = (specName: string): string =>
    `${TEST_DIR}/smoke-tests/${specName}.${TEST_EXT}`;

  let specFiles: Set<string>;

  // smokeTests must be explicitly set
  if (tests.smokeTests !== undefined) {
    specFiles = getSpecFilesFromSmokeTests(tests.smokeTests, config);
  } else {
    specFiles = new Set<string>();
  }

  const files = Array.from(specFiles).map(specToPath);

  if (files.length === 0) {
    throw new Error("No test files selected. Check your tests configuration.");
  }

  return files;
}

/**
 * Run WordPress smoke tests
 *
 * @param config - Resolved test configuration
 * @param vitestArgs - Additional arguments to pass to Vitest CLI
 * @param sharedReporter - Optional shared streaming reporter for unified output
 * @returns CTRF report with test results
 */
export async function runSmokeTests(
  config: ResolvedWPTesterConfig,
  vitestArgs?: string[],
  sharedReporter?: StreamingReporter
): Promise<Report> {
  // Check if any tests are configured
  if (!shouldRunSmokeTests(config)) {
    return Promise.resolve(EMPTY_REPORT);
  }

  // Get package root directory
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const packageRoot = join(__dirname, "..");

  // Select test files based on config
  const testFiles = selectTestFiles(config);

  if (testFiles.length === 0) {
    return Promise.resolve(EMPTY_REPORT);
  }

  // Determine if streaming should be enabled (default reporter is configured)
  const useStreaming = config.reporters?.default !== undefined;

  // Get filter options from config reporters (only if it's an object, not boolean)
  const filter = typeof config.reporters?.default === 'object'
    ? config.reporters.default
    : undefined;

  // Use shared reporter if provided, otherwise create a new one
  const reporter: StreamingReporter = sharedReporter ?? new UnifiedStreamingReporter({
    enabled: useStreaming,
    showSummary: false,
    filter
  });

  // Create Vitest streaming reporter wrapper
  const vitestReporter = new VitestStreamingReporter(
    "wp-tester-smoke-tests",
    reporter
  );

  // Build reporters array - use our streaming reporter
  const reporters: Reporter[] = [vitestReporter];

  // Parse all Vitest CLI arguments using Vitest's built-in parser
  // parseCLI expects "vitest" as the first argument (like process.argv)
  const parsedArgs = vitestArgs && vitestArgs.length > 0
    ? parseCLI(["vitest", ...vitestArgs], { allowUnknownOptions: true })
    : { options: {}, filter: [] };

  // Start Vitest programmatically with our streaming reporter
  // Merge parsed CLI options with our required overrides
  const vitest = await startVitest("test", parsedArgs.filter, {
    config: join(packageRoot, CONFIG_FILE),
    root: packageRoot,
    include: testFiles,
    run: true,
    reporters,
    provide: {
      config,
    },
    // Spread parsed CLI options - these will override defaults but be overridden by explicit options above
    ...parsedArgs.options,
  });

  if (!vitest) {
    throw new Error("Failed to start Vitest");
  }

  // Wait for tests to complete
  await vitest.close();

  // Get report from streaming reporter
  return reporter.getReport();
}

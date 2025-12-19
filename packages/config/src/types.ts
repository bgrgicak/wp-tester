// This file is kept for backwards compatibility.
// All types have been moved to wp-tester-config.ts
export type {
  WPTesterConfig,
  Environment,
  Tests,
  PHPUnitConfig,
  Reporter,
  Mount,
  Blueprint,
  JsonReporterOptions,
} from "./wp-tester-config";

/**
 * Individual test type that can be run.
 * Combines smoke test types (wp, plugin, theme) with PHPUnit tests.
 */
export type TestType = "wp" | "plugin" | "theme" | "phpunit";

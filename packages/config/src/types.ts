// This file is kept for backwards compatibility.
// All types have been moved to wp-tester-config.ts and resolved-types.ts
export type {
  WPTesterConfig,
  EnvironmentVariables,
  Environment,
  Tests,
  PHPUnitConfig,
  Reporter,
  Mount,
  Blueprint,
  JsonReporterOptions,
  WatchConfig,
} from "./wp-tester-config";

export type {
  ResolvedEnvironment,
  ResolvedWPTesterConfig,
} from "./resolved-types";

/**
 * Individual test type that can be run.
 * Combines smoke test types (wp, plugin, theme) with PHPUnit tests.
 */
export type TestType = "wp" | "plugin" | "theme" | "phpunit";

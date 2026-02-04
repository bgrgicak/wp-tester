// This file is kept for backwards compatibility.
// All types have been moved to wp-tester-config.ts and resolved-types.ts
export type {
  WPTesterConfig,
  EnvironmentVariables,
  Environment,
  Tests,
  SmokeTests,
  PHPUnitConfig,
  Reporters,
  BaseReporterOptions,
  DefaultReporterOptions,
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
 * - "smoke": WordPress Playground smoke tests (wp, plugin, theme based on projectType)
 * - "phpunit": PHPUnit tests
 */
export type TestType = "smoke" | "phpunit";

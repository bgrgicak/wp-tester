import type { BlueprintV1Declaration } from "@wp-playground/blueprints";
import type { Mount, Reporter, PHPUnitConfig, Tests, Environment, WPTesterConfig, TestMode, ProjectType } from "./wp-tester-config";

/**
 * Resolved PHPUnit configuration with absolute paths and required testMode.
 */
export interface ResolvedPHPUnitConfig extends Omit<PHPUnitConfig, 'testMode'> {
  /** Test mode (always defined after resolution, defaults to "unit") */
  testMode: TestMode;
}

/**
 * Resolved test configuration with resolved PHPUnit config.
 */
export interface ResolvedTests extends Omit<Tests, 'phpunit'> {
  phpunit?: ResolvedPHPUnitConfig;
  /** Allow the test suite to pass when no tests are executed */
  passWithNoTests?: boolean;
}

/**
 * Resolved blueprint with guaranteed preferredVersions.
 */
export interface ResolvedBlueprint extends Omit<BlueprintV1Declaration, 'preferredVersions'> {
  /** Preferred versions (always defined after resolution, defaults to "latest") */
  preferredVersions: Required<NonNullable<BlueprintV1Declaration['preferredVersions']>>;
}

/**
 * Resolved environment with loaded blueprint and required mounts array.
 */
export interface ResolvedEnvironment extends Omit<Environment, 'blueprint' | 'mounts' | 'env'> {
  /** Blueprint loaded from file (if it was a string path) with guaranteed preferredVersions */
  blueprint: ResolvedBlueprint;
  /** Mounts array (always defined, may be empty) */
  mounts: Mount[];
  /** Environment variables (always defined, may be empty) */
  env: Record<string, string>;
}

/**
 * Resolved config with all paths absolute and optional fields set.
 */
export interface ResolvedWPTesterConfig extends Omit<WPTesterConfig, 'projectHostPath' | 'projectVFSPath' | 'projectType' | 'reporters' | 'environments' | 'tests'> {
  /** Absolute path to project on host (always defined after resolution) */
  projectHostPath: string;
  /** VFS path determined by project type or explicit config (always defined after resolution) */
  projectVFSPath: string;
  /** Project type (always defined after resolution) */
  projectType: ProjectType;
  /** Resolved environments with loaded blueprints */
  environments: ResolvedEnvironment[];
  /** Resolved tests with absolute paths and defaults */
  tests: ResolvedTests;
  /** Reporters (always defined after resolution) */
  reporters: Reporter[];
}

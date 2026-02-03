import type { BlueprintV1Declaration } from "@wp-playground/blueprints";
import type { Mount, Tests, Environment, WPTesterConfig, TestMode, ProjectType, BaseReporterOptions } from "./wp-tester-config";

/**
 * Resolved JSON reporter options with required outputFile.
 *
 * Note: The JSON reporter always includes all tests in the output
 * regardless of any filter settings.
 */
export interface ResolvedJsonReporterOptions {
  /** Absolute path where the JSON report file will be written */
  outputFile: string;
}

/**
 * Resolved reporters configuration.
 * Supports boolean shorthand for default reporter (true = enable with defaults).
 */
export interface ResolvedReporters {
  /** Default reporter options (supports boolean shorthand: true = enable with defaults) */
  default?: boolean | BaseReporterOptions;
  /** JSON reporter options with resolved outputFile path */
  json?: ResolvedJsonReporterOptions;
}

/**
 * Resolved PHPUnit configuration with resolved paths and required testMode.
 */
export interface ResolvedPHPUnitConfig {
  /** Path to PHPUnit executable with host and VFS paths */
  phpunitPath: ResolvedPath;
  /** Path to PHPUnit configuration file with host and VFS paths */
  configPath: ResolvedPath;
  /** Path to PHPUnit bootstrap file with host and VFS paths */
  bootstrapPath?: ResolvedPath;
  /** Test mode (always defined after resolution, defaults to "unit") */
  testMode: TestMode;
  /** Additional arguments to pass to PHPUnit */
  phpunitArgs?: string[];
}

/**
 * Resolved test configuration with resolved PHPUnit config.
 */
export interface ResolvedTests extends Omit<Tests, 'phpunit' | 'watch'> {
  phpunit?: ResolvedPHPUnitConfig;
  /** Allow the test suite to pass when no tests are executed */
  passWithNoTests?: boolean;
}

/**
 * Resolved path type with a host and VFS path.
 */
export interface ResolvedPath {
  /** Absolute path on host system */
  hostPath: string;
  /** Absolute path in VFS */
  vfsPath: string;
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
export interface ResolvedEnvironment extends Omit<Environment, 'blueprint' | 'mounts' | 'env' | 'skip'> {
  /** Blueprint loaded from file (if it was a string path) with guaranteed preferredVersions */
  blueprint: ResolvedBlueprint;
  /** Mounts array (always defined, may be empty) */
  mounts: Mount[];
  /** Environment variables (always defined, may be empty) */
  env: Record<string, string>;
  /** Whether this environment should be skipped (always defined after resolution, defaults to false) */
  skip: boolean;
}

/**
 * Resolved config with all paths absolute and optional fields set.
 */
export interface ResolvedWPTesterConfig extends Omit<WPTesterConfig, 'projectHostPath' | 'projectVFSPath' | 'projectType' | 'reporters' | 'environments' | 'tests'> {
  /** Resolved project path with both host and VFS paths */
  projectPath: ResolvedPath;
  /** Project type (always defined after resolution) */
  projectType: ProjectType;
  /** Resolved environments with loaded blueprints */
  environments: ResolvedEnvironment[];
  /** Resolved tests with absolute paths and defaults */
  tests: ResolvedTests;
  /** Reporters (always defined after resolution, boolean values resolved to objects) */
  reporters: ResolvedReporters;
}

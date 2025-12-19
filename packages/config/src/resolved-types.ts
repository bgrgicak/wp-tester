import type { BlueprintV1Declaration } from "@wp-playground/blueprints";
import type { Mount, Tests, Reporter } from "./wp-tester-config";

/**
 * Resolved test environment configuration.
 * After resolveConfig() runs, all blueprints are loaded and all paths are absolute.
 */
export interface ResolvedEnvironment {
  /**
   * Optional descriptive name for this environment
   * @example "PHP 8.1 + WP 6.7"
   * @example "WooCommerce Environment"
   */
  name?: string;

  /**
   * WordPress Playground Blueprint configuration.
   * Always a BlueprintV1Declaration object after resolution.
   */
  blueprint: BlueprintV1Declaration;

  /**
   * Filesystem mounts to apply to this environment.
   * All paths are absolute after resolution.
   * Always defined (may be empty array if no mounts).
   */
  mounts: Mount[];
}

/**
 * Resolved wp-tester configuration.
 * After resolveConfig() runs, all blueprints are loaded and all paths are absolute.
 * All optional fields from WPTesterConfig are guaranteed to have values.
 */
export interface ResolvedWPTesterConfig {
  /**
   * JSON Schema reference for IDE validation and autocomplete
   */
  $schema?: string;

  /**
   * Absolute path to the project on the host filesystem.
   * All relative paths in the config are resolved from this directory.
   */
  projectHostPath: string;

  /**
   * Path to the project in the VFS (Virtual File System).
   * Determined by projectType (e.g., /wordpress/wp-content/plugins/my-plugin).
   */
  projectVFSPath: string;

  /**
   * Detected WordPress project type (always set after resolution).
   * Automatically detected during setup based on project structure.
   */
  projectType: 'plugin' | 'theme' | 'wp-content' | 'wordpress-install' | 'unknown';

  /**
   * Test environments to run.
   * Each environment can have different PHP/WordPress versions and setup.
   * Tests will run against all defined environments (matrix testing).
   * All blueprints are loaded and all paths are absolute.
   * @minItems 1
   */
  environments: ResolvedEnvironment[];

  /**
   * Test suites to execute
   */
  tests: Tests;

  /**
   * Output reporters for test results (always set after resolution).
   * @default ["default"]
   */
  reporters: Reporter[];
}

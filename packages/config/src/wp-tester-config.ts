import type { BlueprintV1Declaration } from "@wp-playground/blueprints";
import type { Mount as PlaygroundMount } from "@wp-playground/cli/mounts";
import type { ProjectType } from "./options/project-type-detect";

/**
 * Test mode - determines whether WordPress is loaded during tests
 *
 * - "unit": The WordPress test library is made available for mocking, but WordPress is NOT loaded.
 *   Use for testing isolated PHP logic, pure functions, classes that don't depend on WordPress,
 *   or when mocking WordPress functions using the WordPress test library.
 *
 * - "integration": WordPress is loaded before tests run. Use for testing
 *   WordPress APIs, hooks, database interactions, etc.
 */
export type TestMode = "unit" | "integration";

// Re-export ProjectType for convenience
export type { ProjectType };

/**
 * WordPress Playground Blueprint configuration.
 * Can be either an inline blueprint object or a file path to a blueprint JSON file.
 *
 * @see https://wordpress.github.io/wordpress-playground/blueprints/
 */
export type Blueprint = BlueprintV1Declaration | string;

/**
 * Filesystem mount configuration.
 * Maps local filesystem paths to WordPress Playground virtual filesystem.
 * Extends the base Mount type from @wp-playground/cli with additional options.
 *
 * @see https://wordpress.github.io/wordpress-playground/developers/local-development/wp-playground-cli#mounting-a-plugin-programmatically
 */
export interface Mount extends PlaygroundMount {
  /**
   * Absolute or relative path on the host filesystem to mount.
   * Relative paths are resolved from projectHostPath.
   * @example "vendor/bin/phpunit"
   * @example "/absolute/path/to/project"
   */
  hostPath: string;

  /**
   * Virtual filesystem path where the host path should be mounted.
   * @example "/wordpress/wp-content/plugins/my-plugin"
   * @example "/project"
   */
  vfsPath: string;

  /**
   * Whether to mount before WordPress installation.
   * When true, the mount happens before WordPress is installed.
   * When false or omitted, the mount happens after WordPress is fully installed and booted.
   * @default false
   */
  beforeInstall?: boolean;
}

/**
 * PHPUnit configuration for running PHP unit tests.
 */
export interface PHPUnitConfig {
  /**
   * Path to PHPUnit executable (relative to project root)
   * @example "vendor/bin/phpunit"
   */
  phpunitPath: string;

  /**
   * Path to PHPUnit configuration file (relative to project root)
   * @example "phpunit.xml"
   * @example "phpunit.xml.dist"
   */
  configPath: string;

  /**
   * Path to PHPUnit bootstrap file (relative to project root)
   * If not provided, only the custom wp-tester bootstrap will be used
   * @example "tests/bootstrap.php"
   */
  bootstrapPath?: string;

  /**
   * Test mode - determines whether WordPress is loaded during tests
   *
   * @default "unit"
   */
  testMode?: TestMode;

  /**
   * Additional arguments to pass to PHPUnit
   * @example ["--filter", "MyTest"]
   * @example ["--group", "integration"]
   */
  phpunitArgs?: string[];
}

/**
 * Test configuration specifying which test suites to run.
 */
export interface Tests {
  /**
   * Plugin slug to test.
   * When provided, runs plugin-specific tests including activation, deactivation, and load tests.
   * @example "my-awesome-plugin"
   */
  plugin?: string;

  /**
   * Theme slug to test.
   * When provided, runs theme-specific tests including activation and homepage load tests.
   * @example "my-custom-theme"
   */
  theme?: string;

  /**
   * Whether to run WordPress core tests.
   * Tests WordPress boot, admin dashboard, and REST API.
   * @default false
   */
  wp?: boolean;

  /**
   * PHPUnit test configuration.
   * When provided, runs PHPUnit tests with the specified paths.
   * When undefined, PHPUnit tests are disabled.
   */
  phpunit?: PHPUnitConfig;
}

/**
 * JSON reporter configuration options
 */
export interface JsonReporterOptions {
  /**
   * Path where the JSON report file should be written
   * @example "test-results.json"
   * @example "./output/results.json"
   */
  outputFile: string;
}

/**
 * Reporter configuration.
 * Can be a simple string for reporters without options,
 * or a tuple of [reporter name, options] for configurable reporters.
 *
 * @example "default"
 * @example ["json", { "outputFile": "results.json" }]
 */
export type Reporter = "default" | ["json", JsonReporterOptions];

/**
 * Environment variables for WordPress Playground.
 * Key-value pairs of environment variable names and values.
 * @example { "WP_DEBUG": "1", "WP_DEBUG_LOG": "1" }
 * @default {}
 */
export type EnvironmentVariables = Record<string, string>;

/**
 * Test environment configuration.
 * Defines a WordPress environment with specific versions and setup.
 */
export interface Environment {
  /**
   * Optional descriptive name for this environment
   * @example "PHP 8.1 + WP 6.7"
   * @example "WooCommerce Environment"
   */
  name?: string;

  /**
   * WordPress Playground Blueprint configuration.
   * Can be an inline blueprint object or a file path to a blueprint JSON file.
   */
  blueprint: Blueprint;

  /**
   * Filesystem mounts to apply to this environment
   * @default []
   */
  mounts?: Mount[];

  /**
   * Environment variables to set when running PHPUnit tests
   * @example { "WP_TESTS_DIR": "/custom/path" }
   * @default {}
   */
  env?: EnvironmentVariables;
}

/**
 * Complete wp-tester configuration.
 * This is the root configuration object for wp-tester.json files.
 */
export interface WPTesterConfig {
  /**
   * JSON Schema reference for IDE validation and autocomplete
   */
  $schema?: string;

  /**
   * Project root directory (host filesystem path).
   * All relative paths in the config are resolved from this directory.
   * If a relative path is provided, it is relative to the config file location.
   *
   * @default process.cwd()
   * @example "./my-project"
   */
  projectHostPath?: string;

  /**
   * Virtual filesystem path where the project is mounted.
   * This replaces the default "/wordpress" base path for custom mount configurations.
   * When not specified, will be auto-detected from projectType:
   * - plugin: /wordpress/wp-content/plugins/{dir-name}
   * - theme: /wordpress/wp-content/themes/{dir-name}
   * - wp-content: /wordpress/wp-content
   * - wordpress: /wordpress
   * - other: Must be specified explicitly
   *
   * For custom mount configurations (especially with projectType "other"),
   * specify this to indicate where the project root is in VFS.
   * @example "/project"
   * @example "/custom-wp/wp-content/plugins/my-plugin"
   */
  projectVFSPath?: string;

  /**
   * Detected WordPress project type.
   * Automatically detected during setup based on project structure.
   */
  projectType?: ProjectType;

  /**
   * Test environments to run.
   * Each environment can have different PHP/WordPress versions and setup.
   * Tests will run against all defined environments (matrix testing).
   * @minItems 1
   */
  environments: Environment[];

  /**
   * Test suites to execute
   */
  tests: Tests;

  /**
   * Output reporters for test results
   * @default ["default"]
   */
  reporters?: Reporter[];
}

import type { BlueprintV1Declaration } from "@wp-playground/blueprints";
import type { Mount as PlaygroundMount } from "@wp-playground/cli/mounts";

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
   * @example "tests/bootstrap.php"
   */
  bootstrapPath: string;
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
   * Project root directory.
   * All relative paths in the config are resolved from this directory.
   * If a relative path is provided, it is relative to the config file location.
   *
   * @default process.cwd()
   * @example "./my-project"
   */
  rootDir?: string;

  /**
   * Detected WordPress project type.
   * Automatically detected during setup based on project structure.
   */
  projectType?: 'plugin' | 'theme' | 'wp-content' | 'wordpress-install' | 'unknown';

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

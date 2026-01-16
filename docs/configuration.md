# WordPress Tester Configuration Specification

## Overview

WordPress Tester uses a JSON configuration file to define test environments, specify which tests to run, and configure output formats.

## Configuration File Location

By default, the configuration file should be named `wp-tester.json` and located in the root directory of your WordPress plugin or theme project.

## JSON Schema

wp-tester provides a JSON schema for configuration validation and IDE autocomplete. To enable schema validation in your editor, add a `$schema` property to your config file:

```json
{
  "$schema": "https://raw.githubusercontent.com/bgrgicak/wp-tester/trunk/packages/config/src/schema.json",
  "environments": [
    ...
  ]
}
```

This enables:
- Autocompletion in VS Code, IntelliJ, and other editors
- Real-time validation of your configuration
- Inline documentation for all configuration options

The schema is automatically generated from TypeScript types and kept in sync with the codebase.

## Validating Configuration

You can validate your configuration file using the CLI command:

```bash
wp-tester config validate
```

This command validates your `wp-tester.json` file against the JSON schema to ensure it's properly formatted and contains all required fields.

### Validation Options

- `--config` or `-c`: Specify a custom path to your configuration file or directory (default: `./wp-tester.json`)
  - When a directory path is provided, wp-tester will look for `wp-tester.json` within that directory
  - When a file path is provided, wp-tester will use that specific file

**Examples:**

```bash
# Validate the default configuration file
wp-tester config validate

# Validate a configuration file at a custom location
wp-tester config validate --config ./configs/prod-config.json

# Validate using a directory path (looks for wp-tester.json in the directory)
wp-tester config validate --config /path/to/project
```

The validation will check for:
- Required fields are present
- Field types match the schema
- Values are within allowed ranges or choices
- Blueprint structure is valid

If validation fails, the command will display detailed error messages indicating what needs to be fixed.

## Configuration Structure

```json
{
  "projectHostPath": "./",
  "projectVFSPath": "/wordpress/wp-content/plugins/my-plugin",
  "projectType": "plugin",
  "environments": [],
  "tests": {},
  "reporters": {}
}
```

## Configuration Options

### Project Settings

These settings control how your project is mounted and identified in the test environments.

#### `projectHostPath`

**Type:** `string`
**Required:** No
**Default:** Current working directory (where `wp-tester.json` is located)
**Description:** The local filesystem path to your project directory. All relative paths in the configuration are resolved from this directory.

**Example:**
```json
{
  "projectHostPath": "./my-project"
}
```

#### `projectVFSPath`

**Type:** `string`
**Required:** No (but required when `projectType` is `"other"`)
**Description:** The path where your project directory will be mounted in the WordPress Playground virtual filesystem.

When not specified, the path is automatically determined based on `projectType`:
- `plugin`: `/wordpress/wp-content/plugins/{directory-name}`
- `theme`: `/wordpress/wp-content/themes/{directory-name}`
- `wp-content`: `/wordpress/wp-content`
- `wordpress`: `/wordpress`
- `other`: **Required** - You must specify where your project should be mounted

**Example:**
```json
{
  "projectVFSPath": "/wordpress/wp-content/mu-plugins/my-mu-plugin"
}
```

#### `projectType`

**Type:** `"plugin" | "theme" | "wp-content" | "wordpress" | "other"`
**Required:** No
**Default:** Auto-detected during setup based on project structure
**Description:** The type of WordPress project. This determines default mounting behavior and which tests are applicable.

**Auto-detection rules:**
- `plugin`: Detected when the project root contains a PHP file with a `Plugin Name:` header
- `theme`: Detected when the project root contains a `style.css` with a `Theme Name:` header
- `wp-content`: Detected when the project structure resembles `wp-content/` directory
- `wordpress`: Detected when the project contains WordPress core files
- `other`: Used when no WordPress project type is detected

**Example:**
```json
{
  "projectType": "plugin"
}
```

### `environments`

**Type:** `Array<Environment>`
**Required:** Yes
**Description:** Defines the WordPress environments to test against. Supports matrix testing across different PHP versions, WordPress versions, and site configurations.

Each environment is an object with:
- `name` (optional string): A descriptive name for the environment
- `php` (optional string or array): PHP version(s) to test against. Can be a single version string or an array of versions for matrix testing.
- `wp` (optional string or array): WordPress version(s) to test against. Can be a single version string or an array of versions for matrix testing.
- `blueprint` (required): Either an inline WordPress Playground Blueprint object or a string path to a Blueprint JSON file
- `mounts` (optional): Array of mount configurations to map local filesystem paths into the WordPress Playground virtual filesystem
- `env` (optional object): Environment variables to set when running PHPUnit tests. Key-value pairs where both keys and values are strings.
- `skip` (optional boolean, default: false): When set to `true`, this environment will be skipped during test execution. Useful for temporarily excluding environments without removing them from the configuration file. Since JSON doesn't support comments, this provides a way to "comment out" environments.

#### Matrix Testing with Array Syntax

Instead of manually defining multiple environments for different version combinations, you can use arrays for `php` and `wp` properties to automatically generate all combinations (Cartesian product).

**Example - Matrix expansion:**

```json
{
  "environments": [
    {
      "name": "Matrix Test",
      "php": ["8.1", "8.2"],
      "wp": ["6.6", "6.7"],
      "blueprint": {}
    }
  ]
}
```

This single environment definition automatically expands into **4 test environments**:
1. Matrix Test (PHP 8.1, WP 6.6)
2. Matrix Test (PHP 8.1, WP 6.7)
3. Matrix Test (PHP 8.2, WP 6.6)
4. Matrix Test (PHP 8.2, WP 6.7)

**Key behaviors:**

- **Automatic naming**: Expanded environments receive descriptive names incorporating their version combinations (e.g., "Matrix Test (PHP 8.1, WP 6.6)")
- **Single-element arrays**: Arrays containing only one version don't add version suffixes to environment names, keeping names clean for non-matrix scenarios
- **Property preservation**: All other environment properties (mounts, env, blueprint settings) are retained across all expanded variants
- **Blueprint precedence**: When `blueprint.preferredVersions` is specified, those values override environment-level `php` and `wp` array values

**Example - Single-element array (no suffix):**

```json
{
  "environments": [
    {
      "name": "My Tests",
      "php": ["8.2"],
      "wp": ["6.7"],
      "blueprint": {}
    }
  ]
}
```

This creates a single environment named "My Tests" (without version suffix) since both arrays have only one element.

**Example - Mixed with other properties:**

```json
{
  "environments": [
    {
      "name": "Full Matrix",
      "php": ["8.1", "8.2", "8.3"],
      "wp": ["6.5", "6.6", "6.7"],
      "blueprint": {
        "features": {
          "networking": true
        }
      },
      "env": {
        "WP_DEBUG": "1"
      },
      "mounts": [
        {
          "hostPath": "./custom-plugin",
          "vfsPath": "/wordpress/wp-content/plugins/custom-plugin"
        }
      ]
    }
  ]
}
```

This generates **9 environments** (3 PHP × 3 WP versions), each with networking enabled, WP_DEBUG set, and the custom plugin mounted.

#### Traditional Environment Definition

**Example:**

```json
{
  "environments": [
    {
      "name": "PHP 8.1 + WP 6.7",
      "blueprint": {
        "preferredVersions": {
          "php": "8.1",
          "wp": "6.7"
        }
      }
    },
    {
      "blueprint": "./blueprints/custom.json",
      "mounts": [
        {
          "hostPath": ".",
          "vfsPath": "/wordpress/wp-content/plugins/my-plugin"
        }
      ]
    },
    {
      "name": "Latest versions with plugins",
      "blueprint": {
        "preferredVersions": {
          "php": "8.2",
          "wp": "6.6"
        },
        "steps": [
          {
            "step": "installPlugin",
            "pluginData": {
              "resource": "wordpress.org/plugins",
              "slug": "hello-dolly"
            }
          }
        ]
      }
    }
  ]
}
```

**Example with skipped environment:**

Use the `skip` property to temporarily skip an environment without removing it from your configuration:

```json
{
  "environments": [
    {
      "name": "PHP 8.2 + WP 6.7",
      "blueprint": {
        "preferredVersions": {
          "php": "8.2",
          "wp": "6.7"
        }
      }
    },
    {
      "name": "PHP 7.4 + WP 6.5 (temporarily skipped)",
      "skip": true,
      "blueprint": {
        "preferredVersions": {
          "php": "7.4",
          "wp": "6.5"
        }
      }
    }
  ]
}
```

**Blueprint Format:**

The Blueprint format follows the WordPress Playground Blueprint specification. See [WordPress Playground Blueprint Documentation](https://wordpress.github.io/wordpress-playground/blueprints/getting-started/) for complete details.

Common Blueprint options:
- `preferredVersions.php` - PHP version (e.g., "7.4", "8.0", "8.1", "8.2", "8.3")
- `preferredVersions.wp` - WordPress version (e.g., "6.4", "6.5", "6.6", "6.7")
- `steps` - Array of setup steps ([see documentation for available steps](https://wordpress.github.io/wordpress-playground/blueprints/steps#))

**Mounts Format:**

The `mounts` array allows you to map directories or files from your local filesystem into the WordPress Playground virtual filesystem. This is useful for mounting plugins or themes under development directly into the test environment.

Each mount object contains:
- `hostPath` (required string): Path on the host filesystem to mount from (relative to the project root or absolute)
- `vfsPath` (required string): Path in the WordPress Playground virtual filesystem to mount to (e.g., "/wordpress/wp-content/plugins/my-plugin")
- `beforeInstall` (optional boolean, default: false): When true, the mount happens before WordPress is installed. When false or omitted, the mount happens after WordPress is fully installed and booted.

**Mount Timing:**
- `beforeInstall: false` (default): Mount is applied after WordPress installation completes. This is the standard behavior for mounting plugins and themes.
- `beforeInstall: true`: Mount is applied before WordPress installation begins. Use this for files that need to be present during the WordPress installation process.

**Example with mounts:**

```json
{
  "environments": [
    {
      "name": "Development Plugin Test",
      "blueprint": {
        "preferredVersions": {
          "php": "8.2",
          "wp": "6.7"
        }
      },
      "mounts": [
        {
          "hostPath": "./my-plugin",
          "vfsPath": "/wordpress/wp-content/plugins/my-plugin"
        }
      ]
    },
    {
      "name": "Multi-mount Environment",
      "blueprint": {
        "preferredVersions": {
          "php": "8.1",
          "wp": "6.6"
        }
      },
      "mounts": [
        {
          "hostPath": "./my-plugin",
          "vfsPath": "/wordpress/wp-content/plugins/my-plugin"
        },
        {
          "hostPath": "./test-uploads",
          "vfsPath": "/wordpress/wp-content/uploads",
          "beforeInstall": true
        }
      ]
    }
  ]
}
```

See [WordPress Playground CLI mounting documentation](https://wordpress.github.io/wordpress-playground/developers/local-development/wp-playground-cli#mounting-a-plugin-programmatically) for more details on how mounting works.

**Environment Variables:**

The `env` property allows you to set environment variables that will be available during PHPUnit test execution. This is useful for configuring test behavior or passing custom settings to your test suite.

**Example with environment variables:**

```json
{
  "environments": [
    {
      "name": "Test Environment",
      "blueprint": {
        "preferredVersions": {
          "php": "8.2",
          "wp": "6.7"
        }
      },
      "env": {
        "MY_API_KEY": "test-key-123",
        "TEST_MODE": "integration",
        "DATABASE_PREFIX": "test_"
      }
    }
  ]
}
```

Environment variables set here are available in your PHPUnit tests via `getenv('MY_API_KEY')` or `$_ENV['MY_API_KEY']`.

> **Note:** To set PHP constants like `WP_DEBUG`, use the blueprint's `constants` property or `defineWpConfigConsts` step instead.

**Default Versions:**

When `preferredVersions` is not specified in a blueprint, or when individual version properties are omitted, wp-tester defaults to `"latest"` for both PHP and WordPress versions.

```json
{
  "environments": [
    {
      "name": "Latest everything",
      "blueprint": {}
    }
  ]
}
```

This is equivalent to:

```json
{
  "environments": [
    {
      "name": "Latest everything",
      "blueprint": {
        "preferredVersions": {
          "php": "latest",
          "wp": "latest"
        }
      }
    }
  ]
}
```

### `tests`

**Type:** `Object`
**Required:** Yes
**Description:** Specifies which test categories to run. WordPress Tester supports multiple test types: plugin tests, theme tests, WordPress core tests, and PHPUnit tests.

**Structure:**

```json
{
  "tests": {
    "plugin": "plugin-slug",
    "theme": "theme-slug",
    "wp": true,
    "phpunit": {
      "phpunitPath": "vendor/bin/phpunit",
      "configPath": "phpunit.xml.dist",
      "bootstrapPath": "tests/bootstrap.php"
    },
    "passWithNoTests": false
  }
}
```

**Options:**

#### `tests.passWithNoTests`

**Type:** `boolean`
**Default:** `false`
**Description:** Allow the test suite to pass when no tests are executed. By default, wp-tester exits with code 1 when no tests are found. Set to `true` to exit with code 0 instead (similar to Jest's `--passWithNoTests` flag).

This is useful in CI/CD pipelines where you want the build to pass even if no tests match the current filter or if test files haven't been created yet.

**Example:**
```json
{
  "tests": {
    "plugin": "my-plugin",
    "passWithNoTests": true
  }
}
```

This option can also be set via the CLI flag `--passWithNoTests` when running tests.

#### `tests.plugin`

**Type:** `string`
**Description:** Slug of the plugin to test. The plugin must be available in the environment. Runs all plugin-related tests including:
- Plugin activation
- Plugin deactivation
- Plugin loads without errors
- Plugin settings pages (if applicable)

**Example:**
```json
{
  "tests": {
    "plugin": "my-awesome-plugin"
  }
}
```

#### `tests.theme`

**Type:** `string`
**Description:** Slug of the theme to test. The theme must be available in the environment. Runs all theme-related tests including:
- Theme activation
- Homepage loads without errors

**Example:**
```json
{
  "tests": {
    "theme": "my-custom-theme"
  }
}
```

#### `tests.wp`

**Type:** `boolean`
**Description:** Whether to run WordPress core tests. These tests verify:
- WordPress boots successfully
- Admin dashboard loads
- REST API responds

**Example:**
```json
{
  "tests": {
    "wp": true
  }
}
```

#### `tests.phpunit`

**Type:** `PHPUnitConfig` (object)
**Required:** No
**Description:** Configuration for running PHPUnit tests in WordPress Playground environments. When provided, wp-tester will execute your PHPUnit test suite within the WordPress environment.

**Auto-detection:** During setup (`wp-tester setup`), the CLI will automatically detect PHPUnit configuration if a `phpunit.xml` or `phpunit.xml.dist` file exists in your project. It will:
1. Find the PHPUnit config file (`phpunit.xml` or `phpunit.xml.dist`)
2. Parse the bootstrap path from the config file
3. Set default paths for the PHPUnit executable
4. Prompt you to use the detected configuration, customize it, or skip

**Properties:**

- `phpunitPath` (string, required): Path to the PHPUnit executable relative to the project root. Typically `vendor/bin/phpunit` when installed via Composer.
- `configPath` (string, required): Path to the PHPUnit configuration file relative to the project root (e.g., `phpunit.xml` or `phpunit.xml.dist`).
- `bootstrapPath` (string, optional): Path to the PHPUnit bootstrap file relative to the project root (e.g., `tests/bootstrap.php`). If not provided, only the custom wp-tester bootstrap will be used.
- `testMode` (string, optional): Specifies which type of PHPUnit tests to run. Options are `"unit"` (default) or `"integration"`. See [PHPUnit Test Modes](#phpunit-test-modes) for details.
- `phpunitArgs` (array of strings, optional): Additional command-line arguments to pass to PHPUnit. For example, `["--verbose", "--stop-on-failure"]` to enable verbose output and stop on the first test failure.

**Example:**
```json
{
  "tests": {
    "phpunit": {
      "phpunitPath": "vendor/bin/phpunit",
      "configPath": "phpunit.xml.dist",
      "bootstrapPath": "tests/bootstrap.php"
    }
  }
}
```

**Example with multiple test types:**
```json
{
  "tests": {
    "plugin": "my-plugin",
    "wp": true,
    "phpunit": {
      "phpunitPath": "vendor/bin/phpunit",
      "configPath": "phpunit.xml.dist",
      "bootstrapPath": "tests/bootstrap.php",
      "testMode": "integration",
      "phpunitArgs": ["--verbose", "--stop-on-failure"]
    }
  }
}
```

**Note:** The PHPUnit tests can run inside the WordPress Playground environment, allowing you to test against the exact PHP and WordPress versions specified in your environment configuration.

#### PHPUnit Test Modes

The `testMode` option allows you to choose between different types of PHPUnit tests based on your testing needs. This feature is particularly useful when you have both unit tests (fast, isolated) and integration tests (slower, requires WordPress) in your test suite.

##### Unit Test Mode (`"unit"`)

**Default behavior.** Unit test mode runs your tests quickly without loading the full WordPress environment. This is ideal for:

- Testing isolated business logic
- Testing utility functions and classes that don't depend on WordPress
- Fast feedback during development
- CI pipelines where speed is critical

**Benefits:**
- Faster execution time
- No WordPress bootstrap overhead
- Tests run in isolation
- Suitable for TDD workflows

**Example configuration:**
```json
{
  "tests": {
    "phpunit": {
      "phpunitPath": "vendor/bin/phpunit",
      "configPath": "phpunit.xml.dist",
      "bootstrapPath": "tests/bootstrap.php",
      "testMode": "unit"
    }
  }
}
```

**When to use:** When your tests don't require WordPress functions, database access, or WordPress-specific functionality.

##### Integration Test Mode (`"integration"`)

Integration test mode runs your tests with the full WordPress environment loaded. This is essential for:

- Testing code that uses WordPress functions (e.g., `get_option()`, `wp_insert_post()`)
- Testing database operations
- Testing hooks and filters
- Testing plugin/theme functionality that depends on WordPress core

**Benefits:**
- Full WordPress environment available in tests
- Test real-world scenarios with database and WordPress APIs
- Verify integration points between your code and WordPress
- Test hooks, filters, and WordPress-specific functionality

**Example configuration:**
```json
{
  "tests": {
    "phpunit": {
      "phpunitPath": "vendor/bin/phpunit",
      "configPath": "phpunit.xml.dist",
      "bootstrapPath": "tests/bootstrap.php",
      "testMode": "integration"
    }
  }
}
```

**When to use:** When your tests need WordPress functions, database access, or any WordPress-specific functionality.

**How it works:** In integration mode, wp-tester automatically loads WordPress before your bootstrap file runs. Your bootstrap only needs to handle unit mode setup.

##### Default Behavior

If you omit the `testMode` property, it defaults to `"unit"`:

```json
{
  "tests": {
    "phpunit": {
      "phpunitPath": "vendor/bin/phpunit",
      "configPath": "phpunit.xml.dist",
      "bootstrapPath": "tests/bootstrap.php"
      // testMode defaults to "unit"
    }
  }
}
```

##### WordPress Tests Library Support

WP Tester supports the WordPress.org test suite (`wordpress-tests-lib`) for **unit tests only**, enabling existing WordPress plugins and themes to run their PHPUnit unit tests without modification.

**Important:** The WordPress test library is only supported for `testMode: "unit"`. For integration tests, use the standard WordPress installation without the test library.

**What is wordpress-tests-lib?**

The WordPress test library is the official WordPress testing framework used by WordPress core and most plugins. It provides:
- `WP_UnitTestCase` - Base test class with WordPress-specific assertions
- `WP_UnitTest_Factory` - Factory for creating test data
- Test fixtures and utilities for WordPress testing
- Mock HTTP server for REST API testing

**How it works:**

When you run PHPUnit unit tests, WP Tester automatically:
1. Detects the WordPress version from your environment configuration
2. Downloads the matching test library from GitHub
3. Mounts it in Playground at `/tmp/wordpress-tests-lib/` (standard location)
4. Generates `wp-tests-config.php` with proper database and path settings
5. Sets the `WP_TESTS_DIR` environment variable

**Cache Location:**

The WordPress test library is cached locally to avoid re-downloading for each test run:

- **Cache directory**: `~/.wp-tester/cache/test-lib/`
- **Structure**: Each WordPress version gets its own subdirectory (e.g., `~/.wp-tester/cache/test-lib/6.7.0/`)
- **Contents**: Only the `tests/phpunit/` directory from `wordpress-develop` is extracted

The cache is automatically managed and updated when a new version is requested. You can safely delete the cache directory to force a fresh download if needed.

**Your test bootstrap** only needs to handle unit mode (integration mode is handled by wp-tester):

```php
<?php
// Check for unit mode (WordPress test library)
$_tests_dir = getenv( 'WP_TESTS_DIR' );

if ( $_tests_dir && file_exists( $_tests_dir . '/includes/functions.php' ) ) {
    // Unit mode: Load WordPress test library
    require_once $_tests_dir . '/includes/functions.php';

    tests_add_filter( 'muplugins_loaded', function() {
        require dirname( __DIR__ ) . '/your-plugin.php';
    } );

    require $_tests_dir . '/includes/bootstrap.php';
}
// Note: Integration mode doesn't need bootstrap code - wp-tester loads WordPress automatically
```

**Why unit tests only?**

The WordPress test library expects to control WordPress initialization through its own bootstrap process. This works well for unit tests where the test library is the only thing loading WordPress.

However, integration tests load WordPress via `wp-load.php` before your bootstrap runs, which creates conflicts with the test library's bootstrap expectations. For integration tests, the standard WordPress installation provides a more realistic testing environment that matches production.

### `reporters`

**Type:** `Object`
**Required:** No
**Default:** `{}` (default console reporter enabled)

**Description:** Configures how test results are displayed and saved. Each reporter can have filter options to control which test statuses are shown.

**Common Filter Options:**

All reporters support these filter options:
- `passed` (boolean): Show passed tests
- `failed` (boolean): Show failed tests
- `skipped` (boolean): Show skipped tests
- `pending` (boolean): Show pending tests
- `other` (boolean): Show other test statuses

When no filter options are specified, all statuses are shown by default.

**Reporter Types:**

#### `default`

Outputs human-readable test results to the console.

**Example:**
```json
{
  "reporters": {}
}
```

Or simply omit the property to use defaults.

**With filter options (show only failed tests):**
```json
{
  "reporters": {
    "default": {
      "failed": true
    }
  }
}
```

#### `json`

Outputs test results in CTRF (Common Test Report Format) JSON format to a file.

**What is CTRF?**

[CTRF (Common Test Report Format)](https://ctrf.io/) is a standardized JSON format for test results that enables interoperability between different testing tools and CI/CD systems. The format provides a consistent structure for reporting test outcomes regardless of the underlying test framework.

CTRF reports include:
- **Summary**: Aggregate counts of passed, failed, skipped, and pending tests
- **Tests**: Detailed information about each test including name, status, duration, and failure messages
- **Tool**: Information about the test runner that generated the report

This format is particularly useful for:
- CI/CD pipeline integrations (GitHub Actions, GitLab CI, Jenkins, etc.)
- Test result aggregation across multiple test suites
- Historical test tracking and analysis
- Custom reporting dashboards

**Example:**
```json
{
  "reporters": {
    "json": {
      "outputFile": "test-results.json"
    }
  }
}
```

**Options:**
- `outputFile` (string, required): Path where the JSON file should be written

**Example CTRF output structure:**
```json
{
  "reportFormat": "CTRF",
  "specVersion": "0.0.4",
  "results": {
    "tool": {
      "name": "wp-tester"
    },
    "summary": {
      "tests": 10,
      "passed": 8,
      "failed": 1,
      "skipped": 1,
      "pending": 0,
      "other": 0,
      "start": 1704067200000,
      "stop": 1704067210000
    },
    "tests": [
      {
        "name": "Plugin activates successfully",
        "status": "passed",
        "duration": 150
      }
    ]
  }
}
```

**Default Behavior:**

When `reporters` is omitted (or `default` is `true` or omitted), console output with all statuses is shown.

**Multiple Reporters:**

You can use multiple reporters simultaneously:

```json
{
  "reporters": {
    "json": {
      "outputFile": "results.json"
    }
  }
}
```

Note: The default console reporter is enabled automatically when you add other reporters (like `json`), so you don't need to explicitly set `"default": true`.

#### `tests.watch`

**Type:** `Object`
**Required:** No
**Description:** Configures watch mode behavior when using `wp-tester test --watch`. Controls which files trigger test re-runs.

Watch mode monitors the project directory for file changes. The project directory is determined by:
- The directory containing `wp-tester.json` if no `projectHostPath` is specified
- The `projectHostPath` configuration option if specified
- When using `--config` with a directory path, the directory itself is used as the project directory

**Properties:**

##### `tests.watch.include`

**Type:** `Array<string>`
**Required:** No
**Description:** Glob patterns for files/directories to watch. If not specified, watches all files in the project directory.

**Examples:**
```json
{
  "tests": {
    "watch": {
      "include": ["src/**/*.php", "tests/**/*.php"]
    }
  }
}
```

```json
{
  "tests": {
    "watch": {
      "include": ["**/*.php", "**/*.js"]
    }
  }
}
```

##### `tests.watch.exclude`

**Type:** `Array<string>`
**Required:** No
**Default:** `["**/node_modules/**", "**/vendor/**", "**/.git/**"]`
**Description:** Glob patterns to exclude from watching. These patterns are checked before include patterns.

**Example:**
```json
{
  "tests": {
    "watch": {
      "exclude": ["vendor/**", "node_modules/**", "*.log", "coverage/**"]
    }
  }
}
```

**Complete Example:**

```json
{
  "tests": {
    "plugin": "my-plugin",
    "phpunit": {
      "phpunitPath": "vendor/bin/phpunit",
      "configPath": "phpunit.xml.dist"
    },
    "watch": {
      "include": ["src/**/*.php", "tests/**/*.php", "includes/**/*.php"],
      "exclude": ["vendor/**", "node_modules/**", "*.log"]
    }
  }
}
```

**Behavior:**

1. If `include` is specified, only files matching those patterns trigger re-runs
2. Files matching `exclude` patterns are always ignored
3. If `include` is not specified, all files (except excluded ones) trigger re-runs
4. Default excludes cover common directories that shouldn't trigger tests (node_modules, vendor, .git)

**Usage:**

```bash
# Start watch mode
wp-tester test --watch

# Watch mode with specific test type
wp-tester test --watch --test phpunit
```

## Dependencies

When your plugin or theme depends on other plugins or themes, use Blueprint steps to install them. Your project is automatically mounted and activated by wp-tester based on `tests.plugin` or `tests.theme` - you only need to configure dependencies.

### From WordPress.org

Use `installPlugin` or `installTheme` with `activate: true`:

```json
{
  "blueprint": {
    "steps": [
      {
        "step": "installPlugin",
        "pluginData": {
          "resource": "wordpress.org/plugins",
          "slug": "woocommerce"
        },
        "activate": true
      },
      {
        "step": "installTheme",
        "themeData": {
          "resource": "wordpress.org/themes",
          "slug": "storefront"
        },
        "activate": true
      }
    ]
  }
}
```

To install a specific version, use a URL:

```json
{
  "step": "installPlugin",
  "pluginData": {
    "resource": "url",
    "url": "https://downloads.wordpress.org/plugin/woocommerce.8.5.0.zip"
  },
  "activate": true
}
```

### Local Dependencies

For dependencies in your local filesystem (monorepos, sibling directories), mount them and use `activatePlugin`:

```json
{
  "environments": [
    {
      "blueprint": {
        "steps": [
          {
            "step": "activatePlugin",
            "pluginPath": "my-dependency/my-dependency.php"
          }
        ]
      },
      "mounts": [
        {
          "hostPath": "../my-dependency",
          "vfsPath": "/wordpress/wp-content/plugins/my-dependency"
        }
      ]
    }
  ],
  "tests": {
    "plugin": "my-plugin"
  }
}
```

For a complete list of available steps, see the [WordPress Playground Blueprint Steps Documentation](https://wordpress.github.io/wordpress-playground/blueprints/steps#).

## Complete Examples

### Minimal Configuration

Test a plugin with default settings:

```json
{
  "environments": [
    {
      "blueprint": {
        "preferredVersions": {
          "php": "latest",
          "wp": "latest"
        }
      }
    }
  ],
  "tests": {
    "wp": true
  }
}
```

This will:
- Run WordPress boot tests
- Output results to console

### Plugin with Matrix Testing

Test across multiple PHP and WordPress versions:

```json
{
  "environments": [
    {
      "name": "PHP 8.1 + WP 6.7",
      "blueprint": {
        "preferredVersions": {
          "php": "8.1",
          "wp": "6.7"
        }
      }
    },
    {
      "name": "PHP 8.2 + WP 6.7",
      "blueprint": "./blueprint.json"
    }
  ],
  "tests": {
    "plugin": "my-plugin",
    "wp": true
  },
  "reporters": {
    "json": {
      "outputFile": "test-results.json"
    }
  }
}
```

### Theme Testing

Test a theme with custom environment setup:

```json
{
  "environments": [
    {
      "name": "WooCommerce Environment",
      "blueprint": {
        "preferredVersions": {
          "php": "8.2",
          "wp": "6.7"
        },
        "steps": [
          {
            "step": "installPlugin",
            "pluginData": {
              "resource": "wordpress.org/plugins",
              "slug": "woocommerce"
            }
          }
        ]
      }
    }
  ],
  "tests": {
    "theme": "my-theme",
    "wp": true
  }
}
```

### Plugin with PHPUnit Tests

Test a plugin with PHPUnit integration. You can use `testMode` to control whether tests run with WordPress loaded:

```json
{
  "environments": [
    {
      "name": "PHP 8.2 + WP 6.7",
      "blueprint": {
        "preferredVersions": {
          "php": "8.2",
          "wp": "6.7"
        }
      },
      "mounts": [
        {
          "hostPath": ".",
          "vfsPath": "/wordpress/wp-content/plugins/my-plugin"
        }
      ]
    }
  ],
  "tests": {
    "plugin": "my-plugin",
    "wp": true,
    "phpunit": {
      "phpunitPath": "vendor/bin/phpunit",
      "configPath": "phpunit.xml.dist",
      "bootstrapPath": "tests/bootstrap.php",
      "testMode": "integration",
      "phpunitArgs": ["--verbose"]
    }
  },
  "reporters": {
    "json": {
      "outputFile": "test-results.json"
    }
  }
}
```

**Tip:** Use `"testMode": "unit"` for fast unit tests without WordPress, or `"testMode": "integration"` when your tests need WordPress functions and database access. You can create separate config files (e.g., `wp-tester-unit.json` and `wp-tester-integration.json`) and run them with `wp-tester test --config <file>`.

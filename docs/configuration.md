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

- `--config` or `-c`: Specify a custom path to your configuration file (default: `./wp-tester.json`)

**Examples:**

```bash
# Validate the default configuration file
wp-tester config validate

# Validate a configuration file at a custom location
wp-tester config validate --config ./configs/prod-config.json
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
  "environments": [],
  "tests": {},
  "reporters": []
}
```

## Configuration Options

### `environments`

**Type:** `Array<Environment>`
**Required:** Yes
**Description:** Defines the WordPress environments to test against. Supports matrix testing across different PHP versions, WordPress versions, and site configurations.

Each environment is an object with:
- `name` (optional string): A descriptive name for the environment
- `blueprint` (required): Either an inline WordPress Playground Blueprint object or a string path to a Blueprint JSON file
- `mounts` (optional): Array of mount configurations to map local filesystem paths into the WordPress Playground virtual filesystem
- `disabled` (optional boolean, default: false): When set to `true`, this environment will be skipped during test execution. Useful for temporarily excluding environments without removing them from the configuration file. Since JSON doesn't support comments, this provides a way to "comment out" environments.

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
            "pluginZipFile": {
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

**Example with disabled environment:**

Use the `disabled` property to temporarily skip an environment without removing it from your configuration:

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
      "name": "PHP 7.4 + WP 6.5 (temporarily disabled)",
      "disabled": true,
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
    }
  }
}
```

**Options:**

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
2. Downloads the matching test library from GitHub (cached at `~/.wp-tester/cache/test-lib/`)
3. Mounts it in Playground at `/tmp/wordpress-tests-lib/` (standard location)
4. Generates `wp-tests-config.php` with proper database and path settings
5. Sets the `WP_TESTS_DIR` environment variable

**Your test bootstrap** should reference wordpress-tests-lib normally:

```php
<?php
$_tests_dir = getenv( 'WP_TESTS_DIR' );

if ( ! $_tests_dir ) {
    $_tests_dir = rtrim( sys_get_temp_dir(), '/\\' ) . '/wordpress-tests-lib';
}

require_once $_tests_dir . '/includes/functions.php';
require $_tests_dir . '/includes/bootstrap.php';
```

**Why unit tests only?**

The WordPress test library expects to control WordPress initialization through its own bootstrap process. This works well for unit tests where the test library is the only thing loading WordPress.

However, integration tests load WordPress via `wp-load.php` before your bootstrap runs, which creates conflicts with the test library's bootstrap expectations. For integration tests, the standard WordPress installation provides a more realistic testing environment that matches production.

### `reporters`

**Type:** `Array<string | [string, Object]>`
**Required:** No
**Default:** `["default"]`

**Description:** Configures how test results are displayed and saved.

**Reporter Types:**

#### `"default"`

Outputs human-readable test results to the console.

**Example:**
```json
{
  "reporters": ["default"]
}
```

#### `["json", { "outputFile": "path/to/file.json" }]`

Outputs test results in CTRF (Common Test Report Format) JSON format to a file.

**Example:**
```json
{
  "reporters": [
    "default",
    ["json", { "outputFile": "test-results.json" }]
  ]
}
```

**Options:**
- `outputFile` (string, required): Path where the JSON file should be written

**Default Behavior:**

When `reporters` is omitted, defaults to `["default"]` (console output only).

**Multiple Reporters:**

You can use multiple reporters simultaneously:

```json
{
  "reporters": [
    "default",
    ["json", { "outputFile": "results.json" }],
    ["json", { "outputFile": "ci-results.json" }]
  ]
}
```

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
  },
  "reporters": ["default"]
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
  "reporters": [
    "default",
    ["json", { "outputFile": "test-results.json" }]
  ]
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
            "pluginZipFile": {
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
  },
  "reporters": ["default"]
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
  "reporters": [
    "default",
    ["json", { "outputFile": "test-results.json" }]
  ]
}
```

**Tip:** Use `"testMode": "unit"` for fast unit tests without WordPress, or `"testMode": "integration"` when your tests need WordPress functions and database access. You can create separate config files (e.g., `wp-tester-unit.json` and `wp-tester-integration.json`) and run them with `wp-tester test --config <file>`.

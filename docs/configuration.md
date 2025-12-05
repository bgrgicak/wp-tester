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
**Description:** Specifies which test categories to run. WordPress Tester organizes smoke tests into three categories: plugin tests, theme tests, and WordPress core tests.

**Structure:**

```json
{
  "tests": {
    "plugin": "plugin-slug",
    "theme": "theme-slug",
    "wp": true
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
    },
    "tests": {
      "wp": true
    },
    "reporters": ["default"]
  ],

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
    },
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

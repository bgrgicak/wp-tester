# WP Tester

A CLI tool for testing WordPress plugins and themes using WordPress Playground.

## Overview

WP Tester simplifies testing for WordPress plugins and themes by leveraging WordPress Playground to spin up isolated WordPress environments. Test your code across different PHP versions, WordPress versions, and configurations without complex setup.

## Key Features

- **Matrix Testing**: Test across multiple PHP and WordPress versions
- **Multiple Test Types**: Support for smoke tests, PHPUnit tests, and custom tests
- **WordPress Playground Integration**: Isolated environments with no local setup required
- **Flexible Configuration**: JSON-based configuration with IDE autocomplete support
- **Multiple Output Formats**: Console output and JSON (CTRF) reporting

## Quick Start

### Installation

```bash
npm install @wp-tester/cli
```

Or use directly with npx:

```bash
npx @wp-tester/cli --help
```

### Setup

Generate a configuration file:

```bash
npx @wp-tester/cli setup
```

This interactive setup will guide you through:
- Detecting your project type (plugin or theme)
- Choosing smoke tests to run
- Setting up PHPUnit (if detected)

### Run Tests

```bash
npx @wp-tester/cli test
```

Run specific test types:

```bash
# Run only WordPress smoke tests
npx @wp-tester/cli test --test wp

# Run only plugin tests
npx @wp-tester/cli test --test plugin

# Run only theme tests
npx @wp-tester/cli test --test theme

# Run only PHPUnit tests
npx @wp-tester/cli test --test phpunit
```

## Test Types

### Smoke Tests

Built-in tests that verify basic functionality:

- **WordPress Tests**: Verify WordPress boots, admin loads, REST API works
- **Plugin Tests**: Test activation, deactivation, and basic plugin functionality
- **Theme Tests**: Test theme activation and homepage rendering

### PHPUnit Tests

Run your existing PHPUnit test suite inside WordPress Playground environments. WP Tester automatically:
- Detects PHPUnit configuration
- Mounts your project files
- Executes tests in the configured environments
- Reports results in a unified format

## Configuration

WP Tester uses a `wp-tester.json` file to configure environments and tests.

### Minimal Example

```json
{
  "$schema": "https://raw.githubusercontent.com/bgrgicak/wp-tester/trunk/packages/config/src/schema.json",
  "environments": [
    {
      "name": "Latest versions",
      "blueprint": {
        "preferredVersions": {
          "php": "8.2",
          "wp": "6.7"
        }
      }
    }
  ],
  "tests": {
    "plugin": "my-plugin",
    "wp": true
  }
}
```

### Matrix Testing Example

Test across multiple environments:

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
      "blueprint": {
        "preferredVersions": {
          "php": "8.2",
          "wp": "6.7"
        }
      }
    }
  ],
  "tests": {
    "plugin": "my-plugin",
    "wp": true,
    "phpunit": {
      "phpunitPath": "vendor/bin/phpunit",
      "configPath": "phpunit.xml.dist",
      "bootstrapPath": "tests/bootstrap.php"
    }
  },
  "reporters": [
    "default",
    ["json", { "outputFile": "test-results.json" }]
  ]
}
```

See [Configuration Documentation](configuration.md) for complete details.

## CLI Commands

### `setup`

Interactive setup wizard to create `wp-tester.json`:

```bash
wp-tester setup
```

### `test`

Run tests defined in your configuration:

```bash
# Run all tests
wp-tester test

# Run specific test type
wp-tester test --test wp
wp-tester test --test plugin
wp-tester test --test theme
wp-tester test --test phpunit

# Use custom config file
wp-tester test --config custom-config.json

# Use config from a directory (looks for wp-tester.json in the directory)
wp-tester test --config /path/to/project

# Watch mode - re-run tests on file changes
wp-tester test --watch
```

#### Watch Mode

Use `--watch` (or `-w`) to automatically re-run tests when files change:

```bash
wp-tester test --watch
```

In watch mode:
- Tests run immediately on startup
- File changes trigger automatic re-runs (with 300ms debounce)
- Press **Enter** to manually re-run tests
- Press **q** to quit

Configure which files to watch in `wp-tester.json`:

```json
{
  "tests": {
    "watch": {
      "include": ["src/**/*.php", "tests/**/*.php"],
      "exclude": ["vendor/**", "node_modules/**"]
    }
  }
}
```

See [Watch Configuration](configuration.md#watch) for details.

### `config validate`

Validate your configuration file:

```bash
# Validate default config
wp-tester config validate

# Validate custom config file
wp-tester config validate --config custom-config.json

# Validate config in a directory (looks for wp-tester.json)
wp-tester config validate --config /path/to/project
```

### `config <option>`

View or validate specific configuration options:

```bash
wp-tester config project-type
wp-tester config project-root
wp-tester config phpunit
wp-tester config smoke-tests
```

## Packages

WP Tester is built as a monorepo with specialized packages:

- **[@wp-tester/cli](https://github.com/bgrgicak/wp-tester/tree/trunk/packages/cli)**: Main CLI tool for running tests
- **[@wp-tester/config](https://github.com/bgrgicak/wp-tester/tree/trunk/packages/config)**: Configuration management (types, schema, validation)
- **[@wp-tester/runtime](https://github.com/bgrgicak/wp-tester/tree/trunk/packages/runtime)**: Test runtime for WordPress Playground
- **[@wp-tester/smoke-tests](https://github.com/bgrgicak/wp-tester/tree/trunk/packages/smoke-tests)**: Built-in smoke test suite
- **[@wp-tester/phpunit](https://github.com/bgrgicak/wp-tester/tree/trunk/packages/phpunit)**: PHPUnit integration and runner
- **[@wp-tester/results](https://github.com/bgrgicak/wp-tester/tree/trunk/packages/results)**: Test result processing and reporting

## Use Cases

### Plugin Development

Test your plugin across WordPress and PHP versions before release:

```json
{
  "environments": [
    { "blueprint": { "preferredVersions": { "php": "8.0", "wp": "6.4" } } },
    { "blueprint": { "preferredVersions": { "php": "8.1", "wp": "6.5" } } },
    { "blueprint": { "preferredVersions": { "php": "8.2", "wp": "6.7" } } }
  ],
  "tests": {
    "plugin": "my-plugin",
    "phpunit": {
      "phpunitPath": "vendor/bin/phpunit",
      "configPath": "phpunit.xml",
      "bootstrapPath": "tests/bootstrap.php"
    }
  }
}
```

### Theme Development

Verify theme compatibility with different WordPress versions:

```json
{
  "environments": [
    { "blueprint": { "preferredVersions": { "wp": "6.6" } } },
    { "blueprint": { "preferredVersions": { "wp": "6.7" } } }
  ],
  "tests": {
    "theme": "my-theme",
    "wp": true
  }
}
```

### CI/CD Integration

Generate machine-readable reports for CI pipelines:

```json
{
  "reporters": [
    "default",
    ["json", { "outputFile": "test-results.json" }]
  ]
}
```

## Requirements

- Node.js 18 or higher
- npm or yarn

WordPress Playground handles all WordPress and PHP requirements automatically.

## License

GPL-2.0

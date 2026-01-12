# WP Tester

A CLI tool for testing WordPress plugins and themes using WordPress Playground.

**[Documentation](https://bgrgicak.github.io/wp-tester/)**

## Quick Start

```bash
# Install as dev dependency (recommended)
npm install --save-dev @wp-tester/cli

# Setup and run tests
wp-tester setup
wp-tester test
```

Or run directly without installing:

```bash
npx @wp-tester/cli@latest setup
```

See the [Installation Guide](docs/README.md#installation) for details on when to use each approach.

## Features

- **Matrix Testing** - Test across multiple PHP and WordPress versions
- **Multiple Test Types** - Smoke tests, PHPUnit tests, and custom tests
- **WordPress Playground** - Isolated environments with no local setup
- **Flexible Configuration** - JSON-based with IDE autocomplete support

## Documentation

- **[Getting Started](docs/README.md)** - Installation, setup, and basic usage
- **[Configuration](docs/configuration.md)** - Complete configuration reference
- **[Development](docs/development.md)** - Contributing and development setup

## Example Configuration

```json
{
  "$schema": "https://raw.githubusercontent.com/bgrgicak/wp-tester/trunk/packages/config/src/schema.json",
  "environments": [
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
    "wp": true
  }
}
```

See [Configuration Documentation](docs/configuration.md) for more examples.

## License

GPL-2.0
# WP Tester

## Overview

A CLI tool to simplify testing for WordPress plugin and themes built with WordPress Playground.

WordPress Tester leverages WordPress Playground's ability to quickly spin up WordPress environments with specific Blueprint configurations, making matrix testing across different WordPress, PHP, and site configurations straightforward.

## Packages

This is a monorepo containing the following packages:

- **[@wp-tester/cli](packages/cli/)** - Main CLI tool for running WordPress tests
- **[@wp-tester/config](packages/config/)** - Configuration management library (types, schema, file operations)
- **[@wp-tester/runtime](packages/runtime/)** - Test runtime for WordPress Playground environments
- **[@wp-tester/smoke-tests](packages/smoke-tests/)** - WordPress smoke test suite for environment validation

## Installation

```bash
# Install the CLI
npm install @wp-tester/cli

# Or use directly with npx
npx @wp-tester/cli test
```

The `@wp-tester/config` package can also be used directly in your projects for configuration management:

```bash
npm install @wp-tester/config
```

## Basic usage (NOT IMPLEMENTED YET)

```bash
# Setup configuration
npx @wp-tester/cli setup
```

```bash
# Run tests
npx @wp-tester/cli test
```

## Configuration

### Schema Support

Enable IDE autocomplete and validation by adding the schema reference:

```json
{
  "$schema": "https://raw.githubusercontent.com/bgrgicak/wp-tester/trunk/packages/config/src/schema.json",
  "environments": [...]
}
```

### Validation

Validate your configuration file:

```bash
npx @wp-tester/cli config validate
```

See [docs/configuration.md](docs/configuration.md) for complete configuration reference.

## Development

```bash
### Install dependencies
npm install

### Build all packages
npm run build

### Run CLI in development mode
npm run cli -- --help

### Run built CLI
node packages/cli/dist/cli/cli.js --help
```
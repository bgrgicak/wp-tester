# WordPress Tester

A CLI tool to simplify testing for WordPress plugins and themes built with WordPress Playground

## Overview

WordPress Tester leverages WordPress Playground's ability to quickly spin up WordPress environments with specific Blueprint configurations, making matrix testing across different WordPress, PHP, and site configurations straightforward.

## Basic usage (NOT IMPLEMENTED YET)

```bash
# Setup configuration
npx wp-tester setup
```

```bash
# Run tests
npx wp-tester test
```

## Configuration

### Schema Support

Enable IDE autocomplete and validation by adding the schema reference:

```json
{
  "$schema": "https://raw.githubusercontent.com/bgrgicak/wp-tester/trunk/public/schema.json",
  "environments": [...]
}
```

### Validation

Validate your configuration file:

```bash
wp-tester config validate
```

See [docs/configuration.md](docs/configuration.md) for complete configuration reference.

## Development

```bash
# Build the project
npm run build
```

```bash
# Run in development mode with auto-rebuild
npm run dev -- --help
```

```bash
# Run dist version
npm run dist -- --help
```

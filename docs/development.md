# Development

This guide covers setting up the WP Tester monorepo for development.

## Prerequisites

- Node.js 18 or higher
- npm or yarn

## Setup

### Install Dependencies

```bash
npm install
```

This will install dependencies for all packages in the monorepo.

### Build All Packages

```bash
npm run build
```

Uses Nx to build all packages in the correct dependency order.

## Development Workflow

### Running the CLI in Development

Run the CLI directly from source without building:

```bash
npm run cli -- --help
```

Examples:

```bash
# Run setup command
npm run cli -- setup

# Run tests with custom config
npm run cli -- test --config path/to/config.json

# Validate configuration
npm run cli -- config validate
```

### Running the Built CLI

After building, you can test the built output:

```bash
node packages/cli/dist/cli/cli.js --help
```

## Testing

### Run All Tests

```bash
npm test
```

This runs both type checking and unit tests.

### Run Only Unit Tests

```bash
npm run test:unit
```

### Run Only Type Checking

```bash
npm run test:types
```

### Run Tests for a Specific Package

```bash
# Using Nx directly
npx nx test @wp-tester/config
npx nx test @wp-tester/cli
npx nx test @wp-tester/smoke-tests
```

## Linting

### Check for Issues

```bash
npm run lint
```

### Auto-fix Issues

```bash
npm run lint:fix
```

## Documentation

### Serve Documentation Locally

```bash
npm run docs:serve
```

Visit http://localhost:3000 to view the documentation.

### Serve and Open in Browser

```bash
npm run docs:dev
```

## Publishing

```bash
# 1. Test everything works
npm test

# 2. Dry run to check what will be published
npm run publish:dry-run

# 3. Publish to npm
npm run publish
```

### Update Version

```bash
# Patch release (0.0.1 -> 0.0.2)
npm version patch --workspaces

# Minor release (0.0.1 -> 0.1.0)
npm version minor --workspaces

# Major release (0.0.1 -> 1.0.0)
npm version major --workspaces
```

## Contributing

When contributing to WP Tester:

1. Write tests for new features
2. Update documentation as needed
3. Run linting and tests before committing
4. Follow the existing code style
5. Update the JSON schema if modifying configuration types

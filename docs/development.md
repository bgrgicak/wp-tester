# Development

> **Note for Users:** This guide is for **project contributors** who want to develop WP Tester itself. If you're looking to use WP Tester for testing your WordPress plugins or themes, see the [Getting Started guide](/) instead.

This guide covers setting up the WP Tester monorepo for development.

## Prerequisites

- Node.js 18 or higher
- npm or yarn

## Isolated Development Environment (Optional)

For a safe isolated development environment where you can run Claude Code with `--dangerously-skip-permissions`, this project includes a Vagrant configuration. This approach is based on [Running Claude Code Dangerously Safely](https://blog.emilburzo.com/2026/01/running-claude-code-dangerously-safely/) by Emil Burzo.

### Why Use Vagrant?

Running Claude Code with unrestricted permissions in a VM provides:
- Full VM isolation (no shared kernel with your host system)
- Easy to nuke and rebuild if something goes wrong
- Shared folders that make it feel like local development
- Protection against accidental filesystem damage

### Requirements

- [Vagrant](https://www.vagrantup.com/downloads)
- [VirtualBox](https://www.virtualbox.org/wiki/Downloads)

### Quick Start

```bash
# Start the VM (first run will download Ubuntu and install dependencies)
vagrant up

# Connect to the VM
vagrant ssh

# Navigate to your project (auto-synced from host)
cd /agent-workspace

# Run Claude Code without permission prompts
claude --dangerously-skip-permissions
```

### VM Management

```bash
# Suspend the VM (preserves state, recommended when done)
vagrant suspend

# Resume a suspended VM
vagrant up

# Stop the VM completely
vagrant halt

# Destroy and rebuild (fresh environment)
vagrant destroy
vagrant up
```

For complete Vagrant usage instructions, see [VAGRANT.md](../VAGRANT.md).

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

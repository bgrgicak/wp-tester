# Compatibility Tests

This directory contains compatibility tests that verify wordpress-tests-lib support by running PHPUnit tests from external WordPress plugins and WordPress core itself.

These tests are **excluded from regular test runs** and must be run separately.

## Running the Tests

```bash
# Run all compatibility tests
npm run test:compatibility --workspace=@wp-tester/phpunit

# Run a specific plugin test
npm run test:compatibility --workspace=@wp-tester/phpunit -- -t "Friends"

# Run only WordPress core tests
npm run test:compatibility --workspace=@wp-tester/phpunit -- -t "WordPress Core"
```

## Test Configuration

### Plugin Tests

Plugin tests are configured in `wp-test-lib-compatibility.spec.ts` using the `PLUGINS_TO_TEST` array. Each plugin configuration includes:

- `name`: Display name for the test
- `repo`: GitHub repository in `owner/repo` format
- `branch`: Git branch to test (default: `main`)
- `setupCommands`: Commands to run after cloning (e.g., `composer install`)
- `phpunit`: PHPUnit configuration object with paths and arguments
- `expectedMinTests`: Minimum number of tests we expect to run
- `allowedFailures`: Number of test failures we tolerate (for known compatibility issues)

### WordPress Core Tests

WordPress core tests are configured using the `CORE_TO_TEST` array. Core tests require special handling because:

1. They need the WordPress source (`src/`) mounted at `/wordpress/`
2. They need the entire repository mounted for access to `vendor/` and test files
3. They ARE the wordpress-tests-lib (the tests we test plugins against)

Core test configuration includes:

- `name`: Display name for the test
- `repo`: GitHub repository (WordPress/wordpress-develop)
- `branch`: Git branch to test (default: `trunk`)
- `srcPath`: Path to WordPress source within the repo (e.g., `src`)
- `testsPath`: Path to tests directory (e.g., `tests/phpunit`)
- `phpunitPath`: Path to PHPUnit executable
- `phpunitConfigPath`: Path to PHPUnit config file
- `phpunitArgs`: Additional PHPUnit arguments (e.g., filters for specific test groups)
- `expectedMinTests`: Minimum number of tests we expect to run
- `allowedFailures`: Number of test failures we tolerate

**Note**: Tests have no timeout limit (set to 0 in `vitest.config.ts`) to accommodate large test suites.

## Adding New Plugins

To test a new plugin:

1. Add a new configuration object to the `PLUGINS_TO_TEST` array
2. Ensure the plugin has a `phpunit.xml` or `phpunit.xml.dist` file
3. Run the test to verify it works
4. Adjust `allowedFailures` if there are known compatibility issues

Example:

```typescript
{
  name: 'My Plugin',
  repo: 'username/my-plugin',
  branch: 'main',
  setupCommands: [
    'composer install --no-interaction --prefer-dist --ignore-platform-reqs'
  ],
  phpunit: {
    phpunitPath: 'vendor/bin/phpunit',
    configPath: 'phpunit.xml.dist',
  },
  expectedMinTests: 10,
  allowedFailures: 0
}
```

## Adding Core Test Configurations

To add a new WordPress core test configuration (e.g., testing a specific branch):

```typescript
{
  name: "WordPress Core Beta",
  repo: "WordPress/wordpress-develop",
  branch: "6.8",
  dirName: "wordpress-develop-6.8",
  setupCommands: [
    "composer install --no-interaction --prefer-dist --ignore-platform-reqs",
  ],
  srcPath: "src",
  testsPath: "tests/phpunit",
  phpunitPath: "vendor/bin/phpunit",
  phpunitConfigPath: "tests/phpunit/phpunit.xml.dist",
  phpunitArgs: [
    "--testsuite", "default",
    "--group", "option,meta,query",
  ],
  expectedMinTests: 200,
  allowedFailures: 50,
}
```

# Compatibility Tests

This directory contains compatibility tests that verify wordpress-tests-lib support by running PHPUnit tests from external WordPress plugins.

These tests are **excluded from regular test runs** and must be run separately.

## Running the Tests

```bash
# Run compatibility tests
npm run test:compatibility --workspace=@wp-tester/phpunit

# Run a specific plugin test
npm run test:compatibility --workspace=@wp-tester/phpunit -- -t "Friends"
```

## Test Configuration

Tests are configured in `wp-test-lib-compatibility.spec.ts` using the `PLUGINS_TO_TEST` array. Each plugin configuration includes:

- `name`: Display name for the test
- `repo`: GitHub repository in `owner/repo` format
- `branch`: Git branch to test (default: `main`)
- `setupCommands`: Commands to run after cloning (e.g., `composer install`)
- `phpunitConfig`: Path to PHPUnit configuration file
- `expectedMinTests`: Minimum number of tests we expect to run
- `allowedFailures`: Number of test failures we tolerate (for known compatibility issues)

**Note**: Tests have no timeout limit (set to 0 in `vitest.config.ts`) to accommodate large test suites like AMP which has 2841 tests.

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
  phpunitConfig: 'phpunit.xml.dist',
  expectedMinTests: 10,
  allowedFailures: 0
}
```

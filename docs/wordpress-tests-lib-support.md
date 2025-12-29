# WordPress Tests Library Support

WP Tester supports the WordPress.org test suite (wordpress-tests-lib) for **unit tests only**, enabling existing WordPress plugins and themes to run their PHPUnit unit tests without modification.

## Important: Unit Tests Only

**The WordPress test library is only supported for unit tests (`testMode: "unit"`).**

For integration tests (`testMode: "integration"`), use standard WordPress installation without the test library. Integration tests load WordPress via `wp-load.php` and run against a fully initialized WordPress environment.

## What is wordpress-tests-lib?

The WordPress test library (`wordpress-tests-lib`) is the official WordPress testing framework used by WordPress core and most WordPress plugins. It provides:

- `WP_UnitTestCase` - Base test class with WordPress-specific assertions
- `WP_UnitTest_Factory` - Factory for creating test data
- Test fixtures and utilities for WordPress testing
- Mock HTTP server (`Spy_REST_Server`) for REST API testing

## How It Works

When you run PHPUnit **unit tests** with WP Tester, it automatically:

1. **Detects WordPress version** - Based on the environment's WordPress version
2. **Downloads test library** - Fetches the matching version from GitHub (cached at `~/.wp-tester/cache/test-lib/`)
3. **Mounts in Playground** - Makes it available at `/tmp/wordpress-tests-lib/` (standard location)
4. **Creates config** - Generates `wp-tests-config.php` with proper database and path settings
5. **Sets WP_TESTS_DIR** - Provides environment variable so your bootstrap can find the test library

## Usage

Configure your tests with `testMode: "unit"`:

```typescript
{
  "tests": {
    "phpunit": {
      "configPath": "./phpunit.xml",
      "testMode": "unit"  // Required for wordpress-tests-lib support
    }
  }
}
```

Your test bootstrap should reference wordpress-tests-lib normally:

```php
<?php
$_tests_dir = getenv( 'WP_TESTS_DIR' );

if ( ! $_tests_dir ) {
    $_tests_dir = rtrim( sys_get_temp_dir(), '/\\' ) . '/wordpress-tests-lib';
}

require_once $_tests_dir . '/includes/functions.php';
require $_tests_dir . '/includes/bootstrap.php';
```

## Why Unit Tests Only?

The WordPress test library expects to control WordPress initialization through its own bootstrap process. This works well for unit tests where the test library is the only thing loading WordPress.

However, integration tests in WP Tester load WordPress via `wp-load.php` before the user's bootstrap runs. This creates conflicts:

1. WordPress hooks fire in the wrong order
2. Plugins that use lazy loading (via action hooks) may not initialize correctly
3. The test library's bootstrap expects WordPress to not be loaded yet

For integration tests, the standard WordPress installation provides a more realistic testing environment that matches production.

# Regression Testing

WP Tester includes built-in regression testing that compares test results against a saved snapshot to detect regressions.

## Overview

Regression testing helps you catch when previously passing tests start failing. Instead of failing when any test fails, regression mode only fails when a test that was passing in the snapshot now fails.

This is useful for:
- Tracking known failures while preventing new ones
- CI pipelines where some tests are expected to fail
- Gradual test suite improvements

## Usage

### Basic Regression Testing

Run tests with the `--regression` flag:

```bash
wp-tester test --regression
```

On the first run, this captures a snapshot of your test results. On subsequent runs, it compares against the snapshot:

- **Regressions**: Tests that passed in the snapshot but now fail (causes build failure)
- **Improvements**: Tests that failed in the snapshot but now pass (informational)
- **No change**: Tests with same status as snapshot (ignored)

### Clearing the Snapshot

To reset the snapshot with current results:

```bash
wp-tester test --regression --clear
```

This is useful when:
- You've fixed tests and want to update the snapshot
- You've intentionally changed behavior
- You want to start fresh

### Combining with Test Filters

Regression testing works with test type filters:

```bash
# Snapshot for WordPress smoke tests only
wp-tester test --test wp --regression

# Snapshot for PHPUnit tests only
wp-tester test --test phpunit --regression

# Snapshot for PHPUnit with specific filter
wp-tester test --test phpunit --regression -- --filter=UnitTests
```

Each unique test command maintains its own snapshot, so `--test wp` and `--test phpunit` have separate snapshots.

## How It Works

### Snapshot Storage

Snapshots are stored in `~/.wp-tester/results/` with a directory structure based on:
- Project path (hashed)
- Test signature (test type + arguments, hashed)

```
~/.wp-tester/results/<project-hash>/<signature-hash>/
├── latest.json      # Most recent test run
└── snapshot.json    # Saved snapshot for comparison
```

### Comparison Logic

When comparing current results to the snapshot:

| Snapshot Status | Current Status | Result |
|----------------|----------------|--------|
| passed | failed | **Regression** (fails build) |
| failed | passed | Improvement (informational) |
| failed | failed | No change (ignored) |
| passed | passed | No change (ignored) |
| (new test) | failed | **Regression** (fails build) |
| (new test) | passed | No change (ignored) |
| failed | (removed) | Improvement (informational) |

### Exit Codes

- `0`: No regressions detected
- `1`: Regressions detected

## Examples

### CI Pipeline Integration

Use regression testing in CI to prevent new failures while allowing known ones:

```yaml
# GitHub Actions example
- name: Run regression tests
  run: npx wp-tester test --regression
```

### Updating Snapshot After Fixes

When you've fixed failing tests:

```bash
# Clear and capture new snapshot
wp-tester test --regression --clear
```

### Separate Snapshots for Different Test Suites

```bash
# These maintain separate snapshots
wp-tester test --test wp --regression
wp-tester test --test phpunit --regression
wp-tester test --test phpunit --regression -- --filter=Integration
```

## Output

When regressions are detected:

```
Snapshot Comparison:

  ✗ 2 regression(s) found:
    • Test_Feature::test_something
      Expected true, got false
    • Test_Other::test_another

  ✓ 1 improvement(s):
    • Test_Fixed::test_was_broken (fixed)

  ✗ Regressions detected - failing build
```

When no regressions:

```
Snapshot Comparison:

  ✓ 1 improvement(s):
    • Test_Fixed::test_was_broken (fixed)

  ✓ No regressions detected
```

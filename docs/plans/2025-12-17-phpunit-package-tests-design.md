# PHPUnit Package Test Suite Design

**Date:** 2025-12-17
**Status:** Draft

## Overview

Add comprehensive test coverage for the `@wp-tester/phpunit` package using real integration tests (no mocking). Tests will use the existing test fixtures from `@wp-tester/test-fixtures` and real Playground instances.

## Test Organization

Three test files covering the three main modules:

1. **tests/detect.spec.ts** - PHPUnit detection and config parsing
2. **tests/parser.spec.ts** - PHPUnit JSON log to CTRF conversion
3. **tests/runner.spec.ts** - End-to-end PHPUnit execution in Playground

## 1. Detection Tests (tests/detect.spec.ts)

### Purpose
Test PHPUnit configuration file discovery, bootstrap path parsing, and project detection.

### Test Cases

**findPhpUnitConfig:**
- Find `phpunit.xml.dist` in plugin fixture
- Find `phpunit.xml.dist` in theme fixture
- Return null when no config exists (using temp directory)

**parseBootstrapPath:**
- Parse bootstrap path from plugin `phpunit.xml.dist`
- Parse bootstrap path from theme `phpunit.xml.dist`
- Return null for non-existent config file
- Return null for config without bootstrap attribute (using temp directory)

**detectPhpUnit:**
- Detect PHPUnit in plugin fixture (should return true)
- Detect PHPUnit in theme fixture (should return true)
- Return false when no PHPUnit setup exists (using temp directory)

### Testing Strategy
- Use real fixture projects from `@wp-tester/test-fixtures`
- Create temporary directories for negative test cases
- Clean up temp directories after tests

## 2. Parser Tests (tests/parser.spec.ts)

### Purpose
Test conversion of PHPUnit JSON log output to CTRF format.

### Test Cases

**Basic parsing:**
- Parse passing test output (verify status, duration, name)
- Parse failing test output (verify status, message, trace)
- Parse skipped test output (verify status, message)
- Parse test error output (verify status, error message formatting)

**Multiple tests:**
- Parse output with multiple tests (mixed pass/fail)
- Verify summary counts (tests, passed, failed, skipped)

**Edge cases:**
- Handle empty output (return empty report with zero counts)
- Skip invalid JSON lines (continue parsing valid lines)

**Tool naming:**
- Include environment name when provided
- Use default tool name when no environment provided

### Testing Strategy
- Use real PHPUnit JSON log samples as test input
- Verify CTRF format structure and values
- Test all PHPUnit event types: test, pass, fail, error, skipped

## 3. Runner Integration Tests (tests/runner.spec.ts)

### Purpose
Test end-to-end PHPUnit execution in WordPress Playground using real fixtures.

### Test Cases

**shouldRunPhpUnitTests:**
- Return true when `config.tests.phpunit === true`
- Return false when `config.tests.phpunit` is false/undefined

**runPhpUnitTests with plugin:**
- Run PHPUnit tests from plugin fixture
- Verify CTRF report is generated (once parser is wired up)
- Verify tests were actually executed
- Verify bootstrap file loading works

**runPhpUnitTests with theme:**
- Run PHPUnit tests from theme fixture
- Verify CTRF report is generated (once parser is wired up)
- Verify tests were actually executed
- Verify bootstrap file loading works

**Configuration handling:**
- Return EMPTY_REPORT when `tests.phpunit` is false
- Return EMPTY_REPORT when no PHPUnit config found

**Error handling:**
- Handle missing phpunit.xml gracefully
- Handle PHPUnit execution failures

### Testing Strategy
- Use `TEST_PLUGIN_CONFIG_PATH` and `TEST_THEME_CONFIG_PATH` from fixtures
- Spin up real Playground instances (like smoke-tests do)
- Set 60s timeout for Playground boot time
- Verify actual test execution via report contents

## Test File Structure

```
packages/phpunit/
├── src/
│   ├── detect.ts
│   ├── parser.ts
│   ├── runner.ts
│   └── index.ts
├── tests/
│   ├── detect.spec.ts
│   ├── parser.spec.ts
│   └── runner.spec.ts
└── vitest.config.ts
```

## Dependencies

Tests will use:
- `@wp-tester/test-fixtures` - Plugin and theme fixtures with real PHPUnit tests
- `vitest` - Test framework (already installed)
- `fs/promises` - For temp directory creation/cleanup
- `os.tmpdir()` - For temporary test directories

## Success Criteria

- All three test files pass successfully
- Tests use real fixtures and Playground (no mocking)
- Coverage of all exported functions
- Tests run in reasonable time (<2 minutes total)
- CI/CD pipeline passes

## Implementation Notes

1. **Detection tests** are fast (filesystem operations only)
2. **Parser tests** are fast (pure logic, no I/O)
3. **Runner tests** are slow (Playground boot ~10-30s per test)
   - Use test fixtures that already have PHPUnit tests
   - Set appropriate timeouts (60s)
   - Follow patterns from smoke-tests integration tests

## Future Enhancements

Once the runner properly wires up the parser to return real CTRF reports:
- Add more specific assertions on report content
- Test various PHPUnit failure scenarios
- Test custom bootstrap file generation logic
- Test path resolution for different project structures

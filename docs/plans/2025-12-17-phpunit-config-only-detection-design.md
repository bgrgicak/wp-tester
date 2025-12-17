# PHPUnit Detection Based Only on Config Files

**Date:** 2025-12-17
**Status:** Approved

## Overview

Simplify PHPUnit test detection to only check for configuration files (`phpunit.xml` or `phpunit.xml.dist`). Remove composer.json dependency checking entirely.

## Core Principle

PHPUnit tests are detected and enabled **only** when a PHPUnit configuration file exists. No `composer.json` checking, no auto-generation, no prompts.

**Rationale:**
- Config file presence = explicit opt-in to PHPUnit testing
- Simpler detection logic (no multi-signal heuristics)
- Clearer user expectations (if you want PHPUnit tests, add the config)
- Aligns with PHPUnit's own behavior (it looks for these files by default)
- Reduces barriers for new users (no confusing errors about missing config)

## Behavior Matrix

| Scenario | Has phpunit.xml | Has composer phpunit | Behavior |
|----------|----------------|---------------------|----------|
| 1 | ✅ | ✅ | Run PHPUnit tests |
| 2 | ✅ | ❌ | Run PHPUnit tests (will fail at runtime if vendor/bin/phpunit missing) |
| 3 | ❌ | ✅ | Skip PHPUnit tests (no error, treated as not having PHPUnit) |
| 4 | ❌ | ❌ | Skip PHPUnit tests |

## Detection Logic Changes

**File:** `packages/config/src/options/phpunit-detect.ts`

**Current state:**
- `detectPhpUnit()` checks both config files AND composer.json
- `hasPhpUnitComposerDependency()` reads and parses composer.json
- Returns true if either exists

**New behavior:**
- Remove `hasPhpUnitComposerDependency()` function entirely
- Remove `ComposerJson` interface
- `detectPhpUnit()` only calls `hasPhpUnitConfig()`
- Simpler: config file exists = PHPUnit enabled, otherwise disabled

## Configuration Integration

**File:** `packages/config/src/options/phpunit.ts`

**No changes needed** - Still uses `detectPhpUnit()` for auto-detection. Since `detectPhpUnit()` now only checks config files, the behavior automatically becomes stricter.

**User override behavior:**
- Users can explicitly set `tests.phpunit: false` in wp-tester.json to disable even if config exists
- Users CANNOT enable PHPUnit if no config file exists (detection returns false)

**File:** `packages/config/src/types.ts`

**No changes needed** - The `phpunit?: boolean` type already supports the auto-detection pattern.

## Runtime Behavior

**File:** `packages/phpunit/src/runner.ts`

**Current behavior (lines 34-38):**
- Calls `findPhpUnitConfig()` and returns `EMPTY_REPORT` if not found
- This is already a safety check at runtime

**New behavior:**
- Keep this check as-is (defensive programming)
- With the new detection logic, we shouldn't reach this point without a config file
- But if we do (edge case, file deleted between detection and runtime), fail gracefully

**Key insight:** Detection happens early (during config loading), so the runner's check becomes a secondary safety net.

**File:** `packages/phpunit/src/detect.ts`

**No changes needed** - `findPhpUnitConfig()` is still used by the runner to locate the actual config file path at runtime.

## Testing Strategy

**New test scenarios:**

1. **Detection returns false without config file**
   - Setup: Project has `composer.json` with phpunit/phpunit dependency
   - Setup: No `phpunit.xml` or `phpunit.xml.dist`
   - Assert: `detectPhpUnit()` returns `false`

2. **Detection returns true with config file only**
   - Setup: Project has `phpunit.xml`
   - Setup: No `composer.json` at all
   - Assert: `detectPhpUnit()` returns `true`

3. **Config file precedence**
   - Setup: Both `phpunit.xml` and `phpunit.xml.dist` exist
   - Assert: `hasPhpUnitConfig()` returns `true`
   - Note: PHPUnit itself prefers `phpunit.xml` over `.dist`

4. **Detection with .dist only**
   - Setup: Only `phpunit.xml.dist` exists
   - Assert: `detectPhpUnit()` returns `true`

**Update existing tests:**
- Remove any tests that check composer.json detection
- Simplify test fixtures (no need for composer.json in PHPUnit fixtures)

## Implementation Steps

1. **Update detection logic** (`packages/config/src/options/phpunit-detect.ts`)
   - Remove `hasPhpUnitComposerDependency()` function
   - Remove `ComposerJson` interface
   - Simplify `detectPhpUnit()` to only call `hasPhpUnitConfig()`

2. **Add comprehensive tests**
   - Create or expand test file with all scenarios above
   - Test both `phpunit.xml` and `phpunit.xml.dist` detection
   - Test negative cases (no config file)

3. **Update test fixtures** (`packages/test-fixtures/fixtures/`)
   - Ensure plugin and theme fixtures have `phpunit.xml.dist` (already planned)
   - Remove any composer.json-only detection test fixtures if they exist

4. **Verification**
   - Run unit tests: All detection tests pass
   - Manual test: Project with composer phpunit but no config → PHPUnit tests skipped silently
   - Manual test: Project with phpunit.xml → PHPUnit tests run successfully
   - Integration test: Full test run with both plugin and theme fixtures

## Success Criteria

- `detectPhpUnit()` only checks for config files, ignores composer.json
- Tests pass for all scenarios in the behavior matrix
- No breaking changes to existing projects with `phpunit.xml` files
- Cleaner, simpler codebase with less detection logic

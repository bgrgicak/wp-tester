# PHPUnit Config Option Design

**Date:** 2025-12-16
**Status:** Approved

## Overview

Add PHPUnit test support to WP-Tester through a new config option and dedicated package. Users with existing PHPUnit tests will be automatically detected during setup and offered the option to run their tests with WP-Tester.

## Architecture

### Two-Part Implementation

1. **Config Option** - Detection and setup prompt in `@wp-tester/config`
2. **Test Execution** - PHPUnit runner and parser in new `@wp-tester/phpunit` package

### Package Structure

```
packages/
├── config/
│   └── src/options/phpunit.ts        # Setup option (imports detection)
└── phpunit/                          # New package
    ├── src/
    │   ├── index.ts                  # Main exports
    │   ├── detect.ts                 # Detection logic
    │   ├── runner.ts                 # PHPUnit execution
    │   └── parser.ts                 # Parse JSON to CTRF
    ├── package.json
    └── tsconfig.json
```

## Part 1: Config Package Changes

### File: `packages/config/src/options/phpunit.ts`

**Purpose:** Prompt user to enable PHPUnit tests if detected

**Implementation:**
```typescript
import { detectPhpUnit } from '@wp-tester/phpunit';
import type { WPTesterConfig } from '../types';
import * as clack from '@clack/prompts';

export async function phpunitOption(
  config: WPTesterConfig
): Promise<WPTesterConfig> {
  // 1. Run detection from phpunit package
  const isDetected = await detectPhpUnit();

  // 2. If not detected, return config unchanged
  if (!isDetected) {
    return config;
  }

  // 3. Prompt user
  const runPhpUnit = await clack.confirm({
    message: "PHPUnit tests detected. Do you want to run them with WP-Tester?",
    initialValue: true,
  });

  // 4. Handle cancel
  if (clack.isCancel(runPhpUnit)) {
    clack.cancel("Setup cancelled.");
    process.exit(0);
  }

  // 5. Return config with phpunit flag if confirmed
  if (runPhpUnit) {
    return {
      ...config,
      tests: {
        ...config.tests,
        phpunit: true,
      },
    };
  }

  return config;
}
```

### File: `packages/config/src/options/index.ts`

**Changes:**
- Import `phpunitOption`
- Add to `setupOptions` array: `[smokeTestsOption, phpunitOption]`
- Add to `optionNames` array: `['smoke-tests', 'phpunit']`
- Add to `optionMap`: `{ 'smoke-tests': smokeTestsOption, 'phpunit': phpunitOption }`

**Execution order:** Smoke-tests first, then PHPUnit

## Part 2: New @wp-tester/phpunit Package

### File: `packages/phpunit/src/detect.ts`

**Purpose:** Detect if PHPUnit tests exist in the project

**Functions:**

```typescript
export async function hasPhpUnitConfig(): Promise<boolean>
```
- Check for `phpunit.xml` or `phpunit.xml.dist` in current directory
- Use `fs.access()` to check file existence
- Return `true` if either file exists

```typescript
export async function hasPhpUnitComposerDependency(): Promise<boolean>
```
- Read and parse `composer.json` from current directory
- Check `dependencies` and `devDependencies` for `phpunit/phpunit`
- Return `true` if dependency exists
- Handle errors gracefully (missing file, invalid JSON → return `false`)

```typescript
export async function detectPhpUnit(): Promise<boolean>
```
- Combine both detection methods
- Return `true` if either method succeeds
- This is the main export used by config option

**Detection Strategy:**
- Check for PHPUnit config file (`phpunit.xml` or `phpunit.xml.dist`)
- OR check for composer dependency (`phpunit/phpunit`)
- Both checks run from `process.cwd()`

### File: `packages/phpunit/src/runner.ts`

**Purpose:** Execute PHPUnit tests within WordPress Playground

**Main Function:**

```typescript
export async function runPhpUnitTests(
  playground: PlaygroundInstance,
  config: WPTesterConfig
): Promise<CTRFReport>
```

**Execution Steps:**
1. Check if `vendor/bin/phpunit` exists in mounted project
2. Execute PHPUnit with `--log-json=/tmp/phpunit-results.json`
3. Read the JSON output file from Playground filesystem
4. Parse JSON to CTRF format using `parser.ts`
5. Return CTRF report

**Command:**
```bash
vendor/bin/phpunit --log-json=/tmp/phpunit-results.json
```

### File: `packages/phpunit/src/parser.ts`

**Purpose:** Convert PHPUnit JSON output to CTRF format

**Main Function:**

```typescript
export function parsePhpUnitOutput(output: string): CTRFReport
```

**Processing:**
- Parse PHPUnit JSON format (`--log-json` output)
- Map to CTRF (Common Test Report Format)
- Handle test results, failures, errors, timing
- Preserve stack traces and error messages

**Output:** Standard CTRF report compatible with wp-tester reporters

### File: `packages/phpunit/package.json`

**Dependencies:**
```json
{
  "name": "@wp-tester/phpunit",
  "version": "0.1.0",
  "dependencies": {
    "@wp-tester/results": "workspace:*",
    "@wp-playground/cli": "^x.x.x"
  }
}
```

## Part 3: CLI Integration

### File: `packages/cli/src/commands/test/runner.ts`

**Integration Point:**

Add PHPUnit execution after smoke-tests in the test runner:

```typescript
// After smoke tests run
if (config.tests.phpunit) {
  const phpunitResults = await runPhpUnitTests(playground, config);
  // Merge with existing CTRF results
  // Feed to reporters
}
```

**Execution Flow Per Environment:**
1. Start WordPress Playground environment
2. Run smoke-tests (if `tests.plugin`, `tests.theme`, or `tests.wp` configured)
3. Run PHPUnit tests (if `tests.phpunit` is `true`)
4. Collect all results in CTRF format
5. Pass to reporters (default, JSON, etc.)

**Matrix Testing:**
PHPUnit tests run in each configured environment, just like smoke-tests.

## Error Handling

### Detection Phase (Setup)

**Graceful failures - don't block setup:**
- File system errors → Skip detection (no PHPUnit detected)
- JSON parse errors → Skip detection (invalid composer.json)
- Missing files → Normal case (no PHPUnit)

**User Experience:**
- If detection fails, user simply doesn't see the PHPUnit prompt
- Setup continues normally with other options

### Execution Phase (Test Runner)

**Clear error messages:**

1. **PHPUnit binary not found**
   - Error: "PHPUnit not installed. Run `composer install` to install dependencies."
   - Report as test failure

2. **PHPUnit execution fails**
   - Capture stderr output
   - Report as test failure with error details
   - Show PHPUnit's error message

3. **JSON parse error**
   - Error: "Failed to parse PHPUnit output. Check PHPUnit version supports --log-json."
   - Report as test failure with parsing details

4. **Missing log file**
   - Error: "PHPUnit did not generate results file. Ensure PHPUnit version supports --log-json."
   - Report as test failure

**Behavior:**
- Failed PHPUnit tests don't crash the runner
- Other test suites continue execution
- Errors are reported through CTRF format
- Users get actionable error messages

## User Flow

### Setup Command

```bash
$ wp-tester setup
```

1. **Check for existing config**
   - Prompt to overwrite if `wp-tester.json` exists

2. **Smoke-tests option** (existing)
   - "Do you want to run smoke tests?"
   - If yes, ask for project type and slug

3. **PHPUnit option** (new)
   - Detect PHPUnit (config files or composer dependency)
   - If detected: "PHPUnit tests detected. Do you want to run them with WP-Tester?"
   - If user confirms: Set `tests.phpunit: true`
   - If not detected: Skip prompt entirely

4. **Write config file**
   - Save `wp-tester.json`

### Test Command

```bash
$ wp-tester test
```

1. **Read config** - Load `wp-tester.json`
2. **For each environment:**
   - Start WordPress Playground
   - Mount project files
   - Run smoke-tests (if configured)
   - Run PHPUnit tests (if `tests.phpunit: true`)
   - Collect results
3. **Report results** - Use configured reporters

## Example Config

### With PHPUnit Enabled

```json
{
  "environments": [
    {
      "name": "Latest WordPress and PHP",
      "blueprint": {
        "preferredVersions": {
          "php": "latest",
          "wp": "latest"
        }
      }
    }
  ],
  "tests": {
    "plugin": "my-plugin",
    "phpunit": true
  },
  "reporters": ["default"]
}
```

### PHPUnit Only

```json
{
  "environments": [
    {
      "name": "Latest WordPress and PHP",
      "blueprint": {
        "preferredVersions": {
          "php": "latest",
          "wp": "latest"
        }
      }
    }
  ],
  "tests": {
    "phpunit": true
  },
  "reporters": ["default"]
}
```

## Dependencies

### New Package Dependencies

**`@wp-tester/config`:**
```json
{
  "dependencies": {
    "@wp-tester/phpunit": "workspace:*"
  }
}
```

**`@wp-tester/phpunit`:**
```json
{
  "dependencies": {
    "@wp-tester/results": "workspace:*",
    "@wp-playground/cli": "^x.x.x"
  }
}
```

**`@wp-tester/cli`:**
```json
{
  "dependencies": {
    "@wp-tester/phpunit": "workspace:*"
  }
}
```

## Testing

### Detection Logic Tests
- Detect `phpunit.xml`
- Detect `phpunit.xml.dist`
- Detect composer dependency
- Handle missing files
- Handle invalid composer.json

### Parser Tests
- Parse successful test run
- Parse failed tests
- Parse errors
- Parse skipped tests
- Handle invalid JSON

### Integration Tests
- Run PHPUnit tests in Playground
- Combine with smoke-tests
- Multiple environments
- Error scenarios

## Future Enhancements

**Not in scope for initial implementation:**

1. Custom PHPUnit config path (always use default `phpunit.xml`)
2. PHPUnit arguments/flags (use defaults from `phpunit.xml`)
3. Test filtering (run all tests)
4. Custom bootstrap files (rely on PHPUnit config)
5. Coverage reporting (focus on pass/fail first)

## Summary

### What Changes

1. **New package:** `@wp-tester/phpunit` with detection, runner, and parser
2. **New config option:** `phpunitOption` in `@wp-tester/config`
3. **CLI integration:** Run PHPUnit tests in `@wp-tester/cli` test runner
4. **Types:** `tests.phpunit: boolean` already exists in types.ts

### Key Principles

- **Automatic detection** - Users don't need to know if they have PHPUnit
- **Non-blocking** - Detection failures don't stop setup
- **Clear errors** - Execution failures provide actionable messages
- **Consistent pattern** - Follows smoke-tests architecture
- **CTRF output** - Integrates with existing reporter system
- **Separation of concerns** - Detection in phpunit package, option in config package

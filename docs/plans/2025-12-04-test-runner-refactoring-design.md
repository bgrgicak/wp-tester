# Test Runner Refactoring Design

**Date:** 2025-12-04
**Status:** Approved

## Overview

Refactor test execution logic out of the CLI package into dedicated packages that follow separation of concerns. This creates a clean architecture where the CLI handles user interaction, a test-runner package orchestrates execution, and test-specific packages (like wordpress-compatibility) own their test implementation and execution.

## Current Problems

The CLI package currently contains test orchestration logic that should live elsewhere:
- Vitest setup and configuration
- Monorepo root discovery
- Test pattern determination based on config
- Test environment setup (temp files, env vars)

This violates separation of concerns and makes the test logic non-reusable outside the CLI context.

## Proposed Architecture

### Three-Package Structure

**1. CLI Package (`@wp-tester/cli`)**
- User-facing commands and interactions
- Config file validation with interactive prompts
- Loads and validates configuration
- Displays test results using clack theming
- Handles all user I/O

**2. Test-Runner Package (`@wp-tester/test-runner`) - NEW**
- Orchestrates test execution based on config
- Calls appropriate test packages sequentially
- Aggregates CTRF reports into unified output
- Pure execution logic - no user interaction
- Returns standardized CTRF Report

**3. WordPress Compatibility Package (`@wp-tester/wordpress-compatibility`)**
- WordPress-specific test suite and runner
- Exports `runTests(config)` function
- Sets up Vitest with WP tests
- Manages test environment using Vitest's provide/inject API
- Returns CTRF Report with WP test results

### Dependencies

```
@wp-tester/cli
  ↓ depends on
@wp-tester/config
@wp-tester/test-runner
  ↓ depends on
@wp-tester/config
@wp-tester/wordpress-compatibility
  ↓ depends on
@wp-tester/config
@wp-tester/runtime
```

### Key Principle

Each package owns its domain completely:
- **CLI** = user interaction
- **test-runner** = coordination
- **test packages** = execution

## Test-Runner Package API

### Main Export

```typescript
import type { WPTesterConfig } from '@wp-tester/config';
import type { Report } from 'ctrf';

export async function runTests(config: WPTesterConfig): Promise<Report>
```

### Execution Flow

1. **Determine which tests to run** from `config.tests`:
   - If `config.tests.wp === true`, import and call `@wp-tester/wordpress-compatibility`
   - If `config.tests.plugin` exists, call plugin test runner (future)
   - If `config.tests.theme` exists, call theme test runner (future)

2. **Run tests sequentially**:
   - Execute each test type one at a time
   - Wait for completion before starting next
   - Collect CTRF Report from each

3. **Aggregate results** into single CTRF Report:
   - Merge all `tests` arrays
   - Sum `summary` counts (passed, failed, skipped, etc.)
   - Use earliest `start` and latest `stop` time
   - Return unified Report

### Error Handling

- If a test package throws, catch error and continue to next package
- Failed test package contributes to failed count in summary
- test-runner never throws - always returns Report (even if all tests fail)

## WordPress Compatibility Package API

### Main Export

```typescript
import type { WPTesterConfig } from '@wp-tester/config';
import type { Report } from 'ctrf';

export async function runTests(config: WPTesterConfig): Promise<Report>
```

### Implementation Details

**Test Environment Setup:**
1. Start Vitest with `startVitest()`
2. Use `vitest.provide('wpTesterConfig', config)` to pass config to tests
3. Tests access via `inject('wpTesterConfig')` instead of reading env vars
4. No temp files or env vars needed!

**Vitest Configuration:**
1. Auto-discover monorepo root (walk up from package location for `package.json` with `workspaces`)
2. Set test include pattern: `packages/wordpress-compatibility/src/tests/**/*.spec.ts`
3. Start Vitest programmatically with `run: true` (no watch mode)

**CTRF Generation:**
1. Map Vitest results to CTRF Report format using `ctrf` package types
2. Build Report object with `tool`, `summary`, and `tests` arrays
3. Return Report object

**Cleanup:**
- Close Vitest instance with `vitest.close()`

### Test File Updates

Current test files read config from environment variable:
```typescript
const configFile = process.env.WP_TESTER_CONFIG_FILE;
const config = configFile ? JSON.parse(readFileSync(configFile, 'utf8')) : null;
```

Updated test files use Vitest's inject API:
```typescript
import { inject } from 'vitest';
const config = inject('wpTesterConfig');
```

## CLI Package Updates

### Updated Test Command Flow

```typescript
import * as clack from '../../cli/theme.js';
import { readConfigFile } from '@wp-tester/config';
import { runTests } from '@wp-tester/test-runner';
import { access, constants } from 'fs/promises';
import path from 'path';

export const runTests = async (configPath: string): Promise<void> => {
  // Validate config file exists (with interactive prompt)
  let finalConfigPath = configPath;
  while (!(await checkConfigExists(finalConfigPath))) {
    // Interactive prompt for correct path
  }

  // Load config
  const config = await readConfigFile();

  // Delegate to test-runner
  const report = await runTests(config);

  // Display results (using clack for themed output)
  displayResults(report);

  // Exit with appropriate code
  process.exit(report.results.summary.failed > 0 ? 1 : 0);
};
```

### What Gets Removed from CLI

- All Vitest imports and orchestration code
- Monorepo root discovery logic
- Test pattern determination
- Temp config file writing
- Environment variable setting

### What Stays in CLI

- Config file validation with interactive prompts
- Config loading
- Result display with clack theming
- Exit code handling

## Package Dependencies & Build Order

### Package.json Dependencies

**@wp-tester/test-runner:**
```json
{
  "dependencies": {
    "@wp-tester/config": "*",
    "@wp-tester/wordpress-compatibility": "*",
    "ctrf": "^0.0.x"
  }
}
```

**@wp-tester/wordpress-compatibility:**
```json
{
  "dependencies": {
    "@wp-tester/config": "*",
    "@wp-tester/runtime": "*",
    "@php-wasm/util": "^0.9.37",
    "@wp-playground/blueprints": "^0.9.37",
    "ctrf": "^0.0.x",
    "vitest": "^4.0.13"
  }
}
```

**@wp-tester/cli:**
```json
{
  "dependencies": {
    "@wp-tester/config": "*",
    "@wp-tester/test-runner": "*",
    "@clack/prompts": "^0.11.0",
    "ajv": "^8.17.1",
    "picocolors": "^1.1.1",
    "yargs": "^18.0.0"
  },
  "devDependencies": {
    "vitest": "^4.0.13"  // Only for CLI's own tests
  }
}
```

### Nx Build Order

Nx will automatically build in correct order based on dependencies:
1. `@wp-tester/config` (no dependencies)
2. `@wp-tester/runtime` (no dependencies)
3. `@wp-tester/wordpress-compatibility` (depends on config, runtime)
4. `@wp-tester/test-runner` (depends on config, wordpress-compatibility)
5. `@wp-tester/cli` (depends on config, test-runner)

## Migration Strategy

### Phase 1: Create test-runner package
1. Create `packages/test-runner/` directory structure
2. Create `package.json`, `tsconfig.json`
3. Implement empty `runTests()` stub that throws "Not implemented"
4. Add to workspace and verify it builds

### Phase 2: Move logic to wordpress-compatibility
1. Add `runTests()` function to `packages/wordpress-compatibility/src/index.ts`
2. Move Vitest orchestration code from CLI runner
3. Update to use `vitest.provide()` instead of temp files
4. Update test file to use `inject('wpTesterConfig')` instead of env vars
5. Map Vitest results to CTRF format
6. Test standalone: can call `wordpressCompatibility.runTests(config)` directly

### Phase 3: Implement test-runner orchestration
1. Implement `test-runner.runTests()` to call wordpress-compatibility
2. Implement CTRF report aggregation (even if only one test type for now)
3. Test standalone: can call `testRunner.runTests(config)` directly

### Phase 4: Update CLI
1. Update CLI to import from `@wp-tester/test-runner`
2. Remove Vitest imports and orchestration code
3. Simplify to just config validation + delegation + result display
4. Test end-to-end: `wp-tester test` still works

### Phase 5: Cleanup
1. Remove old runner code that was moved
2. Update dependencies in package.json files
3. Verify all builds pass: `nx run-many -t build`
4. Verify tests pass: `nx run-many -t test`

## Testing Strategy

### Unit Testing
- Test `wordpress-compatibility.runTests()` with mock config
- Test `test-runner.runTests()` with mock test packages
- Test CLI runner delegates correctly

### Integration Testing
- Run actual WordPress tests end-to-end
- Verify CTRF report structure is valid
- Verify exit codes are correct

### Validation
- Existing `packages/wordpress-compatibility/tests/wp.spec.ts` should still pass
- CLI behavior should be identical to current implementation
- CTRF reports should be valid and complete

## Rollback Plan

Each phase is independently testable. If a phase fails:
- Revert the commits for that phase
- Previous phases remain intact
- Can pause and debug without breaking everything

## Benefits

1. **Separation of Concerns**: Each package has a single, clear responsibility
2. **Reusability**: Test execution logic can be used outside CLI (APIs, GUIs, CI/CD)
3. **Testability**: Each package can be tested independently
4. **Maintainability**: Changes to test orchestration don't affect CLI
5. **Extensibility**: Easy to add plugin/theme test runners in the future
6. **Standardization**: CTRF format enables interoperability with other tools

## Future Extensions

Once this refactoring is complete:
- Add `@wp-tester/plugin-tests` package with similar structure
- Add `@wp-tester/theme-tests` package with similar structure
- test-runner automatically orchestrates all enabled test types
- Each test package can evolve independently

## References

- [CTRF (Common Test Report Format)](https://ctrf.io/)
- [CTRF npm package](https://www.npmjs.com/package/ctrf)
- [Vitest Advanced API](https://vitest.dev/advanced/api/)
- [Vitest Test Context](https://vitest.dev/guide/test-context)

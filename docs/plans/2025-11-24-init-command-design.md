# Init Command Design

## Overview

The init command creates an interactive wizard that generates a `wp-tester.json` configuration file in the current working directory. The design uses a modular configuration system where each option is defined in its own file, allowing for easy extension and maintenance.

## Architecture

### File Structure

```
src/
  config/
    options/
      run.ts           # Individual option definitions
      index.ts         # Export all options
    types.ts           # Central config types
    handler.ts         # Default handler logic
  commands/
    init.ts            # Init command implementation
tests/
  commands/
    init.test.ts       # Init command tests
docs/
  plans/
    2025-11-24-init-command-design.md
```

### Dependencies

- `@clack/prompts` - Interactive CLI prompts with beautiful UX (new)
- `yargs` - Command routing (existing)
- `ts-json-schema-generator` - Schema generation (dev dependency, future)
- `ajv` - Runtime validation (optional, future)

## Configuration System

### Option Definition Pattern

Each configuration option lives in its own file following this pattern:

```typescript
// src/config/options/run.ts
export interface RunOption {
  key: 'run';
  /** Enable running built-in tests */
  value: boolean;
}

export const runOption: ConfigOption<boolean> = {
  key: 'run',
  type: 'confirm',
  prompt: 'Do you want to run built-in tests?',
  default: true,
  // Optional custom handler for complex processing
  handler?: (currentConfig: ConfigBuilder, userChoice: boolean) => ConfigBuilder
};
```

### Type Definitions

```typescript
// src/config/types.ts
export type PromptType = 'confirm' | 'text' | 'select' | 'multiselect';

export type OptionHandler<TInput = any, TConfig = any> = (
  currentConfig: TConfig,
  userChoice: TInput
) => TConfig;

export interface SelectChoice<T = any> {
  value: T;
  label: string;
  hint?: string;
}

export interface ConfigOption<TValue = any> {
  key: string;
  type: PromptType;
  prompt: string;
  default?: TValue;
  choices?: SelectChoice[];
  validate?: (value: TValue) => boolean | string;
  handler?: OptionHandler<TValue>;
}

export interface WPTesterConfig {
  run: boolean;
  // Future options added here
}

export type ConfigBuilder = Partial<WPTesterConfig>;
```

### Handler Logic

The handler system provides flexibility for both simple and complex option processing:

```typescript
// src/config/handler.ts
export function applyOption<T>(
  option: ConfigOption<T>,
  currentConfig: ConfigBuilder,
  userChoice: T
): ConfigBuilder {
  // Use custom handler if provided
  if (option.handler) {
    return option.handler(currentConfig, userChoice);
  }

  // Default: type-coerce and store under key
  const typedValue = coerceToType(userChoice, option.type);
  return {
    ...currentConfig,
    [option.key]: typedValue
  };
}

export function coerceToType<T>(value: T, type: PromptType): unknown {
  switch (type) {
    case 'confirm':
      return Boolean(value);
    case 'text':
      return String(value);
    case 'select':
    case 'multiselect':
      return value;
    default:
      return value;
  }
}
```

**Benefits:**
- Simple options use default handler with automatic type coercion
- Complex options can implement custom handlers for advanced processing
- Type-safe throughout the codebase
- Single source of truth for each option

**Example Custom Handler:**

```typescript
// Future example: src/config/options/testDirs.ts
export const testDirsOption: ConfigOption<string> = {
  key: 'testDirs',
  type: 'text',
  prompt: 'Enter test directories (comma-separated):',
  default: 'tests',

  // Custom processing: split string into array
  handler: (currentConfig: ConfigBuilder, userChoice: string) => ({
    ...currentConfig,
    testDirs: userChoice.split(',').map(dir => dir.trim())
  })
};
```

## Init Command Implementation

### Command Structure

Uses yargs' command builder pattern:

```typescript
// src/commands/init.ts
export const command = 'init';
export const describe = 'Initialize wp-tester configuration';

export interface InitCommandOptions {
  answers?: Array<boolean | string | string[]>;
  force?: boolean; // Skip overwrite prompt
}

export const handler = async (options?: InitCommandOptions): Promise<void> => {
  // Implementation
};
```

### Interactive Flow

1. **Welcome message** - Display friendly intro via @clack
2. **Check write permissions** - Test if CWD is writable before starting wizard
   - Create/write temporary test file
   - If not writable: show clear error with recovery steps, exit with code 1
3. **Check for existing config** - Look for `wp-tester.json` in CWD
4. **Handle existing file** - If found, prompt: "wp-tester.json already exists. Overwrite?"
   - If "no": cancel with message, exit gracefully
   - If "yes": continue to questions
5. **Ask questions** - Iterate through all config options
   - Use @clack confirm/text/select/multiselect based on option type
   - Handle Ctrl+C cancellation gracefully
6. **Build configuration** - Apply handlers to build final config object
7. **Write config file** - Save as `wp-tester.json` with proper formatting
8. **Success message** - Display completion via @clack outro

### Implementation Sketch

```typescript
export const handler = async (options?: InitCommandOptions): Promise<void> => {
  clack.intro('WP Tester Setup');

  // Check write permissions
  const canWrite = await checkWritePermissions(process.cwd());
  if (!canWrite) {
    clack.outro('Error: Cannot write to current directory. Please check permissions or run from a different location.');
    process.exit(1);
  }

  // Check for existing config
  const configPath = path.join(process.cwd(), 'wp-tester.json');
  const configExists = await fileExists(configPath);

  if (configExists && !options?.force) {
    const shouldOverwrite = await clack.confirm({
      message: 'wp-tester.json already exists. Overwrite?'
    });

    if (clack.isCancel(shouldOverwrite) || !shouldOverwrite) {
      clack.cancel('Setup cancelled.');
      process.exit(0);
    }
  }

  // Ask questions and build config
  let config: ConfigBuilder = {};

  for (const option of configOptions) {
    const answer = options?.answers?.shift() ?? await promptForOption(option);

    if (clack.isCancel(answer)) {
      clack.cancel('Setup cancelled.');
      process.exit(0);
    }

    config = applyOption(option, config, answer);
  }

  // Write config file
  try {
    await fs.writeFile(
      configPath,
      JSON.stringify(config, null, 2),
      'utf8'
    );
    clack.outro('✓ wp-tester.json created successfully!');
  } catch (error) {
    clack.outro(`Error: Could not write config file. ${error.message}`);
    process.exit(1);
  }
};
```

## Testing Strategy

### Principles

- **No mocks** - Test actual behavior with real file operations
- **Direct function calls** - Import and call handler functions
- **Type safety** - All tests fully typed

### Test Structure

```typescript
// tests/commands/init.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { handler } from '../../src/commands/init';
import { applyOption, coerceToType } from '../../src/config/handler';
import { runOption } from '../../src/config/options/run';
import type { ConfigOption, WPTesterConfig } from '../../src/config/types';

describe('Init Command', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = path.join(process.cwd(), `.test-${Date.now()}`);
    await fs.mkdir(testDir);
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Handler Logic', () => {
    it('should coerce boolean values correctly', () => {
      const result = coerceToType('true', 'confirm');
      expect(result).toBe(true);
      expect(typeof result).toBe('boolean');
    });

    it('should apply option with default handler', () => {
      const config: Partial<WPTesterConfig> = {};
      const result = applyOption(runOption, config, true);
      expect(result).toEqual({ run: true } satisfies Partial<WPTesterConfig>);
    });

    it('should use custom handler when provided', () => {
      const customOption: ConfigOption<string> = {
        key: 'testDirs',
        type: 'text',
        prompt: 'Test',
        handler: (cfg, choice: string) => ({
          ...cfg,
          testDirs: choice.split(',').map(d => d.trim())
        })
      };

      const result = applyOption(customOption, {}, 'tests,specs');
      expect(result).toEqual({ testDirs: ['tests', 'specs'] });
    });
  });

  describe('Configuration Creation', () => {
    it('should create wp-tester.json with correct structure', async () => {
      await handler({ answers: [true], force: true });

      const content = await fs.readFile(
        path.join(testDir, 'wp-tester.json'),
        'utf8'
      );
      const config = JSON.parse(content);

      expect(config).toEqual({ run: true });
    });
  });
});
```

### Test Coverage

- **Unit tests** - Handler logic, type coercion, custom handlers
- **Integration tests** - Full command flow with file I/O
- **Error handling** - Permissions, write failures, cancellation
- **Real file operations** - Actual temp directories and file I/O

## Future Enhancements

### JSON Schema Generation

Following WordPress Playground's pattern:

```typescript
// bin/generate-schema.js
import tsj from 'ts-json-schema-generator';

const schema = tsj.createGenerator({
  path: 'src/config/types.ts',
  type: 'WPTesterConfig',
}).createSchema('WPTesterConfig');

fs.writeFileSync('public/config-schema.json', JSON.stringify(schema, null, 2));
```

### Config Command

Reuse the same option definitions for a config command:

```bash
wp-tester config run false        # Update single value
wp-tester config --list           # Show all options
wp-tester config --validate       # Validate existing config
```

## Initial Implementation Scope

For v1, implement:
- Single option: `run` (boolean, confirm prompt)
- Default handler with type coercion
- Full init wizard flow
- Comprehensive tests
- @clack/prompts integration

Future options can be added by:
1. Creating new file in `src/config/options/`
2. Adding to `options/index.ts`
3. Updating `WPTesterConfig` type
4. No changes needed to init command logic

# rootDir Config Option Design

**Date**: 2025-12-17

## Overview

Add a `rootDir` configuration option that runs at the start of setup to establish the project root directory.

### Setup Flow

1. Check if CWD is the project root using `clack.confirm()` (with actual path shown)
2. If Yes → omit `rootDir` from config (uses `process.cwd()` default)
3. If No → prompt for path using `clack.text()`, validate it exists, write path to config

### Integration Points

- New file: `packages/config/src/options/root-dir.ts` containing `rootDirOption` function
- Update: `packages/config/src/options/index.ts` to add `rootDirOption` as **first** item in `setupOptions` array
- Update: Add `'root-dir'` to `optionNames` and `optionMap`

### User Experience Example (using clack)

```
◆  Is /Users/bero/Projects/phpunit-tests the project root directory?
│  No
│
◆  Enter the path to your project root:
│  ../
│
└  Project root configured
```

## Implementation Details

### Function Signature

```typescript
export async function rootDirOption(
  config: WPTesterConfig
): Promise<WPTesterConfig>
```

### Logic Flow

1. Get current working directory: `process.cwd()`
2. Show `clack.confirm()` with message: `"Is ${cwd} the project root directory?"`
3. Handle cancel (exit gracefully)
4. If confirmed Yes:
   - Return config unchanged (no `rootDir` field)
5. If confirmed No:
   - Show `clack.text()` prompt: `"Enter the path to your project root:"`
   - Validate the input path exists (using `fs.existsSync()`)
   - If invalid, show error message in validate function
   - Store path according to path handling logic below
   - Return config with `rootDir` field set

### Path Handling Logic

```typescript
// If user confirms CWD is root → omit rootDir
// If user provides relative path → store as-is (after validation)
// If user provides absolute path → store as-is (they know what they're doing)

if (path.isAbsolute(userInput)) {
  config.rootDir = userInput;
} else {
  // Store relative path as-is or normalize it
  config.rootDir = path.normalize(userInput);
}
```

## Error Handling and Edge Cases

### Validation Function

```typescript
function validatePath(value: string): string | undefined {
  if (!value || value.trim().length === 0) {
    return 'Path cannot be empty';
  }

  const resolvedPath = path.isAbsolute(value)
    ? value
    : path.resolve(process.cwd(), value);

  if (!fs.existsSync(resolvedPath)) {
    return 'Directory does not exist';
  }

  return undefined;
}
```

### Edge Cases

1. **User cancels prompt**: Call `clack.cancel()` and `process.exit(0)` (consistent with other options)
2. **Absolute path input**: Store exactly as provided - user knows what they're doing
3. **Relative path input**: Validate it exists (resolve to check), then store the relative path
4. **Same directory (`.` or `./`)**: Store as-is since user explicitly chose it over default
5. **Path with spaces**: No special handling needed, `path` module handles this

### Dependencies

```typescript
import * as clack from '@clack/prompts';
import * as path from 'path';
import * as fs from 'fs';
import type { WPTesterConfig } from '../types';
```

### Testing Considerations

- Unit test with mocked `clack` prompts
- Test absolute path is stored as-is
- Test relative path is stored as-is (after validation)
- Test validation (non-existent directory)
- Test that CWD confirmation omits `rootDir` field

# Report Merging Design

**Date:** 2025-12-17
**Status:** Approved

## Overview

Move report merging logic from the CLI runner to the `@wp-tester/results` package. This refactoring places report manipulation logic in the appropriate package, makes it reusable, and simplifies the CLI layer.

## Module Structure and Exports

### New File: `packages/results/src/merge.ts`

Contains the `mergeReports` function implementation.

**Function signature:**
```typescript
export function mergeReports(reports: Report[]): Report
```

**Input validation:**
- If `reports` is empty, throw an error (caller should ensure reports exist)
- If `reports` has only one item, return a new copy of that report (avoid mutation)
- If `reports` has multiple items, merge them

### Updated: `packages/results/src/index.ts`

Add export:
```typescript
export { mergeReports } from './merge.js';
```

## Merge Algorithm

The `mergeReports` function creates a new `Report` object by:

### Summary Field Aggregation
- `tests`: sum of all `summary.tests`
- `passed`: sum of all `summary.passed`
- `failed`: sum of all `summary.failed`
- `skipped`: sum of all `summary.skipped`
- `pending`: sum of all `summary.pending`
- `other`: sum of all `summary.other`
- `start`: `Math.min(...reports.map(r => r.results.summary.start))`
- `stop`: `Math.max(...reports.map(r => r.results.summary.stop))`

### Tool Field
Set to `{ name: "wp-tester" }` to indicate this is a merged report from the main CLI.

### Tests Array
Concatenate all `results.tests` arrays from all reports. This preserves individual test details from each suite.

### Top-Level Fields
- `reportFormat`: `"CTRF"`
- `specVersion`: `"0.0.4"` (same as EMPTY_REPORT)

### Immutability
The function creates a new report object without modifying any input reports.

## Integration with CLI Runner

### Update: `packages/cli/src/commands/test/runner.ts`

Replace the manual merging code (lines 106-117) with:

```typescript
import { mergeReports } from "@wp-tester/results";

// ... existing code ...

// Replace lines 106-117 with:
const mergedReport = mergeReports(reports);
```

**Benefits:**
- Removes ~12 lines of business logic from the CLI layer
- Places report manipulation logic in the appropriate package
- Makes the merge logic reusable for other consumers
- Easier to test in isolation
- CLI runner becomes simpler and more focused on orchestration

The rest of the runner code (lines 119-134 that display results) remains unchanged.

## Testing Strategy

### Test File: `packages/results/src/merge.spec.ts`

**Test cases:**
1. **Single report** - Returns a new copy without mutation
2. **Two reports** - Correctly sums all summary fields and concatenates tests
3. **Multiple reports** - Handles 3+ reports correctly
4. **Time calculation** - `start` is earliest, `stop` is latest across all reports
5. **Tool field** - Sets `tool.name` to `"wp-tester"`
6. **Immutability** - Original reports are not modified
7. **Empty array** - Throws error with helpful message
8. **CTRF fields** - Sets correct `reportFormat` and `specVersion`

## Implementation Notes

- Follow YAGNI: implement only the merge function, no additional validation or utilities
- The function assumes all input reports are valid CTRF reports
- Future enhancements (validation, filtering, etc.) can be added as separate functions when needed

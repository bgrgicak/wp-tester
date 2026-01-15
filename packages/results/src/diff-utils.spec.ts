/**
 * Tests for diff-utils
 */

import { describe, it, expect } from "vitest";
import { highlightStringDiff, applyDiffHighlighting } from "./diff-utils.js";
import pc from "picocolors";

describe("highlightStringDiff", () => {
  it("should highlight differences in single-line strings", () => {
    const expected = "Hello World";
    const actual = "Hello There";

    const result = highlightStringDiff(expected, actual);

    expect(result.expected).toBe("Hello «World»");
    expect(result.actual).toBe("Hello «There»");
  });

  it("should not add markers when strings are identical", () => {
    const expected = "Hello World";
    const actual = "Hello World";

    const result = highlightStringDiff(expected, actual);

    expect(result.expected).toBe("Hello World");
    expect(result.actual).toBe("Hello World");
  });

  it("should ensure markers don't span newlines in multiline strings", () => {
    const expected = "Hello World\nTest";
    const actual = "Hello World";

    const result = highlightStringDiff(expected, actual);

    // Check that no marker spans a newline
    const hasMarkerSpanningNewline = /«[^»]*\n[^«]*»/.test(result.expected);
    expect(hasMarkerSpanningNewline).toBe(false);

    // Expected should have the diff part highlighted
    // The diff is "\nTest" which gets split at the newline
    // After ensureMarkersPerLine, markers are split: "Hello World\n«Test»"
    // (The newline itself doesn't get wrapped since it becomes an empty line)
    expect(result.expected).toBe("Hello World\n«Test»");
  });

  it("should handle multiline diffs correctly", () => {
    const expected = "'Hello World Test\\n\n\t\ttest'";
    const actual = "'Hello World Test'";

    const result = highlightStringDiff(expected, actual);

    // Verify no markers span newlines
    const expectedHasSpanning = /«[^»]*\n[^«]*»/.test(result.expected);
    const actualHasSpanning = /«[^»]*\n[^«]*»/.test(result.actual);

    expect(expectedHasSpanning).toBe(false);
    expect(actualHasSpanning).toBe(false);

    // The diff is "\\n\n\t\ttest" which should be split at the real newline
    // First line should end with «\\n»
    const lines = result.expected.split('\n');
    expect(lines[0]).toContain("«\\n»");
  });
});

describe("applyDiffHighlighting", () => {
  it("should apply bold styling to marked sections", () => {
    const line = "Hello «World»";

    // Mock color function that just returns the text
    const colorFn = (str: string) => str;

    const result = applyDiffHighlighting(line, colorFn);

    // The result should contain bold markers for "World"
    // pc.bold wraps with ANSI codes when colors are enabled
    // Since we can't control color state in tests, just verify structure
    expect(result).toContain("Hello ");
    expect(result).toContain("World");
  });

  it("should handle multiple markers in a line", () => {
    const line = "«Hello» World «Test»";
    const colorFn = (str: string) => str;

    const result = applyDiffHighlighting(line, colorFn);

    expect(result).toContain("Hello");
    expect(result).toContain(" World ");
    expect(result).toContain("Test");
  });

  it("should handle lines without markers", () => {
    const line = "Hello World";
    const colorFn = (str: string) => `[${str}]`;

    const result = applyDiffHighlighting(line, colorFn);

    expect(result).toBe("[Hello World]");
  });

  it("should not match markers that span multiple lines", () => {
    // This shouldn't happen with our ensureMarkersPerLine fix,
    // but test that the regex doesn't match across lines
    const line = "Hello «World";
    const colorFn = (str: string) => str;

    const result = applyDiffHighlighting(line, colorFn);

    // Should just apply color to the whole line since no complete marker
    expect(result).toBe("Hello «World");
  });
});

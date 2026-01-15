/**
 * Diff Highlighting Utilities
 *
 * Shared utilities for highlighting character-level differences between strings.
 * Used by both Vitest and PHPUnit streaming reporters.
 */

import pc from "picocolors";

/**
 * Apply character-level highlighting to diff lines
 * Converts «text» markers to bold/bright text
 */
export function applyDiffHighlighting(line: string, colorFn: (str: string) => string): string {
  // Find all highlighted sections marked with « and »
  const parts: string[] = [];
  let lastIndex = 0;
  const regex = /«([^»]+)»/g;
  let match;

  while ((match = regex.exec(line)) !== null) {
    // Add the text before the highlight (normal color, not dimmed)
    if (match.index > lastIndex) {
      parts.push(colorFn(line.slice(lastIndex, match.index)));
    }
    // Add the highlighted text (bright/bold)
    parts.push(pc.bold(colorFn(match[1])));
    lastIndex = match.index + match[0].length;
  }

  // Add any remaining text after the last highlight
  if (lastIndex < line.length) {
    parts.push(colorFn(line.slice(lastIndex)));
  }

  // If no highlights found, return the line with color applied
  return parts.length > 0 ? parts.join('') : colorFn(line);
}

/**
 * Apply diff markers to multiline strings, putting markers on each line
 * This ensures the renderer can process each line independently
 */
export function applyMarkersToMultiline(text: string): string {
  if (!text) return '';

  // Split by newlines, apply markers to each line, then rejoin
  const lines = text.split('\n');
  return lines.map(line => line ? `«${line}»` : '').join('\n');
}

/**
 * Ensure markers don't span newlines by splitting and re-wrapping
 * Converts "text«diff\nmore»end" to "text«diff»\n«more»end"
 */
function ensureMarkersPerLine(text: string): string {
  // Split by markers first to identify highlighted sections
  const parts: string[] = [];
  let lastIndex = 0;
  const regex = /«([^»]+)»/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the marker
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    // Split the highlighted section by newlines and re-wrap each line
    const highlighted = match[1];
    const lines = highlighted.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]) {
        parts.push(`«${lines[i]}»`);
      }
      if (i < lines.length - 1) {
        parts.push('\n');
      }
    }

    lastIndex = match.index + match[0].length;
  }

  // Add any remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts.join('') : text;
}

/**
 * Highlight character-level differences between two strings
 * Adds markers for rendering differences in bold/bright
 * Uses « and » markers that will be processed by applyDiffHighlighting
 * Handles multiline strings by ensuring markers don't span newlines
 */
export function highlightStringDiff(expected: string, actual: string): { expected: string; actual: string } {
  // Find common prefix
  let prefixEnd = 0;
  const minLen = Math.min(expected.length, actual.length);
  while (prefixEnd < minLen && expected[prefixEnd] === actual[prefixEnd]) {
    prefixEnd++;
  }

  // Find common suffix (starting from the end, but not overlapping with prefix)
  let suffixStart = expected.length;
  let actualSuffixStart = actual.length;
  while (
    suffixStart > prefixEnd &&
    actualSuffixStart > prefixEnd &&
    expected[suffixStart - 1] === actual[actualSuffixStart - 1]
  ) {
    suffixStart--;
    actualSuffixStart--;
  }

  // Build highlighted strings with markers for the renderer
  const expectedPrefix = expected.slice(0, prefixEnd);
  const expectedDiff = expected.slice(prefixEnd, suffixStart);
  const expectedSuffix = expected.slice(suffixStart);

  const actualPrefix = actual.slice(0, prefixEnd);
  const actualDiff = actual.slice(prefixEnd, actualSuffixStart);
  const actualSuffix = actual.slice(actualSuffixStart);

  const highlightedExpected = expectedPrefix + (expectedDiff ? `«${expectedDiff}»` : '') + expectedSuffix;
  const highlightedActual = actualPrefix + (actualDiff ? `«${actualDiff}»` : '') + actualSuffix;

  // Ensure markers don't span newlines for multiline strings
  return {
    expected: ensureMarkersPerLine(highlightedExpected),
    actual: ensureMarkersPerLine(highlightedActual)
  };
}

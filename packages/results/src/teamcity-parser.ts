/**
 * TeamCity Format Parser
 *
 * Parses PHPUnit's TeamCity output format for real-time test result streaming.
 * TeamCity format is designed for streaming and emits structured messages
 * as tests execute.
 *
 * Format reference:
 * ##teamcity[testSuiteStarted name='SuiteName' ...]
 * ##teamcity[testStarted name='testName' ...]
 * ##teamcity[testFinished name='testName' duration='123']
 * ##teamcity[testFailed name='testName' message='error' details='trace']
 * ##teamcity[testIgnored name='testName' message='reason']
 * ##teamcity[testSuiteFinished name='SuiteName']
 */

import type { StreamEvent } from "./streaming.js";
import type { StreamingReporter } from "./streaming.js";

/**
 * TeamCity message types we care about
 */
type TeamCityMessageType =
  | "testSuiteStarted"
  | "testSuiteFinished"
  | "testStarted"
  | "testFinished"
  | "testFailed"
  | "testIgnored";

/**
 * Parsed TeamCity message
 */
interface TeamCityMessage {
  type: TeamCityMessageType;
  attributes: Record<string, string>;
}

/**
 * Unescape TeamCity string values
 * TeamCity uses special escaping for certain characters:
 * - |' -> '
 * - |n -> newline
 * - |r -> carriage return
 * - |[ -> [
 * - |] -> ]
 * - || -> |
 */
function unescapeTeamCityValue(value: string): string {
  return value
    .replace(/\|'/g, "'")
    .replace(/\|n/g, "\n")
    .replace(/\|r/g, "\r")
    .replace(/\|\[/g, "[")
    .replace(/\|\]/g, "]")
    .replace(/\|\|/g, "|");
}

/**
 * Highlight character-level differences between two strings
 * Adds markers for rendering differences in bold/bright
 */
function highlightStringDiff(expected: string, actual: string): { expected: string; actual: string } {
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

  // Use special markers that the renderer will detect: «diff text»
  const highlightedExpected = expectedPrefix + (expectedDiff ? `«${expectedDiff}»` : '') + expectedSuffix;
  const highlightedActual = actualPrefix + (actualDiff ? `«${actualDiff}»` : '') + actualSuffix;

  return { expected: highlightedExpected, actual: highlightedActual };
}

/**
 * Parse a single TeamCity message line
 */
function parseTeamCityLine(line: string): TeamCityMessage | null {
  // Match the TeamCity format: ##teamcity[messageName attr1='value1' attr2='value2']
  const match = line.match(/^##teamcity\[(\w+)\s*(.*)\]$/);
  if (!match) {
    return null;
  }

  const [, type, attributesStr] = match;

  // Parse attributes (name='value' pairs)
  // Values can contain escaped characters like |' (quote), |n (newline), || (pipe)
  // The pattern matches: non-quote/non-pipe chars OR pipe followed by any char (or lookahead for quote)
  // The lookahead (?=') handles edge case of pipes at end of value before closing quote
  const attributes: Record<string, string> = {};
  const attrRegex = /(\w+)='((?:[^'|]|\|(?:.|(?=')))*?)'/g;
  let attrMatch;

  while ((attrMatch = attrRegex.exec(attributesStr)) !== null) {
    const [, key, value] = attrMatch;
    attributes[key] = unescapeTeamCityValue(value);
  }

  return {
    type: type as TeamCityMessageType,
    attributes,
  };
}

/**
 * TeamCity stream parser that converts PHPUnit output to StreamEvents
 */
export class TeamCityParser {
  private buffer = "";
  private currentSuite: string | null = null;
  private testStartTimes: Map<string, number> = new Map();
  private completedTests: Set<string> = new Set(); // Track tests that already reported result
  private reporter: StreamingReporter | null = null;
  private onEvent: ((event: StreamEvent) => void) | null = null;

  /**
   * Create a parser that sends events to a StreamingReporter
   */
  static withReporter(reporter: StreamingReporter): TeamCityParser {
    const parser = new TeamCityParser();
    parser.reporter = reporter;
    return parser;
  }

  /**
   * Create a parser with a custom event handler
   */
  static withEventHandler(
    onEvent: (event: StreamEvent) => void
  ): TeamCityParser {
    const parser = new TeamCityParser();
    parser.onEvent = onEvent;
    return parser;
  }

  /**
   * Emit an event to the reporter or handler
   */
  private emit(event: StreamEvent): void {
    if (this.reporter) {
      this.reporter.onEvent(event);
    }
    if (this.onEvent) {
      this.onEvent(event);
    }
  }

  /**
   * Process a chunk of data from PHPUnit output
   * Handles partial lines by buffering
   */
  write(chunk: string): void {
    this.buffer += chunk;

    // Process complete lines
    const lines = this.buffer.split("\n");
    // Keep the last incomplete line in the buffer
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      this.processLine(line);
    }
  }

  /**
   * Flush any remaining buffered data
   */
  flush(): void {
    if (this.buffer.trim()) {
      this.processLine(this.buffer);
      this.buffer = "";
    }
  }

  /**
   * Process a single line of output
   */
  private processLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed.startsWith("##teamcity[")) {
      return;
    }

    const message = parseTeamCityLine(trimmed);
    if (!message) {
      return;
    }

    this.handleMessage(message);
  }

  /**
   * Handle a parsed TeamCity message
   */
  private handleMessage(message: TeamCityMessage): void {
    const { type, attributes } = message;
    const name = attributes.name || "Unknown";

    switch (type) {
      case "testSuiteStarted":
        this.currentSuite = name;
        this.emit({
          type: "suite:start",
          name,
        });
        break;

      case "testSuiteFinished":
        this.emit({
          type: "suite:end",
          name,
        });
        if (this.currentSuite === name) {
          this.currentSuite = null;
        }
        break;

      case "testStarted":
        this.testStartTimes.set(name, Date.now());
        this.emit({
          type: "test:start",
          name,
          suiteName: this.currentSuite || undefined,
        });
        break;

      case "testFinished": {
        // In TeamCity format, testFailed/testIgnored is followed by testFinished
        // Skip if we already reported this test as failed/skipped
        if (this.completedTests.has(name)) {
          this.completedTests.delete(name);
          break;
        }

        const startTime = this.testStartTimes.get(name);
        const duration = attributes.duration
          ? parseInt(attributes.duration, 10)
          : startTime
            ? Date.now() - startTime
            : 0;

        this.testStartTimes.delete(name);

        this.emit({
          type: "test:pass",
          name,
          suiteName: this.currentSuite || undefined,
          duration,
        });
        break;
      }

      case "testFailed": {
        const startTime = this.testStartTimes.get(name);
        const duration = attributes.duration
          ? parseInt(attributes.duration, 10)
          : startTime
            ? Date.now() - startTime
            : 0;

        this.testStartTimes.delete(name);
        this.completedTests.add(name); // Mark as completed to skip testFinished

        // Build trace with comparison diff if available
        let trace = attributes.details || '';

        // If this is a comparison failure, format the diff with color markers
        if (attributes.type === 'comparisonFailure' &&
            attributes.expected !== undefined &&
            attributes.actual !== undefined) {
              // Highlight character-level differences for better readability
              const highlighted = highlightStringDiff(
                attributes.expected,
                attributes.actual
              );

              const diffOutput = [
                `Expected:`,
                highlighted.expected,
                `Actual:`,
                highlighted.actual,
              ].join("\n");

              // Reorder: path first, blank line, diff
              trace = trace ? `${trace}\n${diffOutput}` : `\n${diffOutput}`;
            }

        this.emit({
          type: "test:fail",
          name,
          suiteName: this.currentSuite || undefined,
          duration,
          message: attributes.message,
          trace,
        });
        break;
      }

      case "testIgnored": {
        this.testStartTimes.delete(name);
        this.completedTests.add(name); // Mark as completed to skip testFinished
        this.emit({
          type: "test:skip",
          name,
          suiteName: this.currentSuite || undefined,
          message: attributes.message,
        });
        break;
      }
    }
  }

  /**
   * Reset the parser state
   */
  reset(): void {
    this.buffer = "";
    this.currentSuite = null;
    this.testStartTimes.clear();
    this.completedTests.clear();
  }
}

/**
 * Create a WritableStream that parses TeamCity format and emits events
 */
export function createTeamCityParserStream(
  reporter: StreamingReporter
): WritableStream<string> {
  const parser = TeamCityParser.withReporter(reporter);

  return new WritableStream({
    write(chunk) {
      parser.write(chunk);
    },
    close() {
      parser.flush();
    },
  });
}

/**
 * Parse TeamCity output and return events (for testing or one-shot parsing)
 */
export function parseTeamCityOutput(output: string): StreamEvent[] {
  const events: StreamEvent[] = [];
  const parser = TeamCityParser.withEventHandler((event) => events.push(event));

  parser.write(output);
  parser.flush();

  return events;
}

/**
 * Vitest Streaming Reporter
 *
 * A custom Vitest reporter that outputs test results in real-time
 * using the StreamingReporter for uniform output formatting.
 */

import type { Reporter } from "vitest/reporters";
import type { Vitest, TestModule, TestCase, TestSuite } from "vitest/node";
import type { SerializedError } from "@vitest/utils";
import { StreamingReporter } from "./streaming.js";
import { UnifiedStreamingReporter } from "./unified-streaming-reporter.js";
import { highlightStringDiff } from "./diff-utils.js";

/**
 * Get the test state from a TestCase
 */
function getTestState(
  testCase: TestCase
): "passed" | "failed" | "skipped" | "pending" {
  const result = testCase.result();
  if (result.state === "passed") return "passed";
  if (result.state === "failed") return "failed";
  if (result.state === "skipped") return "skipped";
  return "pending";
}

/**
 * Get the test duration from a TestCase
 */
function getTestDuration(testCase: TestCase): number {
  const diagnostic = testCase.diagnostic();
  return diagnostic?.duration || 0;
}

/**
 * Format error details with expected/actual comparison
 */
function formatErrorDetails(error: SerializedError): string {
  const lines: string[] = [];

  // Check if this is an assertion error with expected/actual values
  // Some assertions like toContain() don't provide meaningful expected/actual values
  // Only show diff if we have both values AND they're not just undefined
  if ('actual' in error && error.actual !== undefined && 'expected' in error && error.expected !== undefined) {
    const actualStr = typeof error.actual === 'string' ? error.actual : JSON.stringify(error.actual);
    const expectedStr = typeof error.expected === 'string' ? error.expected : JSON.stringify(error.expected);

    // Skip diff if expected is literally "undefined" - this indicates the assertion
    // doesn't provide proper diff values (e.g., toContain)
    if (expectedStr === 'undefined') {
      return '';
    }

    // Highlight character-level differences using the same markers as PHPUnit (« and »)
    const { expected, actual } = highlightStringDiff(expectedStr, actualStr);

    lines.push('Expected:');
    lines.push(expected);
    lines.push('Actual:');
    lines.push(actual);
  }

  return lines.join('\n');
}

/**
 * Get error message from a TestCase
 */
function getErrorInfo(testCase: TestCase): { message?: string; trace?: string } {
  const result = testCase.result();
  if (result.state === "failed" && result.errors && result.errors.length > 0) {
    const error = result.errors[0];

    // Extract base message
    const message = error.message || (error instanceof Error ? error.toString() : JSON.stringify(error));

    // Build trace with file location and error details
    let trace = '';

    // Add file location if available
    const stackStr = error.stackStr || error.stack;
    if (stackStr && typeof stackStr === 'string') {
      // Extract file path and line number from stack
      const stackLines = stackStr.split('\n');
      const firstLine = stackLines.find((line: string) => line.includes('.spec.') || line.includes('.test.'));
      if (firstLine) {
        // Extract just the file path and line number - try multiple patterns
        // Pattern 1: at /path/to/file.ts:line:column
        let match = firstLine.match(/at\s+(\/[^:]+:\d+:\d+)/);
        if (!match) {
          // Pattern 2: (/path/to/file.ts:line:column)
          match = firstLine.match(/\(([^)]+\.(?:spec|test)\.[^)]+)\)/);
        }
        if (match) {
          trace = ' ' + match[1] + '\n';
        }
      }
    }

    // Add error details (expected/actual comparison)
    const details = formatErrorDetails(error);
    if (details) {
      trace += '\n' + details;
    }

    // If we still don't have a trace but have details, use just the details
    // This prevents showing the full node_modules stack trace
    if (!trace && details) {
      trace = details;
    }

    return {
      message,
      trace,
    };
  }
  return {};
}

/**
 * Get the parent suite name
 */
function getSuiteName(testCase: TestCase): string | undefined {
  const parent = testCase.parent;
  if ("name" in parent && parent.name) {
    return parent.name;
  }
  return undefined;
}

/**
 * Get the file ID from a test module
 */
function getFileId(testModule: TestModule): string {
  return testModule.moduleId;
}

/**
 * Get the file name from a test module
 */
function getFileName(testModule: TestModule): string {
  // Extract filename from the module path using platform-independent path separator
  const parts = testModule.moduleId.split(/[/\\]/);
  return parts[parts.length - 1] || testModule.moduleId;
}

/**
 * Get the file ID from a test case by traversing to parent module
 */
function getFileIdFromTestCase(testCase: TestCase): string {
  let current: TestCase | TestSuite | TestModule = testCase;
  while (current && 'parent' in current) {
    current = current.parent;
  }
  // At this point, current should be a TestModule
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  return (current as TestModule).moduleId;
}

/**
 * Get the file ID from a test suite by traversing to parent module
 */
function getFileIdFromTestSuite(testSuite: TestSuite): string {
  let current: TestSuite | TestModule = testSuite;
  while (current && 'parent' in current) {
    current = current.parent;
  }
  // At this point, current should be a TestModule
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  return (current as TestModule).moduleId;
}

/**
 * Custom Vitest reporter that streams test results in real-time
 */
export class VitestStreamingReporter implements Reporter {
  private streaming: StreamingReporter;
  private vitest: Vitest | null = null;
  private toolName: string;

  constructor(toolName: string = "vitest", streamingReporter?: StreamingReporter) {
    this.streaming = streamingReporter || new UnifiedStreamingReporter();
    this.toolName = toolName;
  }

  /**
   * Get the underlying StreamingReporter for access to results
   */
  getStreamingReporter(): StreamingReporter {
    return this.streaming;
  }

  /**
   * Called when vitest is initialized
   */
  onInit(vitest: Vitest): void {
    this.vitest = vitest;
  }

  /**
   * Called when the test run starts
   */
  onTestRunStart(): void {
    this.streaming.onRunStart(this.toolName);
  }

  /**
   * Called when the test run ends
   */
  onTestRunEnd(): void {
    this.streaming.onRunEnd();
  }

  /**
   * Called when a test module is collected (file loaded)
   * Emit file:start event to begin buffering for this file
   */
  onTestModuleCollected(testModule: TestModule): void {
    const fileId = getFileId(testModule);
    const fileName = getFileName(testModule);
    this.streaming.onEvent({
      type: "file:start",
      fileId,
      fileName,
    });
  }

  /**
   * Called when a test module finishes
   * Emit file:end event to flush the buffer for this file
   */
  onTestModuleResult(testModule: TestModule): void {
    const fileId = getFileId(testModule);
    this.streaming.onEvent({
      type: "file:end",
      fileId,
    });
  }

  /**
   * Called when a test suite starts
   */
  onTestSuiteReady(testSuite: TestSuite): void {
    const fileId = getFileIdFromTestSuite(testSuite);
    this.streaming.onEvent({
      type: "suite:start",
      name: testSuite.name,
      fileId,
    });
  }

  /**
   * Called when a test suite ends
   */
  onTestSuiteResult(testSuite: TestSuite): void {
    const fileId = getFileIdFromTestSuite(testSuite);
    this.streaming.onEvent({
      type: "suite:end",
      name: testSuite.name,
      fileId,
    });
  }

  /**
   * Called when a test case is ready to run
   */
  onTestCaseReady(testCase: TestCase): void {
    const suiteName = getSuiteName(testCase);
    const fileId = getFileIdFromTestCase(testCase);
    this.streaming.onEvent({
      type: "test:start",
      name: testCase.name,
      suiteName,
      fileId,
    });
  }

  /**
   * Called when a test case finishes
   */
  onTestCaseResult(testCase: TestCase): void {
    const state = getTestState(testCase);
    const duration = getTestDuration(testCase);
    const suiteName = getSuiteName(testCase);
    const fileId = getFileIdFromTestCase(testCase);
    const { message, trace } = getErrorInfo(testCase);

    switch (state) {
      case "passed":
        this.streaming.onEvent({
          type: "test:pass",
          name: testCase.name,
          suiteName,
          duration,
          fileId,
        });
        break;
      case "failed":
        this.streaming.onEvent({
          type: "test:fail",
          name: testCase.name,
          suiteName,
          duration,
          message,
          trace,
          fileId,
        });
        break;
      case "skipped":
        this.streaming.onEvent({
          type: "test:skip",
          name: testCase.name,
          suiteName,
          fileId,
        });
        break;
      default:
        this.streaming.onEvent({
          type: "test:pending",
          name: testCase.name,
          suiteName,
          fileId,
        });
    }
  }
}

/**
 * Create a streaming reporter factory function for use in Vitest config
 * @param toolName - Name of the tool for the report
 * @returns Reporter instance
 */
export function createVitestStreamingReporter(
  toolName: string = "vitest"
): VitestStreamingReporter {
  return new VitestStreamingReporter(toolName);
}

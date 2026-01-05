/**
 * Vitest Streaming Reporter
 *
 * A custom Vitest reporter that outputs test results in real-time
 * using the StreamingReporter for uniform output formatting.
 */

import type { Reporter } from "vitest/reporters";
import type { Vitest, TestModule, TestCase, TestSuite } from "vitest/node";
import { StreamingReporter } from "./streaming.js";

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
 * Get error message from a TestCase
 */
function getErrorInfo(testCase: TestCase): { message?: string; trace?: string } {
  const result = testCase.result();
  if (result.state === "failed" && result.errors && result.errors.length > 0) {
    const error = result.errors[0];
    return {
      message: error.message || String(error),
      trace: error.stack,
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
    this.streaming = streamingReporter || new StreamingReporter();
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

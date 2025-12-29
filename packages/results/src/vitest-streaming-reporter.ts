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
 * Custom Vitest reporter that streams test results in real-time
 */
export class VitestStreamingReporter implements Reporter {
  private streaming: StreamingReporter;
  private vitest: Vitest | null = null;
  private toolName: string;

  constructor(toolName: string = "vitest") {
    this.streaming = new StreamingReporter();
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
   */
  onTestModuleCollected(testModule: TestModule): void {
    // Get the module path relative to the project root
    const modulePath = testModule.moduleId;
    const fileName = modulePath.split("/").pop() || modulePath;
    this.streaming.onEvent({
      type: "suite:start",
      name: fileName,
    });
  }

  /**
   * Called when a test suite starts
   */
  onTestSuiteReady(testSuite: TestSuite): void {
    this.streaming.onEvent({
      type: "suite:start",
      name: testSuite.name,
    });
  }

  /**
   * Called when a test suite ends
   */
  onTestSuiteResult(testSuite: TestSuite): void {
    this.streaming.onEvent({
      type: "suite:end",
      name: testSuite.name,
    });
  }

  /**
   * Called when a test case finishes
   */
  onTestCaseResult(testCase: TestCase): void {
    const state = getTestState(testCase);
    const duration = getTestDuration(testCase);
    const suiteName = getSuiteName(testCase);
    const { message, trace } = getErrorInfo(testCase);

    switch (state) {
      case "passed":
        this.streaming.onEvent({
          type: "test:pass",
          name: testCase.name,
          suiteName,
          duration,
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
        });
        break;
      case "skipped":
        this.streaming.onEvent({
          type: "test:skip",
          name: testCase.name,
          suiteName,
        });
        break;
      default:
        this.streaming.onEvent({
          type: "test:pending",
          name: testCase.name,
          suiteName,
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

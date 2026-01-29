/**
 * Tests for UnifiedStreamingReporter
 */

import { describe, it, expect, beforeEach } from "vitest";
import { UnifiedStreamingReporter } from "./unified-streaming-reporter.js";
import { type StreamWriter } from "./streaming.js";

class MockWriter implements StreamWriter {
  lines: string[] = [];

  write(text: string): void {
    this.lines.push(text);
  }

  writeLine(text: string): void {
    this.lines.push(text + "\n");
  }

  getOutput(): string {
    return this.lines.join("");
  }

  clear(): void {
    this.lines = [];
  }
}

describe("UnifiedStreamingReporter", () => {
  let reporter: UnifiedStreamingReporter;
  let writer: MockWriter;

  beforeEach(() => {
    writer = new MockWriter();
    reporter = new UnifiedStreamingReporter({
      writer,
      showSummary: false,
      enabled: true,
    });
  });

  describe("multiple test runs", () => {
    it("should accumulate state across multiple run:start calls", () => {
      // Start first run
      reporter.onEvent({ type: "run:start", toolName: "vitest" });
      reporter.onEvent({ type: "suite:start", name: "Suite1" });
      reporter.onEvent({
        type: "test:pass",
        name: "test1",
        suiteName: "Suite1",
        duration: 10,
      });

      // Start second run (should not reset state)
      reporter.onEvent({ type: "run:start", toolName: "phpunit" });
      reporter.onEvent({ type: "suite:start", name: "Suite2" });
      reporter.onEvent({
        type: "test:pass",
        name: "test2",
        suiteName: "Suite2",
        duration: 20,
      });

      // End first run (should not render final output yet)
      reporter.onEvent({ type: "suite:end", name: "Suite1" });
      reporter.onEvent({ type: "run:end" });

      // Get report - should have tests from both runs
      const report = reporter.getReport();
      expect(report.results.summary.passed).toBe(2);
      expect(report.results.summary.tests).toBe(2);
    });

    it("should render final output only when all runs complete", () => {
      // Start first run
      reporter.onEvent({ type: "run:start", toolName: "vitest" });
      reporter.onEvent({ type: "suite:start", name: "Suite1" });
      reporter.onEvent({
        type: "test:pass",
        name: "test1",
        suiteName: "Suite1",
        duration: 10,
      });

      // Start second run
      reporter.onEvent({ type: "run:start", toolName: "phpunit" });
      reporter.onEvent({ type: "suite:start", name: "Suite2" });
      reporter.onEvent({
        type: "test:pass",
        name: "test2",
        suiteName: "Suite2",
        duration: 20,
      });

      writer.clear();

      // End first run (should not render final yet)
      reporter.onEvent({ type: "suite:end", name: "Suite1" });
      reporter.onEvent({ type: "run:end" });

      // Output should be empty (no final render yet)
      expect(writer.getOutput()).toBe("");

      // End second run (should trigger final render)
      reporter.onEvent({ type: "suite:end", name: "Suite2" });
      reporter.onEvent({ type: "run:end" });

      // Now output should contain both tests
      const output = writer.getOutput();
      expect(output).toContain("test1");
      expect(output).toContain("test2");
    });
  });

  describe("getFilterCommand", () => {
    it("should generate Vitest filter for tests without namespace in suiteStack", () => {
      reporter.onEvent({ type: "run:start", toolName: "vitest" });
      reporter.onEvent({ type: "suite:start", name: "MyTestSuite" });
      reporter.onEvent({
        type: "test:fail",
        name: "myTest",
        suiteName: "MyTestSuite",
        suiteStack: ["MyTestSuite"],
        duration: 10,
        message: "Error",
        trace: "Stack trace",
      });
      reporter.onEvent({ type: "suite:end", name: "MyTestSuite" });
      reporter.onEvent({ type: "run:end" });

      const output = writer.getOutput();
      // Should contain Vitest-style filter
      expect(output).toContain("-t");
    });

    it("should generate PHPUnit filter for tests with namespace in suiteStack", () => {
      reporter.onEvent({ type: "run:start", toolName: "phpunit" });
      reporter.onEvent({
        type: "suite:start",
        name: "MyPlugin\\Tests\\TestClass",
      });
      reporter.onEvent({
        type: "test:fail",
        name: "testMethod",
        suiteName: "MyPlugin\\Tests\\TestClass",
        suiteStack: ["MyPlugin", "MyPlugin\\Tests\\TestClass"],
        duration: 10,
        message: "Error",
        trace: "Stack trace",
      });
      reporter.onEvent({
        type: "suite:end",
        name: "MyPlugin\\Tests\\TestClass",
      });
      reporter.onEvent({ type: "run:end" });

      const output = writer.getOutput();
      // Should contain PHPUnit-style filter
      expect(output).toContain("--filter");
    });
  });
});

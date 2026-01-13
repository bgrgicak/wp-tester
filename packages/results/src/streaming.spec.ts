/**
 * Tests for StreamingReporter
 */

import { describe, it, expect, beforeEach } from "vitest";
import { StreamingReporter, type StreamWriter } from "./streaming.js";

class MockWriter implements StreamWriter {
  lines: string[] = [];
  currentOutput: string[] = [];

  write(text: string): void {
    // Handle ANSI clear codes
    if (text === "\x1b[1A\x1b[2K") {
      // Clear last line
      this.currentOutput.pop();
    } else {
      this.lines.push(text);
      this.currentOutput.push(text);
    }
  }

  writeLine(text: string): void {
    this.lines.push(text + "\n");
    this.currentOutput.push(text + "\n");
  }

  getOutput(): string {
    return this.lines.join("");
  }

  getCurrentOutput(): string {
    return this.currentOutput.join("");
  }

  clear(): void {
    this.lines = [];
    this.currentOutput = [];
  }
}

describe("StreamingReporter", () => {
  let writer: MockWriter;
  let reporter: StreamingReporter;

  beforeEach(() => {
    writer = new MockWriter();
    reporter = new StreamingReporter({
      writer,
      showRunBoundaries: false, // Disable header for cleaner tests
      showSummary: false, // Disable summary for cleaner tests
    });
  });

  it("should handle a simple test pass", () => {
    reporter.onEvent({ type: "run:start" });
    reporter.onEvent({ type: "suite:start", name: "My Suite" });
    reporter.onEvent({ type: "test:start", name: "test 1", suiteName: "My Suite" });
    reporter.onEvent({ type: "test:pass", name: "test 1", duration: 100, suiteName: "My Suite" });
    reporter.onEvent({ type: "suite:end", name: "My Suite" });

    const output = writer.getOutput();
    expect(output).toContain("My Suite");
    expect(output).toContain("test 1");
    expect(output).toContain("✓");
  });

  it("should handle parallel file execution without interference", () => {
    reporter.onEvent({ type: "run:start" });

    // Start two files in parallel
    reporter.onEvent({ type: "file:start", fileId: "file1", fileName: "test1.spec.ts" });
    reporter.onEvent({ type: "file:start", fileId: "file2", fileName: "test2.spec.ts" });

    // File 1 starts a suite
    reporter.onEvent({ type: "suite:start", name: "Suite 1", fileId: "file1" });

    // File 2 starts a suite (parallel)
    reporter.onEvent({ type: "suite:start", name: "Suite 2", fileId: "file2" });

    // File 1 starts a test
    reporter.onEvent({ type: "test:start", name: "test 1", suiteName: "Suite 1", fileId: "file1" });

    // File 2 starts a test (parallel)
    reporter.onEvent({ type: "test:start", name: "test 2", suiteName: "Suite 2", fileId: "file2" });

    // File 1 test passes
    reporter.onEvent({ type: "test:pass", name: "test 1", duration: 100, suiteName: "Suite 1", fileId: "file1" });

    // File 2 test passes
    reporter.onEvent({ type: "test:pass", name: "test 2", duration: 150, suiteName: "Suite 2", fileId: "file2" });

    // End suites
    reporter.onEvent({ type: "suite:end", name: "Suite 1", fileId: "file1" });
    reporter.onEvent({ type: "suite:end", name: "Suite 2", fileId: "file2" });

    // End files
    reporter.onEvent({ type: "file:end", fileId: "file1" });
    reporter.onEvent({ type: "file:end", fileId: "file2" });

    const output = writer.getCurrentOutput();

    // Both suites should be present
    expect(output).toContain("Suite 1");
    expect(output).toContain("Suite 2");

    // Both tests should be present
    expect(output).toContain("test 1");
    expect(output).toContain("test 2");

    // Both should show as passed
    const passMarks = output.match(/✓/g);
    expect(passMarks).toHaveLength(2);

    // Verify counts
    const counts = reporter.getCounts();
    expect(counts.total).toBe(2);
    expect(counts.passed).toBe(2);
    expect(counts.failed).toBe(0);
  });

  it("should handle test failures with error messages", () => {
    reporter.onEvent({ type: "run:start" });
    reporter.onEvent({ type: "suite:start", name: "Suite" });
    reporter.onEvent({ type: "test:start", name: "failing test", suiteName: "Suite" });
    reporter.onEvent({
      type: "test:fail",
      name: "failing test",
      duration: 50,
      message: "Expected 1 to equal 2",
      suiteName: "Suite"
    });
    reporter.onEvent({ type: "suite:end", name: "Suite" });

    const output = writer.getOutput();
    expect(output).toContain("failing test");
    expect(output).toContain("✗");
    expect(output).toContain("Expected 1 to equal 2");

    const counts = reporter.getCounts();
    expect(counts.failed).toBe(1);
  });

  it("should handle skipped tests", () => {
    reporter.onEvent({ type: "run:start" });
    reporter.onEvent({ type: "suite:start", name: "Suite" });
    reporter.onEvent({
      type: "test:skip",
      name: "skipped test",
      message: "Not implemented yet",
      suiteName: "Suite"
    });
    reporter.onEvent({ type: "suite:end", name: "Suite" });

    const output = writer.getOutput();
    expect(output).toContain("skipped test");
    expect(output).toContain("○");
    expect(output).toContain("Not implemented yet");

    const counts = reporter.getCounts();
    expect(counts.skipped).toBe(1);
  });

  it("should generate correct CTRF report", () => {
    reporter.onEvent({ type: "run:start", toolName: "test-runner" });
    reporter.onEvent({ type: "suite:start", name: "Suite" });
    reporter.onEvent({ type: "test:pass", name: "test 1", duration: 100, suiteName: "Suite" });
    reporter.onEvent({ type: "test:fail", name: "test 2", duration: 50, message: "Error", suiteName: "Suite" });
    reporter.onEvent({ type: "suite:end", name: "Suite" });
    reporter.onEvent({ type: "run:end" });

    const report = reporter.getReport();

    expect(report.reportFormat).toBe("CTRF");
    expect(report.results.tool.name).toBe("test-runner");
    expect(report.results.summary.tests).toBe(2);
    expect(report.results.summary.passed).toBe(1);
    expect(report.results.summary.failed).toBe(1);
    expect(report.results.tests).toHaveLength(2);

    const passedTest = report.results.tests.find(t => t.status === "passed");
    expect(passedTest?.name).toBe("Suite::test 1");
    expect(passedTest?.duration).toBe(100);

    const failedTest = report.results.tests.find(t => t.status === "failed");
    expect(failedTest?.name).toBe("Suite::test 2");
    expect(failedTest?.message).toBe("Error");
  });

  it("should handle interleaved parallel test events", () => {
    reporter.onEvent({ type: "run:start" });

    // Simulate realistic parallel execution with interleaved events
    reporter.onEvent({ type: "file:start", fileId: "file1" });
    reporter.onEvent({ type: "suite:start", name: "Suite A", fileId: "file1" });
    reporter.onEvent({ type: "file:start", fileId: "file2" });
    reporter.onEvent({ type: "test:start", name: "test A1", suiteName: "Suite A", fileId: "file1" });
    reporter.onEvent({ type: "suite:start", name: "Suite B", fileId: "file2" });
    reporter.onEvent({ type: "test:start", name: "test B1", suiteName: "Suite B", fileId: "file2" });
    reporter.onEvent({ type: "test:pass", name: "test A1", duration: 100, suiteName: "Suite A", fileId: "file1" });
    reporter.onEvent({ type: "test:start", name: "test A2", suiteName: "Suite A", fileId: "file1" });
    reporter.onEvent({ type: "test:pass", name: "test B1", duration: 150, suiteName: "Suite B", fileId: "file2" });
    reporter.onEvent({ type: "test:pass", name: "test A2", duration: 80, suiteName: "Suite A", fileId: "file1" });
    reporter.onEvent({ type: "suite:end", name: "Suite A", fileId: "file1" });
    reporter.onEvent({ type: "suite:end", name: "Suite B", fileId: "file2" });
    reporter.onEvent({ type: "file:end", fileId: "file1" });
    reporter.onEvent({ type: "file:end", fileId: "file2" });

    const counts = reporter.getCounts();
    expect(counts.total).toBe(3);
    expect(counts.passed).toBe(3);

    const output = writer.getOutput();
    expect(output).toContain("Suite A");
    expect(output).toContain("Suite B");
    expect(output).toContain("test A1");
    expect(output).toContain("test A2");
    expect(output).toContain("test B1");
  });

  it("should handle nested suites", () => {
    reporter.onEvent({ type: "run:start" });
    reporter.onEvent({ type: "suite:start", name: "Outer Suite" });
    reporter.onEvent({ type: "suite:start", name: "Inner Suite" });
    reporter.onEvent({ type: "test:pass", name: "nested test", duration: 50, suiteName: "Inner Suite" });
    reporter.onEvent({ type: "suite:end", name: "Inner Suite" });
    reporter.onEvent({ type: "suite:end", name: "Outer Suite" });

    const output = writer.getOutput();
    expect(output).toContain("Outer Suite");
    expect(output).toContain("Inner Suite");
    expect(output).toContain("nested test");
  });

  it("should clean up running tests when suite ends", () => {
    reporter.onEvent({ type: "run:start" });
    reporter.onEvent({ type: "suite:start", name: "Suite" });
    reporter.onEvent({ type: "test:start", name: "hanging test", suiteName: "Suite" });

    // End suite without test completion - should clean up running test
    reporter.onEvent({ type: "suite:end", name: "Suite" });

    // Test should be marked as pending (not running)
    const output = writer.getCurrentOutput();
    expect(output).toContain("hanging test");
    expect(output).toContain("◔"); // pending status
  });

  it("should clean up all running tests when run ends", () => {
    reporter.onEvent({ type: "run:start" });
    reporter.onEvent({ type: "suite:start", name: "Suite" });
    reporter.onEvent({ type: "test:start", name: "hanging test", suiteName: "Suite" });

    // End run without completing test
    reporter.onEvent({ type: "run:end" });

    // Final output should not have any running tests
    const output = writer.getCurrentOutput();
    expect(output).toContain("hanging test");
    expect(output).toContain("◔"); // marked as pending, not running
  });
});

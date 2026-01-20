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

  it("should hide empty suite names when all tests are filtered out", () => {
    // Create a fresh writer for this test
    const filteredWriter = new MockWriter();

    // Create a reporter with a filter that only shows failed tests
    const filteredReporter = new StreamingReporter({
      writer: filteredWriter,
      showRunBoundaries: false,
      showSummary: false,
      filter: {
        passed: false,
        failed: true,
        skipped: false,
        pending: false,
        other: false,
      },
    });

    filteredReporter.onEvent({ type: "run:start" });
    filteredReporter.onEvent({ type: "suite:start", name: "Suite with failed test" });
    filteredReporter.onEvent({ type: "test:fail", name: "failed test", duration: 50, suiteName: "Suite with failed test" });
    filteredReporter.onEvent({ type: "suite:end", name: "Suite with failed test" });

    filteredReporter.onEvent({ type: "suite:start", name: "Suite with only passed tests" });
    filteredReporter.onEvent({ type: "test:pass", name: "passed test", duration: 100, suiteName: "Suite with only passed tests" });
    filteredReporter.onEvent({ type: "suite:end", name: "Suite with only passed tests" });

    filteredReporter.onEvent({ type: "run:end" });

    // Get the final output after run:end (getCurrentOutput gives the current state)
    const output = filteredWriter.getCurrentOutput();

    // Suite with failed test should be visible
    expect(output).toContain("Suite with failed test");
    expect(output).toContain("failed test");

    // Suite with only passed tests should NOT be visible (all tests filtered out)
    expect(output).not.toContain("Suite with only passed tests");
    expect(output).not.toContain("passed test");
  });

  it("should handle test completion before start event (race condition)", () => {
    reporter.onEvent({ type: "run:start" });
    reporter.onEvent({ type: "suite:start", name: "Suite", fileId: "file1" });

    // Test completion arrives BEFORE test start (race condition in parallel execution)
    reporter.onEvent({ type: "test:pass", name: "fast test", duration: 10, suiteName: "Suite", fileId: "file1" });

    // Test start arrives late
    reporter.onEvent({ type: "test:start", name: "fast test", suiteName: "Suite", fileId: "file1" });

    reporter.onEvent({ type: "suite:end", name: "Suite", fileId: "file1" });

    const counts = reporter.getCounts();
    // Should only count the test once, not create duplicate entries
    expect(counts.total).toBe(1);
    expect(counts.passed).toBe(1);

    const output = writer.getCurrentOutput();
    // Should only show test once
    const testMatches = output.match(/fast test/g);
    expect(testMatches).toHaveLength(1);
  });

  it("should handle parallel tests with same name in different files", () => {
    reporter.onEvent({ type: "run:start" });

    // Two files with tests that have the same name
    reporter.onEvent({ type: "file:start", fileId: "file1", fileName: "test1.spec.ts" });
    reporter.onEvent({ type: "file:start", fileId: "file2", fileName: "test2.spec.ts" });

    reporter.onEvent({ type: "suite:start", name: "Plugin Tests", fileId: "file1" });
    reporter.onEvent({ type: "suite:start", name: "Plugin Tests", fileId: "file2" });

    // Same test name in both files
    reporter.onEvent({ type: "test:start", name: "should be active", suiteName: "Plugin Tests", fileId: "file1" });
    reporter.onEvent({ type: "test:start", name: "should be active", suiteName: "Plugin Tests", fileId: "file2" });

    // Complete in any order
    reporter.onEvent({ type: "test:pass", name: "should be active", duration: 100, suiteName: "Plugin Tests", fileId: "file2" });
    reporter.onEvent({ type: "test:pass", name: "should be active", duration: 150, suiteName: "Plugin Tests", fileId: "file1" });

    reporter.onEvent({ type: "suite:end", name: "Plugin Tests", fileId: "file1" });
    reporter.onEvent({ type: "suite:end", name: "Plugin Tests", fileId: "file2" });

    reporter.onEvent({ type: "file:end", fileId: "file1" });
    reporter.onEvent({ type: "file:end", fileId: "file2" });

    const counts = reporter.getCounts();
    // Should count both tests separately, not create duplicates
    expect(counts.total).toBe(2);
    expect(counts.passed).toBe(2);

    // Should not have any tests marked as "Did not complete"
    const output = writer.getCurrentOutput();
    expect(output).not.toContain("Did not complete");

    // Both tests should be shown
    const testMatches = output.match(/should be active/g);
    expect(testMatches).toHaveLength(2);
  });

  it("should keep parent suites visible when child suites have visible tests", () => {
    // Create a fresh writer for this test
    const filteredWriter = new MockWriter();

    // Create a reporter with a filter that only shows failed tests
    const filteredReporter = new StreamingReporter({
      writer: filteredWriter,
      showRunBoundaries: false,
      showSummary: false,
      filter: {
        passed: false,
        failed: true,
        skipped: false,
        pending: false,
        other: false,
      },
    });

    filteredReporter.onEvent({ type: "run:start" });
    filteredReporter.onEvent({ type: "suite:start", name: "Parent Suite" });

    // Parent suite has only passed tests (should be hidden)
    filteredReporter.onEvent({ type: "test:pass", name: "parent passed test", duration: 50, suiteName: "Parent Suite" });

    // Child suite with failed test (should be visible, along with parent)
    filteredReporter.onEvent({ type: "suite:start", name: "Child Suite" });
    filteredReporter.onEvent({ type: "test:fail", name: "child failed test", duration: 50, suiteName: "Child Suite" });
    filteredReporter.onEvent({ type: "suite:end", name: "Child Suite" });

    filteredReporter.onEvent({ type: "suite:end", name: "Parent Suite" });
    filteredReporter.onEvent({ type: "run:end" });

    const output = filteredWriter.getCurrentOutput();

    // Parent suite should be visible because it has a child with visible content
    expect(output).toContain("Parent Suite");

    // Child suite should be visible
    expect(output).toContain("Child Suite");
    expect(output).toContain("child failed test");

    // Parent's passed test should not be visible
    expect(output).not.toContain("parent passed test");
  });

  it("should show correct count when failed test is added before run:end with --failed-only", () => {
    // Create a fresh writer for this test
    const filteredWriter = new MockWriter();

    // Create a reporter with a filter that only shows failed tests (simulating --failed-only)
    const filteredReporter = new StreamingReporter({
      writer: filteredWriter,
      showRunBoundaries: false,
      showSummary: true, // Enable summary to see the counts
      filter: {
        passed: false,
        failed: true,
        skipped: false,
        pending: false,
        other: false,
      },
    });

    // Simulate the bug scenario:
    // 1. run:start
    // 2. suite:start
    // 3. test:fail (PHPUnit Bootstrap failure)
    // 4. suite:end
    // 5. run:end

    filteredReporter.onEvent({ type: "run:start", toolName: "wp-tester-phpunit" });
    filteredReporter.onEvent({ type: "suite:start", name: "PHPUnit Tests" });

    // Bootstrap failure event
    filteredReporter.onEvent({
      type: "test:fail",
      name: "PHPUnit Bootstrap",
      duration: 0,
      message: "Bootstrap failed - see trace for details",
      trace: "No tests executed!",
      suiteName: "PHPUnit Tests",
    });

    filteredReporter.onEvent({ type: "suite:end", name: "PHPUnit Tests" });
    filteredReporter.onEvent({ type: "run:end" });

    const output = filteredWriter.getCurrentOutput();

    // The failed test should be visible
    expect(output).toContain("PHPUnit Bootstrap");
    expect(output).toContain("✗");

    // The summary should show 1 failed test
    expect(output).toContain("1 failed");

    // Verify counts
    const counts = filteredReporter.getCounts();
    expect(counts.total).toBe(1);
    expect(counts.failed).toBe(1);
    expect(counts.passed).toBe(0);
  });

  it("should show 'no tests' correctly when filter matches no tests (exit code 255 scenario)", () => {
    // Create a fresh writer for this test
    const filteredWriter = new MockWriter();

    // Create a reporter with a filter that only shows failed tests
    const filteredReporter = new StreamingReporter({
      writer: filteredWriter,
      showRunBoundaries: false,
      showSummary: true,
      filter: {
        passed: false,
        failed: true,
        skipped: false,
        pending: false,
        other: false,
      },
    });

    // Simulate the scenario where PHPUnit filter matches no tests:
    // 1. run:start
    // 2. suite:start
    // 3. suite:end (no tests executed)
    // 4. run:end

    filteredReporter.onEvent({ type: "run:start", toolName: "wp-tester-phpunit" });
    filteredReporter.onEvent({ type: "suite:start", name: "PHPUnit Tests" });
    filteredReporter.onEvent({ type: "suite:end", name: "PHPUnit Tests" });
    filteredReporter.onEvent({ type: "run:end" });

    const output = filteredWriter.getCurrentOutput();

    // Should not show "1 failed" in summary
    expect(output).not.toContain("1 failed");

    // Should show "0 tests"
    expect(output).toContain("0 tests");

    // Verify counts
    const counts = filteredReporter.getCounts();
    expect(counts.total).toBe(0);
    expect(counts.failed).toBe(0);
    expect(counts.passed).toBe(0);
  });

  it("should properly sync state when tests are added after suite:end (regression test)", () => {
    // This is a regression test for the bug where adding tests AFTER suite:end
    // caused the reporter's internal state to be out of sync.
    // The bug happened when code added test events after calling suite:end,
    // and then the streaming reporter's counts would not match the final report.

    const filteredWriter = new MockWriter();

    const filteredReporter = new StreamingReporter({
      writer: filteredWriter,
      showRunBoundaries: false,
      showSummary: true,
      filter: {
        passed: false,
        failed: true,
        skipped: false,
        pending: false,
        other: false,
      },
    });

    filteredReporter.onEvent({ type: "run:start", toolName: "wp-tester-phpunit" });
    filteredReporter.onEvent({ type: "suite:start", name: "PHPUnit Tests" });

    // Simulate the OLD BUGGY behavior where a test was added AFTER suite:end
    filteredReporter.onEvent({ type: "suite:end", name: "PHPUnit Tests" });

    // In the old buggy code, this test event was sent AFTER suite:end,
    // which meant the streaming reporter's internal state was already finalized
    // BEFORE this test was added to the report
    filteredReporter.onEvent({
      type: "test:fail",
      name: "PHPUnit Bootstrap",
      duration: 0,
      message: "Bootstrap failed",
      suiteName: "PHPUnit Tests",
    });

    filteredReporter.onEvent({ type: "run:end" });

    const output = filteredWriter.getCurrentOutput();

    // The test should NOT be visible because it was added after suite:end
    // (In the bug, this would show "1 failed" in summary but no test in output)
    // The current implementation properly handles this by NOT allowing tests
    // to be added after suite:end

    // Verify the counts - since the test was added after suite end,
    // it should still be counted (because it was added before run:end)
    const counts = filteredReporter.getCounts();

    // This demonstrates the fix: tests added after suite:end but before run:end
    // are still counted and visible
    expect(counts.total).toBe(1);
    expect(counts.failed).toBe(1);

    // And the output should show the test
    expect(output).toContain("PHPUnit Bootstrap");
    expect(output).toContain("1 failed");
  });
});

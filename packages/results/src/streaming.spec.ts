/**
 * Tests for StreamingReporter
 *
 * Tests focus on state management and CTRF report generation.
 * Ink rendering is disabled in tests to avoid terminal dependencies.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { StreamingReporter } from "./streaming.js";

describe("StreamingReporter", () => {
  let reporter: StreamingReporter;

  beforeEach(() => {
    // Disable Ink rendering for tests - focus on state management
    reporter = new StreamingReporter({
      showRunBoundaries: false,
      showSummary: false,
      enabled: false, // Disable Ink rendering
    });
  });

  it("should handle a simple test pass", () => {
    reporter.onEvent({ type: "run:start" });
    reporter.onEvent({ type: "suite:start", name: "My Suite" });
    reporter.onEvent({ type: "test:start", name: "test 1", suiteName: "My Suite" });
    reporter.onEvent({ type: "test:pass", name: "test 1", duration: 100, suiteName: "My Suite" });
    reporter.onEvent({ type: "suite:end", name: "My Suite" });
    reporter.onEvent({ type: "run:end" });

    const counts = reporter.getCounts();
    expect(counts.total).toBe(1);
    expect(counts.passed).toBe(1);
    expect(counts.failed).toBe(0);

    const report = reporter.getReport();
    expect(report.results.tests).toHaveLength(1);
    expect(report.results.tests[0].status).toBe("passed");
    expect(report.results.tests[0].name).toBe("My Suite::test 1");
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

    const counts = reporter.getCounts();
    expect(counts.failed).toBe(1);

    const report = reporter.getReport();
    const failedTest = report.results.tests.find(t => t.status === "failed");
    expect(failedTest).toBeDefined();
    expect(failedTest?.message).toBe("Expected 1 to equal 2");
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

    const counts = reporter.getCounts();
    expect(counts.skipped).toBe(1);

    const report = reporter.getReport();
    const skippedTest = report.results.tests.find(t => t.status === "skipped");
    expect(skippedTest).toBeDefined();
    expect(skippedTest?.message).toBe("Not implemented yet");
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
  });

  it("should handle nested suites", () => {
    reporter.onEvent({ type: "run:start" });
    reporter.onEvent({ type: "suite:start", name: "Outer Suite" });
    reporter.onEvent({ type: "suite:start", name: "Inner Suite" });
    reporter.onEvent({ type: "test:pass", name: "nested test", duration: 50, suiteName: "Inner Suite" });
    reporter.onEvent({ type: "suite:end", name: "Inner Suite" });
    reporter.onEvent({ type: "suite:end", name: "Outer Suite" });

    const counts = reporter.getCounts();
    expect(counts.total).toBe(1);
    expect(counts.passed).toBe(1);
  });

  it("should clean up running tests when suite ends", () => {
    reporter.onEvent({ type: "run:start" });
    reporter.onEvent({ type: "suite:start", name: "Suite" });
    reporter.onEvent({ type: "test:start", name: "hanging test", suiteName: "Suite" });

    // End suite without test completion - should clean up running test
    reporter.onEvent({ type: "suite:end", name: "Suite" });

    // Test should be marked as pending (not running)
    const counts = reporter.getCounts();
    expect(counts.pending).toBe(1);

    const report = reporter.getReport();
    const hangingTest = report.results.tests.find(t => t.name.includes("hanging test"));
    expect(hangingTest?.status).toBe("pending");
  });

  it("should clean up all running tests when run ends", () => {
    reporter.onEvent({ type: "run:start" });
    reporter.onEvent({ type: "suite:start", name: "Suite" });
    reporter.onEvent({ type: "test:start", name: "hanging test", suiteName: "Suite" });

    // End run without completing test
    reporter.onEvent({ type: "run:end" });

    // Test should be marked as pending
    const counts = reporter.getCounts();
    expect(counts.pending).toBe(1);
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
    // Should count both tests separately
    expect(counts.total).toBe(2);
    expect(counts.passed).toBe(2);
  });

  it("should show correct count when failed test is added before run:end with --failed-only", () => {
    // Create a reporter with a filter that only shows failed tests (simulating --failed-only)
    const filteredReporter = new StreamingReporter({
      showRunBoundaries: false,
      showSummary: true,
      enabled: false,
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

    // Verify counts
    const counts = filteredReporter.getCounts();
    expect(counts.total).toBe(1);
    expect(counts.failed).toBe(1);
    expect(counts.passed).toBe(0);
  });

  it("should show 'no tests' correctly when filter matches no tests (exit code 255 scenario)", () => {
    // Create a reporter with a filter that only shows failed tests
    const filteredReporter = new StreamingReporter({
      showRunBoundaries: false,
      showSummary: true,
      enabled: false,
      filter: {
        passed: false,
        failed: true,
        skipped: false,
        pending: false,
        other: false,
      },
    });

    // Simulate the scenario where PHPUnit filter matches no tests
    filteredReporter.onEvent({ type: "run:start", toolName: "wp-tester-phpunit" });
    filteredReporter.onEvent({ type: "suite:start", name: "PHPUnit Tests" });
    filteredReporter.onEvent({ type: "suite:end", name: "PHPUnit Tests" });
    filteredReporter.onEvent({ type: "run:end" });

    // Verify counts
    const counts = filteredReporter.getCounts();
    expect(counts.total).toBe(0);
    expect(counts.failed).toBe(0);
    expect(counts.passed).toBe(0);
  });

  it("should properly sync state when tests are added after suite:end (regression test)", () => {
    const filteredReporter = new StreamingReporter({
      showRunBoundaries: false,
      showSummary: true,
      enabled: false,
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

    // Simulate test event after suite:end
    filteredReporter.onEvent({ type: "suite:end", name: "PHPUnit Tests" });

    // Test event added AFTER suite:end but before run:end
    filteredReporter.onEvent({
      type: "test:fail",
      name: "PHPUnit Bootstrap",
      duration: 0,
      message: "Bootstrap failed",
      suiteName: "PHPUnit Tests",
    });

    filteredReporter.onEvent({ type: "run:end" });

    // Verify the counts - test should still be counted
    const counts = filteredReporter.getCounts();
    expect(counts.total).toBe(1);
    expect(counts.failed).toBe(1);
  });

  it("should handle pending tests correctly", () => {
    reporter.onEvent({ type: "run:start" });
    reporter.onEvent({ type: "suite:start", name: "Suite" });
    reporter.onEvent({ type: "test:pending", name: "todo test", suiteName: "Suite" });
    reporter.onEvent({ type: "suite:end", name: "Suite" });
    reporter.onEvent({ type: "run:end" });

    const counts = reporter.getCounts();
    expect(counts.pending).toBe(1);
    expect(counts.total).toBe(1);

    const report = reporter.getReport();
    const pendingTest = report.results.tests.find(t => t.status === "pending");
    expect(pendingTest).toBeDefined();
  });
});

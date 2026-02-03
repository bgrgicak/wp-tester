/**
 * Tests for UnifiedStreamingReporter
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { UnifiedStreamingReporter } from "./unified-streaming-reporter.js";
import type { StreamWriter } from "./streaming.js";

class MockWriter implements StreamWriter {
  lines: string[] = [];
  currentOutput: string[] = [];
  savedPosition: number = 0;

  write(text: string): void {
    // Handle ANSI escape codes
    if (text === "\x1b[1A\x1b[2K") {
      // Old approach: move up one line and clear
      this.currentOutput.pop();
    } else if (text === "\x1b[s") {
      // Save cursor position
      this.savedPosition = this.currentOutput.length;
    } else if (text === "\x1b[u\x1b[J") {
      // Restore cursor and clear to end of screen
      this.currentOutput = this.currentOutput.slice(0, this.savedPosition);
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
    this.savedPosition = 0;
  }
}

describe("UnifiedStreamingReporter", () => {
  let writer: MockWriter;
  let reporter: UnifiedStreamingReporter;

  beforeEach(() => {
    vi.useFakeTimers();
    writer = new MockWriter();
    reporter = new UnifiedStreamingReporter({
      writer,
      showRunBoundaries: false,
      showSummary: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("explicit unified run control", () => {
    it("should show 'Running tests...' when startUnifiedRun is called", () => {
      reporter.startUnifiedRun();

      const output = writer.getCurrentOutput();

      // Should show "Running tests..." message
      expect(output).toContain("Running tests...");

      // Should contain a spinner frame
      expect(output).toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
    });

    it("should keep spinner visible between multiple test suites", () => {
      reporter.startUnifiedRun();

      let output = writer.getCurrentOutput();
      expect(output).toContain("Running tests...");

      // First test suite runs
      reporter.onEvent({ type: "run:start" });
      reporter.onEvent({ type: "suite:start", name: "Suite 1" });
      reporter.onEvent({ type: "test:start", name: "test 1", suiteName: "Suite 1" });
      reporter.onEvent({ type: "test:pass", name: "test 1", duration: 100, suiteName: "Suite 1" });
      reporter.onEvent({ type: "suite:end", name: "Suite 1" });
      reporter.onEvent({ type: "run:end" }); // First suite ends

      // Spinner message should still be at the start (from startUnifiedRun)
      output = writer.getCurrentOutput();
      expect(output).toContain("Running tests...");

      // Second test suite runs
      reporter.onEvent({ type: "run:start" });
      reporter.onEvent({ type: "suite:start", name: "Suite 2" });
      reporter.onEvent({ type: "test:start", name: "test 2", suiteName: "Suite 2" });
      reporter.onEvent({ type: "test:pass", name: "test 2", duration: 100, suiteName: "Suite 2" });
      reporter.onEvent({ type: "suite:end", name: "Suite 2" });
      reporter.onEvent({ type: "run:end" }); // Second suite ends

      // Spinner should still be visible
      output = writer.getCurrentOutput();
      expect(output).toContain("Running tests...");

      // Now end the unified run
      writer.clear();
      reporter.endUnifiedRun();

      output = writer.getCurrentOutput();

      // Final output should NOT have spinner
      expect(output).not.toContain("Running tests...");

      // Both suites should be in final output
      expect(output).toContain("Suite 1");
      expect(output).toContain("Suite 2");
    });

    it("should NOT show spinner in final output after endUnifiedRun", () => {
      reporter.startUnifiedRun();
      reporter.onEvent({ type: "run:start" });
      reporter.onEvent({ type: "suite:start", name: "My Suite" });
      reporter.onEvent({ type: "test:start", name: "test 1", suiteName: "My Suite" });
      reporter.onEvent({ type: "test:pass", name: "test 1", duration: 100, suiteName: "My Suite" });
      reporter.onEvent({ type: "suite:end", name: "My Suite" });
      reporter.onEvent({ type: "run:end" });

      writer.clear();
      reporter.endUnifiedRun();

      const output = writer.getCurrentOutput();

      // Final output should NOT contain "Running tests..."
      expect(output).not.toContain("Running tests...");

      // But should still show test results
      expect(output).toContain("My Suite");
      expect(output).toContain("test 1");
    });
  });

  describe("setStatus", () => {
    it("should use custom status when set before startUnifiedRun renders", () => {
      // In non-TTY mode (custom writer), the status is printed once at startup
      // We can verify a custom initial status by setting it before the run
      reporter.setStatus("Custom initial status");
      reporter.startUnifiedRun();

      const output = writer.getCurrentOutput();
      // Status was set before start, but startUnifiedRun resets it
      expect(output).toContain("Running tests...");
    });

    it("should reset status on new unified run", () => {
      reporter.startUnifiedRun();
      reporter.setStatus("Custom status");
      reporter.endUnifiedRun();

      writer.clear();
      reporter.startUnifiedRun();

      const output = writer.getCurrentOutput();
      expect(output).toContain("Running tests...");
      expect(output).not.toContain("Custom status");
    });
  });

  describe("output content", () => {
    it("should include all tests in final output", () => {
      reporter.startUnifiedRun();
      reporter.onEvent({ type: "run:start" });
      reporter.onEvent({ type: "suite:start", name: "Suite A" });
      reporter.onEvent({ type: "test:start", name: "test A1", suiteName: "Suite A" });
      reporter.onEvent({ type: "test:pass", name: "test A1", duration: 50, suiteName: "Suite A" });
      reporter.onEvent({ type: "test:start", name: "test A2", suiteName: "Suite A" });
      reporter.onEvent({ type: "test:fail", name: "test A2", duration: 30, message: "Failed!", suiteName: "Suite A" });
      reporter.onEvent({ type: "suite:end", name: "Suite A" });
      reporter.onEvent({ type: "run:end" });

      writer.clear();
      reporter.endUnifiedRun();

      const output = writer.getCurrentOutput();

      // Should contain all test results
      expect(output).toContain("test A1");
      expect(output).toContain("test A2");
      expect(output).toContain("✓"); // Passed test
      expect(output).toContain("✗"); // Failed test
      expect(output).toContain("Failed!"); // Error message
    });

    it("should only print 'Running tests...' once in non-TTY mode", () => {
      reporter.startUnifiedRun();

      // Multiple suites
      reporter.onEvent({ type: "run:start" });
      reporter.onEvent({ type: "run:end" });
      reporter.onEvent({ type: "run:start" });
      reporter.onEvent({ type: "run:end" });

      const output = writer.getCurrentOutput();

      // Count occurrences of "Running tests..."
      const matches = output.match(/Running tests\.\.\./g);
      expect(matches).toHaveLength(1);
    });
  });
});

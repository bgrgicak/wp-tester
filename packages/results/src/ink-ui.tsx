/**
 * Ink-based Test Output UI
 *
 * Provides real-time test result output using Ink (React for CLI).
 * Simple and minimal design for test status display.
 */

import React, { useState, useEffect, useCallback } from "react";
import { render, Box, Text, Static } from "ink";
import Spinner from "ink-spinner";
import type { ReporterFilterOptions } from "./streaming.js";
import { applyDiffHighlighting } from "./diff-utils.js";

/**
 * Test status types
 */
type TestStatus = "running" | "passed" | "failed" | "skipped" | "pending";

/**
 * Test state for display
 */
export interface TestState {
  name: string;
  suiteName?: string;
  status: TestStatus;
  duration?: number;
  message?: string;
  trace?: string;
}

/**
 * Suite state for display
 */
export interface SuiteState {
  name: string;
  depth: number;
  tests: TestState[];
  isLoading: boolean;
}

/**
 * File state for display
 */
export interface FileState {
  fileId: string;
  fileName?: string;
  suites: SuiteState[];
}

/**
 * Overall reporter state
 */
export interface ReporterState {
  files: Map<string, FileState>;
  toolName: string;
  startTime: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  pendingTests: number;
  isRunning: boolean;
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Status icon component
 */
function StatusIcon({ status }: { status: TestStatus }): React.ReactElement {
  switch (status) {
    case "running":
      return <Spinner type="dots" />;
    case "passed":
      return <Text color="green">✓</Text>;
    case "failed":
      return <Text color="red">✗</Text>;
    case "skipped":
      return <Text color="yellow">○</Text>;
    case "pending":
      return <Text color="yellow">◔</Text>;
  }
}

/**
 * Single test row component
 */
function TestRow({
  test,
  depth,
  getFilterCommand,
}: {
  test: TestState;
  depth: number;
  getFilterCommand?: (testName: string, suiteName?: string) => string | null;
}): React.ReactElement {
  const indent = "  ".repeat(depth);
  const durationStr = test.duration ? ` ${formatDuration(test.duration)}` : "";

  return (
    <Box flexDirection="column">
      <Box>
        <Text>{indent}</Text>
        <StatusIcon status={test.status} />
        <Text> </Text>
        {test.status === "running" ? (
          <Text dimColor>{test.name}</Text>
        ) : test.status === "skipped" ? (
          <>
            <Text dimColor>{test.name}</Text>
            <Text dimColor> ({test.message || "Skipped"})</Text>
          </>
        ) : test.status === "pending" ? (
          <>
            <Text dimColor>{test.name}</Text>
            {test.message && <Text dimColor> ({test.message})</Text>}
          </>
        ) : (
          <>
            <Text>{test.name}</Text>
            <Text dimColor>{durationStr}</Text>
          </>
        )}
      </Box>

      {/* Error details for failed tests */}
      {test.status === "failed" && test.message && (
        <Box flexDirection="column" marginLeft={depth * 2 + 2}>
          {test.message.split("\n").map((line, i) => (
            <Text key={i} color="red">
              {line}
            </Text>
          ))}
        </Box>
      )}

      {/* Trace for failed tests */}
      {test.status === "failed" && test.trace && (
        <Box flexDirection="column" marginLeft={depth * 2 + 2}>
          {test.trace.split("\n").map((line, i) => {
            const trimmed = line.trim();
            if (trimmed === "Expected:") {
              return (
                <Text key={i} dimColor>
                  Expected:
                </Text>
              );
            } else if (trimmed === "Actual:") {
              return (
                <Text key={i} dimColor>
                  Actual:
                </Text>
              );
            } else if (trimmed) {
              // Apply diff highlighting - this adds color markers
              const highlighted = applyDiffHighlighting(line, (s) => s);
              return (
                <Text key={i} dimColor>
                  {highlighted}
                </Text>
              );
            }
            return <Text key={i}> </Text>;
          })}

          {/* Re-run command hint */}
          {getFilterCommand && test.name && (
            <Box flexDirection="column" marginTop={1}>
              <Text dimColor>Re-run only this test by appending:</Text>
              <Text dimColor>
                {getFilterCommand(test.name, test.suiteName)}
              </Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

/**
 * Suite component
 */
function Suite({
  suite,
  filter,
  getFilterCommand,
}: {
  suite: SuiteState;
  filter: ReporterFilterOptions;
  getFilterCommand?: (testName: string, suiteName?: string) => string | null;
}): React.ReactElement | null {
  const indent = "  ".repeat(suite.depth);

  // Filter visible tests
  const visibleTests = suite.tests.filter((test) =>
    shouldShowStatus(test.status, filter)
  );

  // Show suite if it's loading with no tests or has visible tests
  const showSpinner = suite.isLoading && suite.tests.length === 0;
  const hasVisibleContent = showSpinner || visibleTests.length > 0;

  if (!hasVisibleContent) {
    return null;
  }

  return (
    <Box flexDirection="column">
      <Box>
        <Text>{indent}</Text>
        {showSpinner ? (
          <>
            <Text color="cyan">
              <Spinner type="dots" />
            </Text>
            <Text> </Text>
          </>
        ) : (
          <Text>{"  "}</Text>
        )}
        <Text bold>{suite.name}</Text>
      </Box>

      {visibleTests.map((test, i) => (
        <TestRow
          key={`${test.name}-${i}`}
          test={test}
          depth={suite.depth + 1}
          getFilterCommand={getFilterCommand}
        />
      ))}
    </Box>
  );
}

/**
 * Check if a test status should be displayed based on filter
 */
function shouldShowStatus(
  status: TestStatus,
  filter: ReporterFilterOptions
): boolean {
  if (status === "running") return true;

  const filterMap: Record<
    Exclude<TestStatus, "running">,
    keyof ReporterFilterOptions
  > = {
    passed: "passed",
    failed: "failed",
    skipped: "skipped",
    pending: "pending",
  };

  const filterKey = filterMap[status];
  return filter[filterKey] ?? false;
}

/**
 * Summary component
 */
function Summary({
  state,
  duration,
}: {
  state: ReporterState;
  duration: number;
}): React.ReactElement {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text> </Text>
      {state.passedTests > 0 && (
        <Text color="green">{"  "}✓ {state.passedTests} passed</Text>
      )}
      {state.failedTests > 0 && (
        <Text color="red">{"  "}✗ {state.failedTests} failed</Text>
      )}
      {state.skippedTests > 0 && (
        <Text color="yellow">{"  "}○ {state.skippedTests} skipped</Text>
      )}
      {state.pendingTests > 0 && (
        <Text color="yellow">{"  "}◔ {state.pendingTests} pending</Text>
      )}
      <Text> </Text>
      <Text dimColor>
        {"  "}
        {state.totalTests} tests in {formatDuration(duration)}
      </Text>
      <Text> </Text>
      <Text dimColor>{"  "}Legend: ✓ passed ✗ failed ○ skipped ◔ pending</Text>
      <Text> </Text>
    </Box>
  );
}

/**
 * Props for TestOutput component
 */
interface TestOutputProps {
  state: ReporterState;
  filter: ReporterFilterOptions;
  showSummary: boolean;
  getFilterCommand?: (testName: string, suiteName?: string) => string | null;
}

/**
 * Completed test item for Static rendering
 */
interface CompletedItem {
  type: "suite";
  suite: SuiteState;
  fileId: string;
}

/**
 * Main test output component
 */
function TestOutput({
  state,
  filter,
  showSummary,
  getFilterCommand,
}: TestOutputProps): React.ReactElement {
  // Collect completed items (suites with no running tests)
  const completedItems: CompletedItem[] = [];
  const activeItems: { fileId: string; suite: SuiteState }[] = [];

  for (const file of state.files.values()) {
    for (const suite of file.suites) {
      const hasRunningTests = suite.tests.some((t) => t.status === "running");
      const hasVisibleTests = suite.tests.some((t) =>
        shouldShowStatus(t.status, filter)
      );
      const showSpinner = suite.isLoading && suite.tests.length === 0;

      if (hasRunningTests || showSpinner) {
        activeItems.push({ fileId: file.fileId, suite });
      } else if (hasVisibleTests) {
        completedItems.push({ type: "suite", suite, fileId: file.fileId });
      }
    }
  }

  const duration = state.isRunning ? 0 : Date.now() - state.startTime;

  return (
    <Box flexDirection="column">
      {/* Completed suites - rendered once, won't re-render */}
      <Static items={completedItems}>
        {(item: CompletedItem) => (
          <Suite
            key={`${item.fileId}-${item.suite.name}`}
            suite={item.suite}
            filter={filter}
            getFilterCommand={getFilterCommand}
          />
        )}
      </Static>

      {/* Active/running suites */}
      {activeItems.map(({ fileId, suite }) => (
        <Suite
          key={`active-${fileId}-${suite.name}`}
          suite={suite}
          filter={filter}
          getFilterCommand={getFilterCommand}
        />
      ))}

      {/* Summary when finished */}
      {!state.isRunning && showSummary && (
        <Summary state={state} duration={duration} />
      )}
    </Box>
  );
}

/**
 * Ink renderer instance interface
 */
export interface InkRenderer {
  rerender: (state: ReporterState) => void;
  unmount: () => void;
  waitUntilExit: () => Promise<void>;
}

/**
 * Create an Ink renderer for test output
 */
export function createInkRenderer(
  filter: ReporterFilterOptions,
  showSummary: boolean,
  getFilterCommand?: (testName: string, suiteName?: string) => string | null
): InkRenderer {
  let currentState: ReporterState = {
    files: new Map(),
    toolName: "wp-tester",
    startTime: Date.now(),
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    skippedTests: 0,
    pendingTests: 0,
    isRunning: true,
  };

  // Wrapper component that receives state updates
  function App(): React.ReactElement {
    const [state, setState] = useState<ReporterState>(currentState);

    // Store setState for external updates
    useEffect(() => {
      setStateCallback = setState;
      return () => {
        setStateCallback = null;
      };
    }, []);

    return (
      <TestOutput
        state={state}
        filter={filter}
        showSummary={showSummary}
        getFilterCommand={getFilterCommand}
      />
    );
  }

  let setStateCallback: React.Dispatch<
    React.SetStateAction<ReporterState>
  > | null = null;

  const instance = render(<App />);

  return {
    rerender: (state: ReporterState) => {
      currentState = state;
      if (setStateCallback) {
        // Create a new state object to trigger re-render
        setStateCallback({
          ...state,
          files: new Map(state.files),
        });
      }
    },
    unmount: () => {
      instance.unmount();
    },
    waitUntilExit: () => instance.waitUntilExit(),
  };
}

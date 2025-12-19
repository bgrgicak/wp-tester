import { parseStringPromise } from "xml2js";
import { EMPTY_REPORT, type Report, type TestStatus } from "@wp-tester/results";

/**
 * JUnit XML testsuite structure
 */
interface JUnitTestSuite {
  $?: {
    name?: string;
    tests?: string;
    failures?: string;
    errors?: string;
    skipped?: string;
    time?: string;
  };
  testcase?: JUnitTestCase[];
  testsuite?: JUnitTestSuite[]; // Nested testsuites
}

/**
 * JUnit XML testcase structure
 */
interface JUnitTestCase {
  $?: {
    name?: string;
    class?: string;
    classname?: string;
    file?: string;
    time?: string;
  };
  failure?: Array<{ _?: string; $?: { message?: string; type?: string } }>;
  error?: Array<{ _?: string; $?: { message?: string; type?: string } }>;
  skipped?: Array<{ _?: string; $?: { message?: string } }>;
}

/**
 * JUnit XML root structure
 */
interface JUnitXML {
  testsuites?: {
    testsuite?: JUnitTestSuite[];
  };
  testsuite?: JUnitTestSuite;
}

/**
 * Parse JUnit XML output to CTRF format
 * PHPUnit outputs test results in JUnit XML format
 *
 * @param xmlOutput - JUnit XML output string
 * @param environmentName - Name of the test environment
 * @returns CTRF Report
 */
export async function parseJUnitXml(
  xmlOutput: string,
  environmentName?: string
): Promise<Report> {
  const startTime = Date.now();

  try {
    const parsed = (await parseStringPromise(xmlOutput)) as JUnitXML;

    // Handle both single testsuite and testsuites wrapper
    const testsuites: JUnitTestSuite[] = parsed.testsuites?.testsuite ||
      (parsed.testsuite ? [parsed.testsuite] : []);

    if (testsuites.length === 0) {
      return EMPTY_REPORT;
    }

    // Collect all tests from all test suites (recursively)
    const tests: Array<{
      name: string;
      status: TestStatus;
      duration: number;
      message?: string;
      trace?: string;
    }> = [];

    // Recursive function to extract testcases from nested testsuites
    function collectTestCases(suite: JUnitTestSuite): void {
      // Process testcases in this suite
      const testcases = suite.testcase || [];
      for (const testcase of testcases) {
        const attrs = testcase.$ || {};
        const testName = attrs.name || "Unknown test";
        const className = attrs.class || attrs.classname || "";
        const fullName = className ? `${className}::${testName}` : testName;
        const duration = attrs.time ? parseFloat(attrs.time) * 1000 : 0; // Convert to ms

        let status: TestStatus = "passed";
        let message: string | undefined;
        let trace: string | undefined;

        // Check for failure
        if (testcase.failure && testcase.failure.length > 0) {
          status = "failed";
          const failure = testcase.failure[0];
          message = failure.$?.message || failure.$?.type || "Test failed";
          trace = failure._ || "";
        }
        // Check for error
        else if (testcase.error && testcase.error.length > 0) {
          status = "failed";
          const error = testcase.error[0];
          message = error.$?.message || error.$?.type || "Test error";
          trace = error._ || "";
        }
        // Check for skipped
        else if (testcase.skipped && testcase.skipped.length > 0) {
          status = "skipped";
          const skipped = testcase.skipped[0];
          message = skipped.$?.message || "Test skipped";
        }

        tests.push({
          name: fullName,
          status,
          duration,
          ...(message && { message }),
          ...(trace && { trace }),
        });
      }

      // Recursively process nested testsuites
      const nestedSuites = suite.testsuite || [];
      for (const nestedSuite of nestedSuites) {
        collectTestCases(nestedSuite);
      }
    }

    // Collect test cases from all top-level testsuites
    for (const suite of testsuites) {
      collectTestCases(suite);
    }

    // Calculate summary
    const stopTime = Date.now();
    const passed = tests.filter((t) => t.status === "passed").length;
    const failed = tests.filter((t) => t.status === "failed").length;
    const skipped = tests.filter((t) => t.status === "skipped").length;
    const pending = tests.filter((t) => t.status === "pending").length;

    const toolName = environmentName
      ? `wp-tester-phpunit (${environmentName})`
      : "wp-tester-phpunit";

    return {
      ...EMPTY_REPORT,
      results: {
        summary: {
          tests: tests.length,
          passed,
          failed,
          skipped,
          pending,
          other: 0,
          start: startTime,
          stop: stopTime,
        },
        tool: {
          name: toolName,
        },
        tests: tests.map((test) => ({
          name: test.name,
          status: test.status,
          duration: test.duration,
          ...(test.message && { message: test.message }),
          ...(test.trace && { trace: test.trace }),
        })),
      },
    };
  } catch (error) {
    console.error("Error parsing JUnit XML:", error);
    return EMPTY_REPORT;
  }
}

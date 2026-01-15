import { describe, it, expect } from "vitest";
import { parseTeamCityOutput, TeamCityParser } from "@wp-tester/results";
import type { StreamEvent } from "@wp-tester/results";

describe("TeamCityParser", () => {
  describe("parseTeamCityOutput", () => {
    it("should parse a passing test", () => {
      const output = `
##teamcity[testSuiteStarted name='TestClass']
##teamcity[testStarted name='testMethod']
##teamcity[testFinished name='testMethod' duration='123']
##teamcity[testSuiteFinished name='TestClass']
`;
      const events = parseTeamCityOutput(output);

      expect(events).toHaveLength(4);
      expect(events[0]).toEqual({ type: "suite:start", name: "TestClass" });
      expect(events[1]).toMatchObject({
        type: "test:start",
        name: "testMethod",
        suiteName: "TestClass",
      });
      expect(events[2]).toMatchObject({
        type: "test:pass",
        name: "testMethod",
        suiteName: "TestClass",
        duration: 123,
      });
      expect(events[3]).toEqual({ type: "suite:end", name: "TestClass" });
    });

    it("should parse a failing test", () => {
      const output = `
##teamcity[testSuiteStarted name='TestClass']
##teamcity[testStarted name='testMethod']
##teamcity[testFailed name='testMethod' message='Assertion failed' details='Stack trace here']
##teamcity[testFinished name='testMethod' duration='50']
##teamcity[testSuiteFinished name='TestClass']
`;
      const events = parseTeamCityOutput(output);

      expect(events).toHaveLength(4);
      expect(events[0]).toEqual({ type: "suite:start", name: "TestClass" });
      expect(events[1]).toMatchObject({
        type: "test:start",
        name: "testMethod",
        suiteName: "TestClass",
      });
      expect(events[2]).toMatchObject({
        type: "test:fail",
        name: "testMethod",
        suiteName: "TestClass",
        message: "Assertion failed",
        trace: "Stack trace here",
      });
      // testFinished after testFailed should be skipped
      expect(events[3]).toEqual({ type: "suite:end", name: "TestClass" });
    });

    it("should parse a comparison failure and format the diff", () => {
      const output = `
##teamcity[testSuiteStarted name='TestClass']
##teamcity[testStarted name='testMethod']
##teamcity[testFailed name='testMethod' message='Failed asserting that two strings are equal.' details='/path/to/file.php:42' type='comparisonFailure' actual='|'Hello World|'' expected='|'Hello World Test|'']
##teamcity[testFinished name='testMethod' duration='50']
##teamcity[testSuiteFinished name='TestClass']
`;
      const events = parseTeamCityOutput(output);

      expect(events).toHaveLength(4);
      expect(events[2]).toMatchObject({
        type: "test:fail",
        name: "testMethod",
        suiteName: "TestClass",
        message: "Failed asserting that two strings are equal.",
      });

      // Verify the trace includes the formatted diff with highlighting markers
      const failEvent = events[2] as { trace?: string };
      expect(failEvent.trace).toContain("Expected:");
      expect(failEvent.trace).toContain("'Hello World« Test»'");
      expect(failEvent.trace).toContain("Actual:");
      expect(failEvent.trace).toContain("'Hello World'");
      expect(failEvent.trace).toContain("/path/to/file.php:42");
    });

    it("should parse a skipped test", () => {
      const output = `
##teamcity[testSuiteStarted name='TestClass']
##teamcity[testStarted name='testMethod']
##teamcity[testIgnored name='testMethod' message='Not implemented yet']
##teamcity[testSuiteFinished name='TestClass']
`;
      const events = parseTeamCityOutput(output);

      expect(events).toHaveLength(4);
      expect(events[2]).toMatchObject({
        type: "test:skip",
        name: "testMethod",
        suiteName: "TestClass",
        message: "Not implemented yet",
      });
    });

    it("should unescape TeamCity values", () => {
      const output = `##teamcity[testFailed name='testMethod' message='It|'s a test|nwith newlines']`;
      const events = parseTeamCityOutput(output);

      expect(events[0]).toMatchObject({
        message: "It's a test\nwith newlines",
      });
    });

    it("should handle multiple consecutive pipes", () => {
      const output = `##teamcity[testFailed name='testMethod' message='Value with || double pipe']`;
      const events = parseTeamCityOutput(output);

      expect(events[0]).toMatchObject({
        message: "Value with | double pipe",
      });
    });

    it("should handle complex escape sequences", () => {
      const output = `##teamcity[testFailed name='testMethod' message='Line 1|nLine 2|rLine 3|nWith |'quotes|' and || pipes']`;
      const events = parseTeamCityOutput(output);

      expect(events[0]).toMatchObject({
        message: "Line 1\nLine 2\rLine 3\nWith 'quotes' and | pipes",
      });
    });

    it("should handle escaped brackets", () => {
      const output = `##teamcity[testFailed name='testMethod' message='Array|[0|] = value']`;
      const events = parseTeamCityOutput(output);

      expect(events[0]).toMatchObject({
        message: "Array[0] = value",
      });
    });

    it("should handle multiple escaped pipes in a row", () => {
      // In TeamCity format, || escapes to |
      // So 6 pipes (||||||) unescapes to 3 pipes (|||)
      // Using 6 pipes for a clean test case
      const output = `##teamcity[testFailed name='testMethod' message='||||||']`;
      const events = parseTeamCityOutput(output);

      expect(events[0]).toMatchObject({
        message: "|||",
      });
    });

    it("should handle multiple tests", () => {
      const output = `
##teamcity[testSuiteStarted name='Suite']
##teamcity[testStarted name='test1']
##teamcity[testFinished name='test1' duration='10']
##teamcity[testStarted name='test2']
##teamcity[testFinished name='test2' duration='20']
##teamcity[testStarted name='test3']
##teamcity[testFailed name='test3' message='Failed']
##teamcity[testFinished name='test3' duration='30']
##teamcity[testSuiteFinished name='Suite']
`;
      const events = parseTeamCityOutput(output);

      // Should have: suite:start, 3x (test:start + result), suite:end
      const passEvents = events.filter((e) => e.type === "test:pass");
      const failEvents = events.filter((e) => e.type === "test:fail");

      expect(passEvents).toHaveLength(2);
      expect(failEvents).toHaveLength(1);
    });
  });

  describe("TeamCityParser streaming", () => {
    it("should handle chunked input", () => {
      const events: StreamEvent[] = [];
      const parser = TeamCityParser.withEventHandler((event) =>
        events.push(event)
      );

      // Simulate chunked input
      parser.write("##teamcity[testSuiteStart");
      parser.write("ed name='Suite']\n");
      parser.write("##teamcity[testStarted name='test1']\n##team");
      parser.write("city[testFinished name='test1' duration='100']\n");
      parser.flush();

      expect(events).toHaveLength(3);
      expect(events[0].type).toBe("suite:start");
      expect(events[1].type).toBe("test:start");
      expect(events[2].type).toBe("test:pass");
    });

    it("should ignore non-TeamCity lines", () => {
      const output = `
PHPUnit 10.5.0 by Sebastian Bergmann
..F.
##teamcity[testStarted name='test1']
##teamcity[testFinished name='test1' duration='10']
Time: 00:00.123
`;
      const events = parseTeamCityOutput(output);

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe("test:start");
      expect(events[1].type).toBe("test:pass");
    });

    it("should reset parser state", () => {
      const events: StreamEvent[] = [];
      const parser = TeamCityParser.withEventHandler((event) =>
        events.push(event)
      );

      parser.write("##teamcity[testStarted name='test1']\n");
      parser.reset();
      parser.write("##teamcity[testStarted name='test2']\n");
      parser.flush();

      expect(events).toHaveLength(2);
      expect((events[0] as { name: string }).name).toBe("test1");
      expect((events[1] as { name: string }).name).toBe("test2");
    });
  });
});

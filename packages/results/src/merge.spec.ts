import { describe, it, expect } from 'vitest';
import { mergeReports } from './merge.js';
import type { Report } from 'ctrf';

describe('mergeReports', () => {
  it('should throw error when given empty array', () => {
    expect(() => mergeReports([])).toThrow('Cannot merge empty array of reports');
  });

  it('should return new copy of single report without mutation', () => {
    const report: Report = {
      results: {
        summary: {
          tests: 5,
          passed: 5,
          failed: 0,
          skipped: 0,
          pending: 0,
          other: 0,
          start: 1000,
          stop: 2000,
        },
        tool: { name: 'test-tool' },
        tests: [{ name: 'test1', status: 'passed', duration: 100 }],
      },
      reportFormat: 'CTRF',
      specVersion: '0.0.4',
    };

    const result = mergeReports([report]);

    // Should be a new object
    expect(result).not.toBe(report);
    expect(result.results).not.toBe(report.results);
    expect(result.results.summary).not.toBe(report.results.summary);
    expect(result.results.tests).not.toBe(report.results.tests);

    // Should have same values
    expect(result).toEqual(report);
  });

  it('should correctly merge two reports', () => {
    const report1: Report = {
      results: {
        summary: {
          tests: 5,
          passed: 4,
          failed: 1,
          skipped: 0,
          pending: 0,
          other: 0,
          start: 1000,
          stop: 2000,
        },
        tool: { name: 'smoke-tests' },
        tests: [
          { name: 'test1', status: 'passed', duration: 100 },
          { name: 'test2', status: 'failed', duration: 200 },
        ],
      },
      reportFormat: 'CTRF',
      specVersion: '0.0.4',
    };

    const report2: Report = {
      results: {
        summary: {
          tests: 3,
          passed: 2,
          failed: 0,
          skipped: 1,
          pending: 0,
          other: 0,
          start: 1500,
          stop: 2500,
        },
        tool: { name: 'phpunit' },
        tests: [
          { name: 'test3', status: 'passed', duration: 150 },
          { name: 'test4', status: 'skipped', duration: 0 },
        ],
      },
      reportFormat: 'CTRF',
      specVersion: '0.0.4',
    };

    const result = mergeReports([report1, report2]);

    // Check summary aggregation
    expect(result.results.summary.tests).toBe(8);
    expect(result.results.summary.passed).toBe(6);
    expect(result.results.summary.failed).toBe(1);
    expect(result.results.summary.skipped).toBe(1);
    expect(result.results.summary.pending).toBe(0);
    expect(result.results.summary.other).toBe(0);

    // Check time calculation (earliest start, latest stop)
    expect(result.results.summary.start).toBe(1000);
    expect(result.results.summary.stop).toBe(2500);

    // Check tool field
    expect(result.results.tool.name).toBe('wp-tester');

    // Check tests concatenation
    expect(result.results.tests).toHaveLength(4);
    expect(result.results.tests[0].name).toBe('test1');
    expect(result.results.tests[3].name).toBe('test4');

    // Check CTRF fields
    expect(result.reportFormat).toBe('CTRF');
    expect(result.specVersion).toBe('0.0.4');
  });

  it('should handle three or more reports', () => {
    const report1: Report = {
      results: {
        summary: { tests: 2, passed: 2, failed: 0, skipped: 0, pending: 0, other: 0, start: 1000, stop: 1500 },
        tool: { name: 'tool1' },
        tests: [{ name: 'test1', status: 'passed', duration: 100 }],
      },
      reportFormat: 'CTRF',
      specVersion: '0.0.4',
    };

    const report2: Report = {
      results: {
        summary: { tests: 3, passed: 2, failed: 1, skipped: 0, pending: 0, other: 0, start: 1200, stop: 1800 },
        tool: { name: 'tool2' },
        tests: [{ name: 'test2', status: 'failed', duration: 200 }],
      },
      reportFormat: 'CTRF',
      specVersion: '0.0.4',
    };

    const report3: Report = {
      results: {
        summary: { tests: 1, passed: 0, failed: 0, skipped: 0, pending: 1, other: 0, start: 1100, stop: 2000 },
        tool: { name: 'tool3' },
        tests: [{ name: 'test3', status: 'pending', duration: 0 }],
      },
      reportFormat: 'CTRF',
      specVersion: '0.0.4',
    };

    const result = mergeReports([report1, report2, report3]);

    expect(result.results.summary.tests).toBe(6);
    expect(result.results.summary.passed).toBe(4);
    expect(result.results.summary.failed).toBe(1);
    expect(result.results.summary.pending).toBe(1);
    expect(result.results.summary.start).toBe(1000);
    expect(result.results.summary.stop).toBe(2000);
    expect(result.results.tests).toHaveLength(3);
  });

  it('should not mutate input reports', () => {
    const report1: Report = {
      results: {
        summary: { tests: 2, passed: 2, failed: 0, skipped: 0, pending: 0, other: 0, start: 1000, stop: 1500 },
        tool: { name: 'tool1' },
        tests: [{ name: 'test1', status: 'passed', duration: 100 }],
      },
      reportFormat: 'CTRF',
      specVersion: '0.0.4',
    };

    const report2: Report = {
      results: {
        summary: { tests: 3, passed: 3, failed: 0, skipped: 0, pending: 0, other: 0, start: 1200, stop: 1800 },
        tool: { name: 'tool2' },
        tests: [{ name: 'test2', status: 'passed', duration: 200 }],
      },
      reportFormat: 'CTRF',
      specVersion: '0.0.4',
    };

    const originalReport1 = JSON.parse(JSON.stringify(report1));
    const originalReport2 = JSON.parse(JSON.stringify(report2));

    mergeReports([report1, report2]);

    // Verify inputs unchanged
    expect(report1).toEqual(originalReport1);
    expect(report2).toEqual(originalReport2);
  });
});

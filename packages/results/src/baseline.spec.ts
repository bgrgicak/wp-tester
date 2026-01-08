import { describe, it, expect } from 'vitest';
import { compareToBaseline } from './baseline.js';
import type { Report } from 'ctrf';

function createReport(tests: { name: string; status: 'passed' | 'failed' | 'skipped' }[]): Report {
  const summary = {
    tests: tests.length,
    passed: tests.filter(t => t.status === 'passed').length,
    failed: tests.filter(t => t.status === 'failed').length,
    skipped: tests.filter(t => t.status === 'skipped').length,
    pending: 0,
    other: 0,
    start: 1000,
    stop: 2000,
  };

  return {
    results: {
      summary,
      tool: { name: 'test-tool' },
      tests: tests.map(t => ({ name: t.name, status: t.status, duration: 100 })),
    },
    reportFormat: 'CTRF',
    specVersion: '0.0.4',
  };
}

describe('compareToBaseline', () => {
  describe('when results are identical', () => {
    it('should report no regressions and no improvements', () => {
      const baseline = createReport([
        { name: 'test1', status: 'passed' },
        { name: 'test2', status: 'passed' },
      ]);
      const current = createReport([
        { name: 'test1', status: 'passed' },
        { name: 'test2', status: 'passed' },
      ]);

      const result = compareToBaseline(current, baseline);

      expect(result.regressions).toHaveLength(0);
      expect(result.improvements).toHaveLength(0);
      expect(result.passed).toBe(true);
    });

    it('should handle baseline with existing failures', () => {
      const baseline = createReport([
        { name: 'test1', status: 'passed' },
        { name: 'test2', status: 'failed' },
      ]);
      const current = createReport([
        { name: 'test1', status: 'passed' },
        { name: 'test2', status: 'failed' },
      ]);

      const result = compareToBaseline(current, baseline);

      expect(result.regressions).toHaveLength(0);
      expect(result.improvements).toHaveLength(0);
      expect(result.passed).toBe(true);
    });
  });

  describe('regression detection', () => {
    it('should detect when a passing test starts failing', () => {
      const baseline = createReport([
        { name: 'test1', status: 'passed' },
        { name: 'test2', status: 'passed' },
      ]);
      const current = createReport([
        { name: 'test1', status: 'passed' },
        { name: 'test2', status: 'failed' },
      ]);

      const result = compareToBaseline(current, baseline);

      expect(result.regressions).toHaveLength(1);
      expect(result.regressions[0].type).toBe('new_failure');
      expect(result.regressions[0].test.name).toBe('test2');
      expect(result.passed).toBe(false);
    });

    it('should detect multiple regressions', () => {
      const baseline = createReport([
        { name: 'test1', status: 'passed' },
        { name: 'test2', status: 'passed' },
        { name: 'test3', status: 'passed' },
      ]);
      const current = createReport([
        { name: 'test1', status: 'failed' },
        { name: 'test2', status: 'passed' },
        { name: 'test3', status: 'failed' },
      ]);

      const result = compareToBaseline(current, baseline);

      expect(result.regressions).toHaveLength(2);
      expect(result.regressions.map(r => r.test.name)).toContain('test1');
      expect(result.regressions.map(r => r.test.name)).toContain('test3');
      expect(result.passed).toBe(false);
    });

    it('should detect new failing tests as regressions', () => {
      const baseline = createReport([
        { name: 'test1', status: 'passed' },
      ]);
      const current = createReport([
        { name: 'test1', status: 'passed' },
        { name: 'test2', status: 'failed' },
      ]);

      const result = compareToBaseline(current, baseline);

      expect(result.regressions).toHaveLength(1);
      expect(result.regressions[0].type).toBe('new_failure');
      expect(result.regressions[0].test.name).toBe('test2');
      expect(result.passed).toBe(false);
    });

    it('should NOT flag new passing tests as regressions', () => {
      const baseline = createReport([
        { name: 'test1', status: 'passed' },
      ]);
      const current = createReport([
        { name: 'test1', status: 'passed' },
        { name: 'test2', status: 'passed' },
      ]);

      const result = compareToBaseline(current, baseline);

      expect(result.regressions).toHaveLength(0);
      expect(result.passed).toBe(true);
    });

    it('should NOT flag tests that were already failing as regressions', () => {
      const baseline = createReport([
        { name: 'test1', status: 'passed' },
        { name: 'test2', status: 'failed' },
      ]);
      const current = createReport([
        { name: 'test1', status: 'passed' },
        { name: 'test2', status: 'failed' },
      ]);

      const result = compareToBaseline(current, baseline);

      expect(result.regressions).toHaveLength(0);
      expect(result.passed).toBe(true);
    });
  });

  describe('improvement detection', () => {
    it('should detect when a failing test starts passing', () => {
      const baseline = createReport([
        { name: 'test1', status: 'passed' },
        { name: 'test2', status: 'failed' },
      ]);
      const current = createReport([
        { name: 'test1', status: 'passed' },
        { name: 'test2', status: 'passed' },
      ]);

      const result = compareToBaseline(current, baseline);

      expect(result.improvements).toHaveLength(1);
      expect(result.improvements[0].type).toBe('fixed');
      expect(result.improvements[0].test.name).toBe('test2');
      expect(result.passed).toBe(true);
    });

    it('should detect when a failing test is removed', () => {
      const baseline = createReport([
        { name: 'test1', status: 'passed' },
        { name: 'test2', status: 'failed' },
      ]);
      const current = createReport([
        { name: 'test1', status: 'passed' },
      ]);

      const result = compareToBaseline(current, baseline);

      expect(result.improvements).toHaveLength(1);
      expect(result.improvements[0].type).toBe('removed');
      expect(result.improvements[0].test.name).toBe('test2');
      expect(result.passed).toBe(true);
    });

    it('should detect multiple improvements', () => {
      const baseline = createReport([
        { name: 'test1', status: 'failed' },
        { name: 'test2', status: 'failed' },
        { name: 'test3', status: 'passed' },
      ]);
      const current = createReport([
        { name: 'test1', status: 'passed' },
        { name: 'test2', status: 'passed' },
        { name: 'test3', status: 'passed' },
      ]);

      const result = compareToBaseline(current, baseline);

      expect(result.improvements).toHaveLength(2);
      expect(result.improvements.map(i => i.test.name)).toContain('test1');
      expect(result.improvements.map(i => i.test.name)).toContain('test2');
      expect(result.passed).toBe(true);
    });
  });

  describe('mixed scenarios', () => {
    it('should detect both regressions and improvements', () => {
      const baseline = createReport([
        { name: 'test1', status: 'passed' },
        { name: 'test2', status: 'failed' },
        { name: 'test3', status: 'passed' },
      ]);
      const current = createReport([
        { name: 'test1', status: 'failed' },
        { name: 'test2', status: 'passed' },
        { name: 'test3', status: 'passed' },
      ]);

      const result = compareToBaseline(current, baseline);

      expect(result.regressions).toHaveLength(1);
      expect(result.regressions[0].test.name).toBe('test1');
      expect(result.improvements).toHaveLength(1);
      expect(result.improvements[0].test.name).toBe('test2');
      expect(result.passed).toBe(false);
    });

    it('should handle completely new test suite', () => {
      const baseline = createReport([
        { name: 'old1', status: 'passed' },
        { name: 'old2', status: 'failed' },
      ]);
      const current = createReport([
        { name: 'new1', status: 'passed' },
        { name: 'new2', status: 'passed' },
      ]);

      const result = compareToBaseline(current, baseline);

      // old2 was failing and removed -> improvement
      expect(result.improvements).toHaveLength(1);
      expect(result.improvements[0].test.name).toBe('old2');
      // new tests are passing -> no regression
      expect(result.regressions).toHaveLength(0);
      expect(result.passed).toBe(true);
    });

    it('should handle skipped tests (neither regression nor improvement)', () => {
      const baseline = createReport([
        { name: 'test1', status: 'passed' },
        { name: 'test2', status: 'skipped' },
      ]);
      const current = createReport([
        { name: 'test1', status: 'passed' },
        { name: 'test2', status: 'skipped' },
      ]);

      const result = compareToBaseline(current, baseline);

      expect(result.regressions).toHaveLength(0);
      expect(result.improvements).toHaveLength(0);
      expect(result.passed).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty baseline', () => {
      const baseline = createReport([]);
      const current = createReport([
        { name: 'test1', status: 'passed' },
      ]);

      const result = compareToBaseline(current, baseline);

      expect(result.regressions).toHaveLength(0);
      expect(result.improvements).toHaveLength(0);
      expect(result.passed).toBe(true);
    });

    it('should handle empty current results', () => {
      const baseline = createReport([
        { name: 'test1', status: 'passed' },
        { name: 'test2', status: 'failed' },
      ]);
      const current = createReport([]);

      const result = compareToBaseline(current, baseline);

      // Failing test removed -> improvement
      expect(result.improvements).toHaveLength(1);
      expect(result.improvements[0].test.name).toBe('test2');
      expect(result.regressions).toHaveLength(0);
      expect(result.passed).toBe(true);
    });

    it('should handle both empty', () => {
      const baseline = createReport([]);
      const current = createReport([]);

      const result = compareToBaseline(current, baseline);

      expect(result.regressions).toHaveLength(0);
      expect(result.improvements).toHaveLength(0);
      expect(result.passed).toBe(true);
    });
  });
});

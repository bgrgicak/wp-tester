import { describe, it, expect } from 'vitest';
import { selectTestFiles } from '../src/index.js';
import type { Tests } from '@wp-tester/config';

describe('selectTestFiles', () => {
  it('should select wp.spec.ts when tests.wp is true', () => {
    const tests: Tests = { wp: true };
    const files = selectTestFiles(tests);
    expect(files).toEqual(['tests/wp.spec.ts']);
  });

  it('should throw error when no tests are configured', () => {
    const tests: Tests = {};
    expect(() => selectTestFiles(tests)).toThrow('No test files selected');
  });

  it('should throw error when wp is false', () => {
    const tests: Tests = { wp: false };
    expect(() => selectTestFiles(tests)).toThrow('No test files selected');
  });
});

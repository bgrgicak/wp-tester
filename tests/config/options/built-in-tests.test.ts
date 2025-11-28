import { describe, it, expect } from 'vitest';
import { buildTestsConfig } from '../../../src/config/options/built-in-tests.js';

describe('buildTestsConfig', () => {
  it('should return empty object for "other" project type', () => {
    expect(buildTestsConfig('other')).toEqual({wp: true});
    expect(buildTestsConfig('other', 'some-slug')).toEqual({wp: true});
  });

  it('should build plugin tests config', () => {
    expect(buildTestsConfig('plugin', 'my-awesome-plugin')).toEqual({
      wp: true,
      plugin: 'my-awesome-plugin',
    });
  });

  it('should build theme tests config', () => {
    expect(buildTestsConfig('theme', 'my-awesome-theme')).toEqual({
      wp: true,
      theme: 'my-awesome-theme',
    });
  });
});

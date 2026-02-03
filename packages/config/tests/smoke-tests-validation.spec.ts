import { describe, it, expect } from 'vitest';
import { validateSmokeTests, KNOWN_SMOKE_TESTS } from '../src/smoke-tests-validation';
import type { SmokeTests } from '../src/types';

describe('validateSmokeTests', () => {
  describe('valid configurations', () => {
    it('should accept boolean true', () => {
      expect(() => validateSmokeTests(true)).not.toThrow();
    });

    it('should accept boolean false', () => {
      expect(() => validateSmokeTests(false)).not.toThrow();
    });

    it('should accept empty object', () => {
      expect(() => validateSmokeTests({})).not.toThrow();
    });

    it('should accept object with only include', () => {
      expect(() => validateSmokeTests({ include: ['wpBoot'] })).not.toThrow();
    });

    it('should accept object with only exclude', () => {
      expect(() => validateSmokeTests({ exclude: ['wpBoot'] })).not.toThrow();
    });

    it('should accept empty include array', () => {
      expect(() => validateSmokeTests({ include: [] })).not.toThrow();
    });

    it('should accept empty exclude array', () => {
      expect(() => validateSmokeTests({ exclude: [] })).not.toThrow();
    });
  });

  describe('mutually exclusive include/exclude', () => {
    it('should throw when both include and exclude are specified', () => {
      const config: SmokeTests = {
        include: ['wpBoot'],
        exclude: ['wpAdminLoads'],
      };
      expect(() => validateSmokeTests(config)).toThrow(
        "smokeTests cannot have both 'include' and 'exclude'. Use one or the other."
      );
    });

    it('should throw even when both arrays are empty', () => {
      const config: SmokeTests = {
        include: [],
        exclude: [],
      };
      expect(() => validateSmokeTests(config)).toThrow(
        "smokeTests cannot have both 'include' and 'exclude'. Use one or the other."
      );
    });
  });

  describe('unknown test name warnings', () => {
    it('should return warnings for unknown test names in include', () => {
      const result = validateSmokeTests({ include: ['wpBoot', 'unknownTest'] });
      expect(result.warnings).toContain(
        "Unknown smoke test 'unknownTest' in include. Available tests: " + KNOWN_SMOKE_TESTS.join(', ')
      );
    });

    it('should return warnings for unknown test names in exclude', () => {
      const result = validateSmokeTests({ exclude: ['wpBoot', 'anotherUnknown'] });
      expect(result.warnings).toContain(
        "Unknown smoke test 'anotherUnknown' in exclude. Available tests: " + KNOWN_SMOKE_TESTS.join(', ')
      );
    });

    it('should not warn for valid test names', () => {
      const result = validateSmokeTests({ include: ['wpBoot', 'wpAdminLoads'] });
      expect(result.warnings).toHaveLength(0);
    });

    it('should return empty warnings for boolean config', () => {
      const result = validateSmokeTests(true);
      expect(result.warnings).toHaveLength(0);
    });
  });
});

describe('KNOWN_SMOKE_TESTS', () => {
  it('should export the list of known smoke test names', () => {
    expect(KNOWN_SMOKE_TESTS).toContain('wpBoot');
    expect(KNOWN_SMOKE_TESTS).toContain('wpAdminLoads');
    expect(KNOWN_SMOKE_TESTS).toContain('wpRestApiAvailable');
    expect(KNOWN_SMOKE_TESTS).toContain('pluginActivates');
    expect(KNOWN_SMOKE_TESTS).toContain('pluginDeactivates');
    expect(KNOWN_SMOKE_TESTS).toContain('pluginLoads');
    expect(KNOWN_SMOKE_TESTS).toContain('themeActivates');
    expect(KNOWN_SMOKE_TESTS).toContain('themeLoads');
  });
});

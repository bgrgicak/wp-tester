import { describe, it, expect } from 'vitest';
import { selectTestFiles, SMOKE_TEST_REGISTRY } from '../src/index.js';
import type { WPTesterConfig } from '@wp-tester/config';

// Helper to create a minimal config for testing
function createConfig(overrides: Partial<WPTesterConfig> = {}): WPTesterConfig {
  return {
    environments: [{ php: ['8.2'], wp: ['6.7'] }],
    tests: {},
    ...overrides,
  };
}

describe('selectTestFiles', () => {
  describe('legacy tests.wp/plugin/theme (deprecated)', () => {
    it('should select wp.spec.ts when tests.wp is true', () => {
      const config = createConfig({ tests: { wp: true } });
      const files = selectTestFiles(config);
      expect(files).toEqual(['src/smoke-tests/wp.spec.ts']);
    });

    it('should throw error when no tests are configured', () => {
      const config = createConfig({ tests: {} });
      expect(() => selectTestFiles(config)).toThrow('No test files selected');
    });

    it('should throw error when wp is false', () => {
      const config = createConfig({ tests: { wp: false } });
      expect(() => selectTestFiles(config)).toThrow('No test files selected');
    });

    it('should select plugin.spec.ts when tests.plugin is set (legacy)', () => {
      const config = createConfig({ tests: { plugin: 'my-plugin' } });
      const files = selectTestFiles(config);
      expect(files).toEqual(['src/smoke-tests/plugin.spec.ts']);
    });

    it('should select theme.spec.ts when tests.theme is set (legacy)', () => {
      const config = createConfig({ tests: { theme: 'my-theme' } });
      const files = selectTestFiles(config);
      expect(files).toEqual(['src/smoke-tests/theme.spec.ts']);
    });

    it('should select multiple test files when multiple are configured', () => {
      const config = createConfig({ tests: { wp: true, plugin: 'my-plugin' } });
      const files = selectTestFiles(config);
      expect(files).toContain('src/smoke-tests/wp.spec.ts');
      expect(files).toContain('src/smoke-tests/plugin.spec.ts');
    });
  });

  describe('smokeTests with projectType', () => {
    it('should run wp + plugin tests when projectType is plugin and smokeTests is true', () => {
      const config = createConfig({
        projectType: 'plugin',
        tests: { smokeTests: true },
      });
      const files = selectTestFiles(config);
      expect(files).toContain('src/smoke-tests/wp.spec.ts');
      expect(files).toContain('src/smoke-tests/plugin.spec.ts');
      expect(files).not.toContain('src/smoke-tests/theme.spec.ts');
    });

    it('should run wp + theme tests when projectType is theme and smokeTests is true', () => {
      const config = createConfig({
        projectType: 'theme',
        tests: { smokeTests: true },
      });
      const files = selectTestFiles(config);
      expect(files).toContain('src/smoke-tests/wp.spec.ts');
      expect(files).toContain('src/smoke-tests/theme.spec.ts');
      expect(files).not.toContain('src/smoke-tests/plugin.spec.ts');
    });

    it('should run only wp tests when projectType is wordpress and smokeTests is true', () => {
      const config = createConfig({
        projectType: 'wordpress',
        tests: { smokeTests: true },
      });
      const files = selectTestFiles(config);
      expect(files).toEqual(['src/smoke-tests/wp.spec.ts']);
    });

    it('should run only wp tests when projectType is other and smokeTests is true', () => {
      const config = createConfig({
        projectType: 'other',
        tests: { smokeTests: true },
      });
      const files = selectTestFiles(config);
      expect(files).toEqual(['src/smoke-tests/wp.spec.ts']);
    });
  });

  describe('smokeTests: boolean', () => {
    it('should run no tests when smokeTests is false', () => {
      const config = createConfig({ tests: { smokeTests: false } });
      expect(() => selectTestFiles(config)).toThrow('No test files selected');
    });

    it('should run only wp tests when smokeTests is true with no projectType', () => {
      const config = createConfig({ tests: { smokeTests: true } });
      const files = selectTestFiles(config);
      expect(files).toEqual(['src/smoke-tests/wp.spec.ts']);
    });
  });

  describe('smokeTests: { include }', () => {
    it('should run only included tests', () => {
      const config = createConfig({
        projectType: 'plugin',
        tests: { smokeTests: { include: ['wpBoot'] } },
      });
      const files = selectTestFiles(config);
      expect(files).toEqual(['src/smoke-tests/wp.spec.ts']);
    });

    it('should run multiple included tests', () => {
      const config = createConfig({
        projectType: 'plugin',
        tests: { smokeTests: { include: ['wpBoot', 'pluginActivates'] } },
      });
      const files = selectTestFiles(config);
      expect(files).toContain('src/smoke-tests/wp.spec.ts');
      expect(files).toContain('src/smoke-tests/plugin.spec.ts');
    });

    it('should silently skip inapplicable tests in include', () => {
      const config = createConfig({
        projectType: 'wordpress', // Not a plugin project
        tests: { smokeTests: { include: ['wpBoot', 'pluginActivates'] } },
      });
      const files = selectTestFiles(config);
      // pluginActivates should be skipped since projectType is not plugin
      expect(files).toEqual(['src/smoke-tests/wp.spec.ts']);
    });
  });

  describe('smokeTests: { exclude }', () => {
    it('should run all except excluded tests', () => {
      const config = createConfig({
        projectType: 'plugin',
        tests: { smokeTests: { exclude: ['pluginActivates', 'pluginDeactivates', 'pluginLoads'] } },
      });
      const files = selectTestFiles(config);
      expect(files).toContain('src/smoke-tests/wp.spec.ts');
      expect(files).not.toContain('src/smoke-tests/plugin.spec.ts');
    });

    it('should run all tests when exclude is empty', () => {
      const config = createConfig({
        projectType: 'plugin',
        tests: { smokeTests: { exclude: [] } },
      });
      const files = selectTestFiles(config);
      expect(files).toContain('src/smoke-tests/wp.spec.ts');
      expect(files).toContain('src/smoke-tests/plugin.spec.ts');
    });
  });

  describe('smokeTests: {}', () => {
    it('should run all applicable tests when smokeTests is empty object', () => {
      const config = createConfig({
        projectType: 'plugin',
        tests: { smokeTests: {} },
      });
      const files = selectTestFiles(config);
      expect(files).toContain('src/smoke-tests/wp.spec.ts');
      expect(files).toContain('src/smoke-tests/plugin.spec.ts');
    });
  });

  describe('smokeTests overrides legacy properties', () => {
    it('should use smokeTests when both smokeTests and legacy wp are set', () => {
      const config = createConfig({
        tests: {
          smokeTests: false,
          wp: true, // This should be ignored when smokeTests is explicitly set
        },
      });
      expect(() => selectTestFiles(config)).toThrow('No test files selected');
    });

    it('should use projectType over legacy tests.plugin', () => {
      const config = createConfig({
        projectType: 'theme', // This takes precedence
        tests: {
          smokeTests: true,
          plugin: 'my-plugin', // Legacy, should be ignored for applicability
        },
      });
      const files = selectTestFiles(config);
      expect(files).toContain('src/smoke-tests/wp.spec.ts');
      expect(files).toContain('src/smoke-tests/theme.spec.ts');
      // Plugin tests should also run because tests.plugin is set (legacy fallback)
      expect(files).toContain('src/smoke-tests/plugin.spec.ts');
    });
  });
});

describe('SMOKE_TEST_REGISTRY', () => {
  it('should export a registry of known smoke tests', () => {
    expect(SMOKE_TEST_REGISTRY).toBeDefined();
    expect(typeof SMOKE_TEST_REGISTRY).toBe('object');
  });

  it('should contain expected WordPress tests', () => {
    expect(SMOKE_TEST_REGISTRY.wpBoot).toBeDefined();
    expect(SMOKE_TEST_REGISTRY.wpBoot.category).toBe('wp');
    expect(SMOKE_TEST_REGISTRY.wpAdminLoads).toBeDefined();
    expect(SMOKE_TEST_REGISTRY.wpRestApiAvailable).toBeDefined();
  });

  it('should contain expected plugin tests', () => {
    expect(SMOKE_TEST_REGISTRY.pluginActivates).toBeDefined();
    expect(SMOKE_TEST_REGISTRY.pluginActivates.category).toBe('plugin');
    expect(SMOKE_TEST_REGISTRY.pluginDeactivates).toBeDefined();
    expect(SMOKE_TEST_REGISTRY.pluginLoads).toBeDefined();
  });

  it('should contain expected theme tests', () => {
    expect(SMOKE_TEST_REGISTRY.themeActivates).toBeDefined();
    expect(SMOKE_TEST_REGISTRY.themeActivates.category).toBe('theme');
    expect(SMOKE_TEST_REGISTRY.themeLoads).toBeDefined();
  });
});

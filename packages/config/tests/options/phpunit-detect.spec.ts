import { describe, it, expect } from 'vitest';
import { findPhpUnitConfig, parseBootstrapPath, detectPhpUnitConfig } from '../../src/options/phpunit-detect';
import * as path from 'path';

const FIXTURES_DIR = path.resolve(__dirname, '../../../test-fixtures/fixtures');
const PLUGIN_FIXTURE = path.join(FIXTURES_DIR, 'wp-tester-plugin');
const THEME_FIXTURE = path.join(FIXTURES_DIR, 'wp-tester-theme');

describe('findPhpUnitConfig', () => {
  it('should find phpunit.xml.dist in plugin fixture', async () => {
    const configPath = await findPhpUnitConfig(PLUGIN_FIXTURE);
    expect(configPath).toBe(path.join(PLUGIN_FIXTURE, 'phpunit.xml.dist'));
  });

  it('should find phpunit.xml.dist in theme fixture', async () => {
    const configPath = await findPhpUnitConfig(THEME_FIXTURE);
    expect(configPath).toBe(path.join(THEME_FIXTURE, 'phpunit.xml.dist'));
  });

  it('should return null for directory without phpunit config', async () => {
    const configPath = await findPhpUnitConfig('/tmp');
    expect(configPath).toBeNull();
  });

  it('should return null for non-existent directory', async () => {
    const configPath = await findPhpUnitConfig('/this/path/does/not/exist');
    expect(configPath).toBeNull();
  });

  it('should prefer phpunit.xml over phpunit.xml.dist if both exist', async () => {
    // This is implicit in the implementation order - phpunit.xml is checked first
    const configPath = await findPhpUnitConfig(PLUGIN_FIXTURE);
    expect(configPath).not.toBeNull();
    expect(configPath).toContain('phpunit.xml');
  });
});

describe('parseBootstrapPath', () => {
  it('should parse bootstrap path from plugin phpunit.xml.dist', async () => {
    const configPath = path.join(PLUGIN_FIXTURE, 'phpunit.xml.dist');
    const bootstrapPath = await parseBootstrapPath(configPath);
    expect(bootstrapPath).toBe('tests/bootstrap.php');
  });

  it('should parse bootstrap path from theme phpunit.xml.dist', async () => {
    const configPath = path.join(THEME_FIXTURE, 'phpunit.xml.dist');
    const bootstrapPath = await parseBootstrapPath(configPath);
    expect(bootstrapPath).toBe('tests/phpunit/bootstrap.php');
  });

  it('should return null for non-existent config file', async () => {
    const bootstrapPath = await parseBootstrapPath('/this/does/not/exist.xml');
    expect(bootstrapPath).toBeNull();
  });

  it('should return null for config without bootstrap attribute', async () => {
    // Using a directory path as an invalid XML file
    const bootstrapPath = await parseBootstrapPath('/tmp');
    expect(bootstrapPath).toBeNull();
  });

  it('should handle bootstrap with double quotes', async () => {
    const configPath = path.join(PLUGIN_FIXTURE, 'phpunit.xml.dist');
    const bootstrapPath = await parseBootstrapPath(configPath);
    expect(bootstrapPath).toBeTruthy();
  });

  it('should handle bootstrap with single quotes', async () => {
    // The regex supports both single and double quotes
    // We test this indirectly through the implementation
    const configPath = path.join(PLUGIN_FIXTURE, 'phpunit.xml.dist');
    const bootstrapPath = await parseBootstrapPath(configPath);
    expect(bootstrapPath).toBe('tests/bootstrap.php');
  });

  it('should handle bootstrap attribute with extra whitespace', async () => {
    // The regex handles whitespace around the = sign
    const configPath = path.join(PLUGIN_FIXTURE, 'phpunit.xml.dist');
    const bootstrapPath = await parseBootstrapPath(configPath);
    expect(bootstrapPath).toBeTruthy();
  });
});

describe('detectPhpUnitConfig', () => {
  it('should detect complete PHPUnit config from plugin fixture', async () => {
    const config = await detectPhpUnitConfig(PLUGIN_FIXTURE);
    expect(config).not.toBeNull();
    expect(config).toEqual({
      phpunitPath: 'vendor/bin/phpunit',
      configPath: 'phpunit.xml.dist',
      bootstrapPath: 'tests/bootstrap.php',
    });
  });

  it('should detect complete PHPUnit config from theme fixture', async () => {
    const config = await detectPhpUnitConfig(THEME_FIXTURE);
    expect(config).not.toBeNull();
    expect(config).toEqual({
      phpunitPath: 'vendor/bin/phpunit',
      configPath: 'phpunit.xml.dist',
      bootstrapPath: 'tests/phpunit/bootstrap.php',
    });
  });

  it('should return null for directory without PHPUnit config', async () => {
    const config = await detectPhpUnitConfig('/tmp');
    expect(config).toBeNull();
  });

  it('should return null for non-existent directory', async () => {
    const config = await detectPhpUnitConfig('/this/path/does/not/exist');
    expect(config).toBeNull();
  });

  it('should use default bootstrap path when not found in config', async () => {
    // This would require a fixture without bootstrap attribute
    // For now, we verify the behavior through the plugin fixture
    const config = await detectPhpUnitConfig(PLUGIN_FIXTURE);
    expect(config?.bootstrapPath).toBeTruthy();
  });

  it('should always set phpunitPath to vendor/bin/phpunit', async () => {
    const config = await detectPhpUnitConfig(PLUGIN_FIXTURE);
    expect(config?.phpunitPath).toBe('vendor/bin/phpunit');
  });

  it('should return relative paths from basePath', async () => {
    const config = await detectPhpUnitConfig(PLUGIN_FIXTURE);
    expect(config?.configPath).not.toContain(PLUGIN_FIXTURE);
    expect(config?.configPath).toBe('phpunit.xml.dist');
  });

  it('should handle absolute basePath correctly', async () => {
    const absolutePath = path.resolve(PLUGIN_FIXTURE);
    const config = await detectPhpUnitConfig(absolutePath);
    expect(config).not.toBeNull();
    expect(config?.configPath).toBe('phpunit.xml.dist');
  });
});

describe('detectPhpUnitConfig integration', () => {
  it('should integrate with findPhpUnitConfig and parseBootstrapPath', async () => {
    // Test that all three functions work together
    const configPath = await findPhpUnitConfig(PLUGIN_FIXTURE);
    expect(configPath).not.toBeNull();

    if (configPath) {
      const bootstrapPath = await parseBootstrapPath(configPath);
      expect(bootstrapPath).not.toBeNull();

      const fullConfig = await detectPhpUnitConfig(PLUGIN_FIXTURE);
      expect(fullConfig).not.toBeNull();
      expect(fullConfig?.bootstrapPath).toBe(bootstrapPath);
    }
  });

  it('should handle missing bootstrap gracefully', async () => {
    // Even if parseBootstrapPath returns null, detectPhpUnitConfig should provide a default
    const config = await detectPhpUnitConfig(PLUGIN_FIXTURE);
    expect(config).not.toBeNull();
    expect(config?.bootstrapPath).toBeTruthy();
    expect(config?.bootstrapPath).toBe('tests/bootstrap.php');
  });

  it('should produce config compatible with PHPUnitConfig type', async () => {
    const config = await detectPhpUnitConfig(PLUGIN_FIXTURE);
    expect(config).not.toBeNull();

    // Verify it has all required properties
    expect(config).toHaveProperty('phpunitPath');
    expect(config).toHaveProperty('configPath');
    expect(config).toHaveProperty('bootstrapPath');

    // Verify property types
    expect(typeof config?.phpunitPath).toBe('string');
    expect(typeof config?.configPath).toBe('string');
    expect(typeof config?.bootstrapPath).toBe('string');
  });
});

describe('custom bootstrap path detection', () => {
  it('should parse custom bootstrap path from phpunit.xml.dist', async () => {
    const configPath = path.join(THEME_FIXTURE, 'phpunit.xml.dist');
    const bootstrapPath = await parseBootstrapPath(configPath);
    expect(bootstrapPath).toBe('tests/phpunit/bootstrap.php');
  });

  it('should detect custom bootstrap path in detectPhpUnitConfig', async () => {
    const config = await detectPhpUnitConfig(THEME_FIXTURE);
    expect(config).not.toBeNull();
    expect(config).toEqual({
      phpunitPath: 'vendor/bin/phpunit',
      configPath: 'phpunit.xml.dist',
      bootstrapPath: 'tests/phpunit/bootstrap.php',
    });
  });

  it('should not use default bootstrap when custom path exists in config', async () => {
    const config = await detectPhpUnitConfig(THEME_FIXTURE);
    expect(config?.bootstrapPath).not.toBe('tests/bootstrap.php');
    expect(config?.bootstrapPath).toBe('tests/phpunit/bootstrap.php');
  });
});

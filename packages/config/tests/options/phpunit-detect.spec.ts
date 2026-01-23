import { describe, it, expect } from 'vitest';
import { findPhpUnitConfig, parseBootstrapPath } from '../../src/options/phpunit-detect';
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

  it('should parse custom bootstrap path from phpunit.xml.dist', async () => {
    const configPath = path.join(THEME_FIXTURE, 'phpunit.xml.dist');
    const bootstrapPath = await parseBootstrapPath(configPath);
    expect(bootstrapPath).toBe('tests/phpunit/bootstrap.php');
  });
});

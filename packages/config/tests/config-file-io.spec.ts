import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readConfigFile, resolveConfig, normalizeConfigPath, defineConfig, findConfigFile, isJsOrTsConfig, CONFIG_EXTENSIONS, CONFIG_BASE_NAME } from '../src';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import * as os from 'os';
import type { WPTesterConfig } from '../src/types';

describe('Config File I/O', () => {
  let testDir: string;
  let configDir: string;
  let configFile: string;
  const testConfig: WPTesterConfig = {
    environments: [
      {
        name: 'Test Environment',
        blueprint: {
          preferredVersions: {
            php: 'latest',
            wp: 'latest',
          },
        },
      },
    ],
    tests: {},
  };

  beforeEach(async () => {
    // Create a temporary directory for testing
    testDir = await os.tmpdir();
    configDir = join(testDir, `wp-tester-test-${Date.now()}`);
    await mkdir(configDir, { recursive: true });
    configFile = join(configDir, 'wp-tester.json');
    await writeFile(configFile, JSON.stringify(testConfig, null, 2));
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(configDir, { recursive: true, force: true });
  });

  describe('readConfigFile', () => {
    it('should read config from file path', async () => {
      const config = await readConfigFile(configFile);
      expect(config).toEqual(testConfig);
    });

    it('should read config from directory path', async () => {
      const config = await readConfigFile(configDir);
      expect(config).toEqual(testConfig);
    });

    it('should throw error if directory does not contain wp-tester.json', async () => {
      const emptyDir = join(testDir, `wp-tester-empty-${Date.now()}`);
      await mkdir(emptyDir, { recursive: true });

      await expect(readConfigFile(emptyDir)).rejects.toThrow();

      await rm(emptyDir, { recursive: true, force: true });
    });

    it('should throw error if file does not exist', async () => {
      const nonExistentFile = join(configDir, 'non-existent.json');
      await expect(readConfigFile(nonExistentFile)).rejects.toThrow();
    });

    it('should read config from JS file', async () => {
      const jsConfigFile = join(configDir, 'wp-tester.js');
      const jsConfigContent = `export default ${JSON.stringify(testConfig)};`;
      await writeFile(jsConfigFile, jsConfigContent);

      const config = await readConfigFile(jsConfigFile);
      expect(config).toEqual(testConfig);

      await rm(jsConfigFile);
    });

    it('should throw error if JS file has no default export', async () => {
      const jsConfigFile = join(configDir, 'wp-tester-invalid.js');
      const jsConfigContent = `export const config = {};`;
      await writeFile(jsConfigFile, jsConfigContent);

      await expect(readConfigFile(jsConfigFile)).rejects.toThrow('Invalid config file');

      await rm(jsConfigFile);
    });
  });

  describe('resolveConfig', () => {
    it('should resolve config from file path', async () => {
      const resolved = await resolveConfig(configFile);
      expect(resolved.environments).toHaveLength(1);
      expect(resolved.environments[0].name).toBe('Test Environment');
      expect(resolved.projectPath.hostPath).toBe(configDir);
    });

    it('should resolve config from directory path', async () => {
      const resolved = await resolveConfig(configDir);
      expect(resolved.environments).toHaveLength(1);
      expect(resolved.environments[0].name).toBe('Test Environment');
      expect(resolved.projectPath.hostPath).toBe(configDir);
    });

    it('should resolve config from object', async () => {
      const resolved = await resolveConfig(testConfig);
      expect(resolved.environments).toHaveLength(1);
      expect(resolved.environments[0].name).toBe('Test Environment');
    });

    it('should throw error if directory does not contain wp-tester.json', async () => {
      const emptyDir = join(testDir, `wp-tester-empty-${Date.now()}`);
      await mkdir(emptyDir, { recursive: true });

      await expect(resolveConfig(emptyDir)).rejects.toThrow();

      await rm(emptyDir, { recursive: true, force: true });
    });
  });

  describe('normalizeConfigPath', () => {
    it('should return file path as-is when given a file path', () => {
      const normalized = normalizeConfigPath(configFile);
      expect(normalized).toBe(configFile);
    });

    it('should append wp-tester.json when given a directory path', () => {
      const normalized = normalizeConfigPath(configDir);
      expect(normalized).toBe(configFile);
    });

    it('should handle relative file paths', () => {
      const relativePath = 'wp-tester.json';
      const normalized = normalizeConfigPath(relativePath);
      expect(normalized).toBe(join(process.cwd(), relativePath));
    });

    it('should return path as-is if stat fails (non-existent path)', () => {
      const nonExistentPath = '/non/existent/path/wp-tester.json';
      const normalized = normalizeConfigPath(nonExistentPath);
      expect(normalized).toBe(nonExistentPath);
    });
  });

  describe('defineConfig', () => {
    it('should return the config object as-is', () => {
      const result = defineConfig(testConfig);
      expect(result).toEqual(testConfig);
      expect(result).toBe(testConfig); // Same reference
    });
  });

  describe('findConfigFile', () => {
    it('should return null if no config file found', async () => {
      const emptyDir = join(testDir, `wp-tester-empty-${Date.now()}`);
      await mkdir(emptyDir, { recursive: true });

      const result = findConfigFile(emptyDir);
      expect(result).toBeNull();

      await rm(emptyDir, { recursive: true, force: true });
    });

    it('should find wp-tester.json', () => {
      const result = findConfigFile(configDir);
      expect(result).toBe(configFile);
    });

    it('should prefer .ts over .js over .json', async () => {
      // Create all three config files
      const tsFile = join(configDir, 'wp-tester.ts');
      const jsFile = join(configDir, 'wp-tester.js');

      await writeFile(tsFile, 'export default {}');
      await writeFile(jsFile, 'export default {}');

      const result = findConfigFile(configDir);
      expect(result).toBe(tsFile); // .ts takes priority

      // Remove .ts, .js should be found
      await rm(tsFile);
      const result2 = findConfigFile(configDir);
      expect(result2).toBe(jsFile);

      await rm(jsFile);
    });
  });

  describe('isJsOrTsConfig', () => {
    it('should return true for .js files', () => {
      expect(isJsOrTsConfig('/path/to/wp-tester.js')).toBe(true);
      expect(isJsOrTsConfig('wp-tester.js')).toBe(true);
    });

    it('should return true for .ts files', () => {
      expect(isJsOrTsConfig('/path/to/wp-tester.ts')).toBe(true);
      expect(isJsOrTsConfig('wp-tester.ts')).toBe(true);
    });

    it('should return false for .json files', () => {
      expect(isJsOrTsConfig('/path/to/wp-tester.json')).toBe(false);
      expect(isJsOrTsConfig('wp-tester.json')).toBe(false);
    });

    it('should handle mixed case extensions', () => {
      expect(isJsOrTsConfig('/path/to/wp-tester.JS')).toBe(true);
      expect(isJsOrTsConfig('/path/to/wp-tester.TS')).toBe(true);
    });
  });

  describe('CONFIG_EXTENSIONS and CONFIG_BASE_NAME', () => {
    it('should export expected constants', () => {
      expect(CONFIG_EXTENSIONS).toEqual(['.ts', '.js', '.json']);
      expect(CONFIG_BASE_NAME).toBe('wp-tester');
    });
  });
});

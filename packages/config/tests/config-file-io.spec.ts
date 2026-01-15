import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readConfigFile, resolveConfig, normalizeConfigPath } from '../src/config';
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
    reporters: { default: true },
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
  });

  describe('resolveConfig', () => {
    it('should resolve config from file path', async () => {
      const resolved = await resolveConfig(configFile);
      expect(resolved.environments).toHaveLength(1);
      expect(resolved.environments[0].name).toBe('Test Environment');
      expect(resolved.projectHostPath).toBe(configDir);
    });

    it('should resolve config from directory path', async () => {
      const resolved = await resolveConfig(configDir);
      expect(resolved.environments).toHaveLength(1);
      expect(resolved.environments[0].name).toBe('Test Environment');
      expect(resolved.projectHostPath).toBe(configDir);
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
});

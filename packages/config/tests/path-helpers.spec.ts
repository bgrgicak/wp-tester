import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getConfigPath, getConfigDir, getProjectDir } from '../src/config';
import type { WPTesterConfig } from '../src/types';
import * as path from 'path';

describe('Path Helper Functions', () => {
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(originalCwd);
  });

  describe('getConfigPath', () => {
    it('should return absolute path as-is', () => {
      const absolutePath = '/absolute/path/to/wp-tester.json';
      expect(getConfigPath(absolutePath)).toBe(absolutePath);
    });

    it('should resolve relative path from cwd', () => {
      const relativePath = 'relative/wp-tester.json';
      const expected = path.resolve(process.cwd(), relativePath);
      expect(getConfigPath(relativePath)).toBe(expected);
    });

    it('should resolve . relative to cwd', () => {
      const relativePath = './wp-tester.json';
      const expected = path.resolve(process.cwd(), relativePath);
      expect(getConfigPath(relativePath)).toBe(expected);
    });

    it('should resolve .. relative to cwd', () => {
      const relativePath = '../wp-tester.json';
      const expected = path.resolve(process.cwd(), relativePath);
      expect(getConfigPath(relativePath)).toBe(expected);
    });

    it('should handle path with multiple segments', () => {
      const relativePath = 'configs/test/wp-tester.json';
      const expected = path.resolve(process.cwd(), relativePath);
      expect(getConfigPath(relativePath)).toBe(expected);
    });
  });

  describe('getConfigDir', () => {
    it('should return directory of absolute config path', () => {
      const configPath = '/absolute/path/to/wp-tester.json';
      expect(getConfigDir(configPath)).toBe('/absolute/path/to');
    });

    it('should return directory of relative config path resolved from cwd', () => {
      const relativePath = 'configs/wp-tester.json';
      const expected = path.resolve(process.cwd(), 'configs');
      expect(getConfigDir(relativePath)).toBe(expected);
    });

    it('should handle config in current directory', () => {
      const configPath = 'wp-tester.json';
      const expected = process.cwd();
      expect(getConfigDir(configPath)).toBe(expected);
    });

    it('should handle config with ./ prefix', () => {
      const configPath = './wp-tester.json';
      const expected = process.cwd();
      expect(getConfigDir(configPath)).toBe(expected);
    });

    it('should handle config in parent directory', () => {
      const configPath = '../wp-tester.json';
      const expected = path.resolve(process.cwd(), '..');
      expect(getConfigDir(configPath)).toBe(expected);
    });
  });

  describe('getProjectDir', () => {
    const baseConfig: WPTesterConfig = {
      environments: [],
      tests: {},
      reporters: ['default'],
    };

    describe('without projectRoot config', () => {
      it('should return cwd when no configPath provided', () => {
        expect(getProjectDir(baseConfig)).toBe(process.cwd());
      });

      it('should return config directory when configPath is absolute', () => {
        const configPath = '/projects/my-plugin/wp-tester.json';
        expect(getProjectDir(baseConfig, configPath)).toBe('/projects/my-plugin');
      });

      it('should return config directory when configPath is relative', () => {
        const configPath = 'configs/wp-tester.json';
        const expected = path.resolve(process.cwd(), 'configs');
        expect(getProjectDir(baseConfig, configPath)).toBe(expected);
      });
    });

    describe('with absolute projectRoot', () => {
      it('should return absolute projectRoot regardless of configPath', () => {
        const config: WPTesterConfig = {
          ...baseConfig,
          projectRoot: '/absolute/project/root',
        };
        expect(getProjectDir(config)).toBe('/absolute/project/root');
        expect(getProjectDir(config, '/some/config/path/wp-tester.json')).toBe('/absolute/project/root');
      });
    });

    describe('with relative projectRoot', () => {
      it('should resolve projectRoot relative to cwd when no configPath', () => {
        const config: WPTesterConfig = {
          ...baseConfig,
          projectRoot: 'src',
        };
        const expected = path.resolve(process.cwd(), 'src');
        expect(getProjectDir(config)).toBe(expected);
      });

      it('should resolve projectRoot relative to config directory', () => {
        const config: WPTesterConfig = {
          ...baseConfig,
          projectRoot: '../src',
        };
        const configPath = '/projects/my-plugin/config/wp-tester.json';
        expect(getProjectDir(config, configPath)).toBe('/projects/my-plugin/src');
      });

      it('should resolve . as config directory', () => {
        const config: WPTesterConfig = {
          ...baseConfig,
          projectRoot: '.',
        };
        const configPath = '/projects/my-plugin/wp-tester.json';
        expect(getProjectDir(config, configPath)).toBe('/projects/my-plugin');
      });

      it('should resolve nested relative paths', () => {
        const config: WPTesterConfig = {
          ...baseConfig,
          projectRoot: 'packages/plugin',
        };
        const configPath = '/projects/monorepo/wp-tester.json';
        expect(getProjectDir(config, configPath)).toBe('/projects/monorepo/packages/plugin');
      });
    });

    describe('integration scenarios', () => {
      it('should handle config in subdirectory with projectRoot pointing to parent', () => {
        const config: WPTesterConfig = {
          ...baseConfig,
          projectRoot: '..',
        };
        const configPath = '/projects/my-plugin/configs/wp-tester.json';
        expect(getProjectDir(config, configPath)).toBe('/projects/my-plugin');
      });

      it('should handle config at root with projectRoot pointing to subdirectory', () => {
        const config: WPTesterConfig = {
          ...baseConfig,
          projectRoot: 'wordpress',
        };
        const configPath = 'wp-tester.json';
        const expected = path.resolve(process.cwd(), 'wordpress');
        expect(getProjectDir(config, configPath)).toBe(expected);
      });
    });
  });

  describe('Helper function relationships', () => {
    it('getConfigDir should use getConfigPath internally', () => {
      const relativePath = 'configs/wp-tester.json';
      const absolutePath = getConfigPath(relativePath);
      const configDir = getConfigDir(relativePath);
      expect(configDir).toBe(path.dirname(absolutePath));
    });

    it('getProjectDir should use getConfigDir when configPath provided', () => {
      const config: WPTesterConfig = {
        environments: [],
        tests: {},
        reporters: ['default'],
      };
      const configPath = 'configs/wp-tester.json';
      const configDir = getConfigDir(configPath);
      const projectDir = getProjectDir(config, configPath);
      expect(projectDir).toBe(configDir);
    });

    it('all helpers should compose correctly for complex paths', () => {
      const config: WPTesterConfig = {
        environments: [],
        tests: {},
        reporters: ['default'],
        projectRoot: '../src',
      };
      const configPath = 'project/config/wp-tester.json';

      // getConfigPath resolves the config file path
      const absoluteConfigPath = getConfigPath(configPath);
      expect(absoluteConfigPath).toBe(path.resolve(process.cwd(), configPath));

      // getConfigDir gets the directory of the config file
      const configDir = getConfigDir(configPath);
      expect(configDir).toBe(path.dirname(absoluteConfigPath));

      // getProjectDir resolves projectRoot relative to config directory
      const projectDir = getProjectDir(config, configPath);
      expect(projectDir).toBe(path.resolve(configDir, '../src'));
    });
  });
});

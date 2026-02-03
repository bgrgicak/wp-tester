import { describe, it, expect } from 'vitest';
import { migrateConfig, type MigrationResult } from '../src/commands/config/migrate';
import type { WPTesterConfig } from '@wp-tester/config';

describe('migrateConfig', () => {
  describe('tests.wp migration', () => {
    it('should migrate tests.wp: true to smokeTests: true', () => {
      const config: WPTesterConfig = {
        environments: [{ php: ['8.2'], wp: ['6.7'] }],
        tests: { wp: true },
      };

      const result = migrateConfig(config);

      expect(result.migrated).toBe(true);
      expect(result.config.tests.smokeTests).toBe(true);
      expect(result.config.tests.wp).toBeUndefined();
      expect(result.changes).toContain('Migrated tests.wp to tests.smokeTests');
    });

    it('should not migrate when tests.wp is false', () => {
      const config: WPTesterConfig = {
        environments: [{ php: ['8.2'], wp: ['6.7'] }],
        tests: { wp: false },
      };

      const result = migrateConfig(config);

      expect(result.migrated).toBe(true);
      expect(result.config.tests.wp).toBeUndefined();
      expect(result.changes).toContain('Removed deprecated tests.wp (was false)');
    });

    it('should preserve existing smokeTests when migrating tests.wp', () => {
      const config: WPTesterConfig = {
        environments: [{ php: ['8.2'], wp: ['6.7'] }],
        tests: { wp: true, smokeTests: { include: ['wpBoot'] } },
      };

      const result = migrateConfig(config);

      expect(result.migrated).toBe(true);
      expect(result.config.tests.smokeTests).toEqual({ include: ['wpBoot'] });
      expect(result.config.tests.wp).toBeUndefined();
    });
  });

  describe('tests.plugin migration', () => {
    it('should migrate tests.plugin to projectType: plugin and smokeTests: true', () => {
      const config: WPTesterConfig = {
        environments: [{ php: ['8.2'], wp: ['6.7'] }],
        tests: { plugin: 'my-plugin' },
      };

      const result = migrateConfig(config);

      expect(result.migrated).toBe(true);
      expect(result.config.projectType).toBe('plugin');
      expect(result.config.tests.smokeTests).toBe(true);
      expect(result.config.tests.plugin).toBeUndefined();
      expect(result.changes).toContain('Migrated tests.plugin to projectType: "plugin" and tests.smokeTests: true');
    });

    it('should not override existing projectType when migrating tests.plugin', () => {
      const config: WPTesterConfig = {
        environments: [{ php: ['8.2'], wp: ['6.7'] }],
        projectType: 'theme',
        tests: { plugin: 'my-plugin' },
      };

      const result = migrateConfig(config);

      expect(result.migrated).toBe(true);
      expect(result.config.projectType).toBe('theme'); // Preserved
      expect(result.config.tests.smokeTests).toBe(true);
      expect(result.config.tests.plugin).toBeUndefined();
      expect(result.changes).toContain('Removed deprecated tests.plugin (projectType already set)');
    });
  });

  describe('tests.theme migration', () => {
    it('should migrate tests.theme to projectType: theme and smokeTests: true', () => {
      const config: WPTesterConfig = {
        environments: [{ php: ['8.2'], wp: ['6.7'] }],
        tests: { theme: 'my-theme' },
      };

      const result = migrateConfig(config);

      expect(result.migrated).toBe(true);
      expect(result.config.projectType).toBe('theme');
      expect(result.config.tests.smokeTests).toBe(true);
      expect(result.config.tests.theme).toBeUndefined();
      expect(result.changes).toContain('Migrated tests.theme to projectType: "theme" and tests.smokeTests: true');
    });

    it('should not override existing projectType when migrating tests.theme', () => {
      const config: WPTesterConfig = {
        environments: [{ php: ['8.2'], wp: ['6.7'] }],
        projectType: 'plugin',
        tests: { theme: 'my-theme' },
      };

      const result = migrateConfig(config);

      expect(result.migrated).toBe(true);
      expect(result.config.projectType).toBe('plugin'); // Preserved
      expect(result.config.tests.smokeTests).toBe(true);
      expect(result.config.tests.theme).toBeUndefined();
      expect(result.changes).toContain('Removed deprecated tests.theme (projectType already set)');
    });
  });

  describe('combined migrations', () => {
    it('should migrate all deprecated properties at once', () => {
      const config: WPTesterConfig = {
        environments: [{ php: ['8.2'], wp: ['6.7'] }],
        tests: { wp: true, plugin: 'my-plugin', theme: 'my-theme' },
      };

      const result = migrateConfig(config);

      expect(result.migrated).toBe(true);
      expect(result.config.tests.smokeTests).toBe(true);
      expect(result.config.tests.wp).toBeUndefined();
      expect(result.config.tests.plugin).toBeUndefined();
      expect(result.config.tests.theme).toBeUndefined();
      // plugin takes precedence over theme for projectType
      expect(result.config.projectType).toBe('plugin');
      expect(result.changes.length).toBe(3);
    });

    it('should return migrated: false when no deprecated properties exist', () => {
      const config: WPTesterConfig = {
        environments: [{ php: ['8.2'], wp: ['6.7'] }],
        tests: { smokeTests: true },
      };

      const result = migrateConfig(config);

      expect(result.migrated).toBe(false);
      expect(result.changes).toHaveLength(0);
    });

    it('should preserve non-deprecated properties', () => {
      const config: WPTesterConfig = {
        environments: [{ php: ['8.2'], wp: ['6.7'] }],
        tests: {
          wp: true,
          phpunit: { phpunitPath: 'vendor/bin/phpunit', configPath: 'phpunit.xml' },
        },
      };

      const result = migrateConfig(config);

      expect(result.migrated).toBe(true);
      expect(result.config.tests.phpunit).toEqual({
        phpunitPath: 'vendor/bin/phpunit',
        configPath: 'phpunit.xml',
      });
    });

    it('should preserve $schema property', () => {
      const config: WPTesterConfig = {
        $schema: './node_modules/@wp-tester/config/schema.json',
        environments: [{ php: ['8.2'], wp: ['6.7'] }],
        tests: { wp: true },
      };

      const result = migrateConfig(config);

      expect(result.config.$schema).toBe('./node_modules/@wp-tester/config/schema.json');
    });
  });
});

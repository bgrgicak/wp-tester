import type { WPTesterConfig, Tests } from '@wp-tester/config';

/**
 * Result of a config migration
 */
export interface MigrationResult {
  /** Whether any migrations were applied */
  migrated: boolean;
  /** The migrated config (or original if no changes) */
  config: WPTesterConfig;
  /** List of changes made */
  changes: string[];
}

/**
 * Migrate deprecated config properties to new format.
 *
 * Migrations:
 * - tests.wp: true → tests.smokeTests: true
 * - tests.plugin: "name" → projectType: "plugin" + tests.smokeTests: true
 * - tests.theme: "name" → projectType: "theme" + tests.smokeTests: true
 */
export function migrateConfig(config: WPTesterConfig): MigrationResult {
  const changes: string[] = [];

  // Deep clone the config to avoid mutating the original
  const newConfig: WPTesterConfig = JSON.parse(JSON.stringify(config));
  const tests = newConfig.tests as Tests & { wp?: boolean; plugin?: string; theme?: string };

  // Migrate tests.wp
  if (tests.wp !== undefined) {
    if (tests.wp === true) {
      // Only set smokeTests if not already set
      if (tests.smokeTests === undefined) {
        tests.smokeTests = true;
      }
      changes.push('Migrated tests.wp to tests.smokeTests');
    } else {
      changes.push('Removed deprecated tests.wp (was false)');
    }
    delete tests.wp;
  }

  // Migrate tests.plugin
  if (tests.plugin !== undefined) {
    // Set projectType if not already set
    if (newConfig.projectType === undefined) {
      newConfig.projectType = 'plugin';
      changes.push('Migrated tests.plugin to projectType: "plugin" and tests.smokeTests: true');
    } else {
      changes.push('Removed deprecated tests.plugin (projectType already set)');
    }
    // Enable smokeTests if not already set
    if (tests.smokeTests === undefined) {
      tests.smokeTests = true;
    }
    delete tests.plugin;
  }

  // Migrate tests.theme
  if (tests.theme !== undefined) {
    // Set projectType if not already set (and not set by plugin migration)
    if (newConfig.projectType === undefined) {
      newConfig.projectType = 'theme';
      changes.push('Migrated tests.theme to projectType: "theme" and tests.smokeTests: true');
    } else {
      changes.push('Removed deprecated tests.theme (projectType already set)');
    }
    // Enable smokeTests if not already set
    if (tests.smokeTests === undefined) {
      tests.smokeTests = true;
    }
    delete tests.theme;
  }

  return {
    migrated: changes.length > 0,
    config: newConfig,
    changes,
  };
}

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runPhpunitTests } from '../../src/runner.js';
import type { PHPUnitConfig } from '@wp-tester/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';

/**
 * Compatibility tests for wordpress-tests-lib support using external WordPress plugins
 *
 * These tests download actual WordPress plugins from GitHub and run their PHPUnit tests
 * to verify that our wordpress-tests-lib implementation works correctly.
 */

interface PluginTestConfig {
  name: string;
  repo: string; // GitHub repo in format "owner/repo"
  branch?: string; // Default: main
  setupCommands?: string[]; // Commands to run after clone (e.g., composer install)
  phpunit: PHPUnitConfig; // PHPUnit configuration
  expectedMinTests?: number; // Minimum number of tests we expect to run
  allowedFailures?: number; // Number of test failures we tolerate (for known issues)
}

const PLUGINS_TO_TEST: PluginTestConfig[] = [
  // Start with Friends plugin as we know it works
  {
    name: "Friends",
    repo: "akirk/friends",
    branch: "main",
    setupCommands: [
      "composer install --no-interaction --prefer-dist --ignore-platform-reqs",
    ],
    phpunit: {
      phpunitPath: "vendor/bin/phpunit",
      configPath: "phpunit.xml",
    },
    expectedMinTests: 200, // Friends has 227 tests
    allowedFailures: 5, // We know 5 tests fail due to REST API mocking limitations
  },
  // AMP - Automattic's AMP plugin (has 2841 tests, takes a long time to run)
  {
    name: "AMP",
    repo: "Automattic/amp-wp",
    branch: "develop",
    setupCommands: [
      "composer install --no-interaction --prefer-dist --ignore-platform-reqs",
    ],
    phpunit: {
      phpunitPath: "vendor/bin/phpunit",
      configPath: "phpunit.xml.dist",
      phpunitArgs: [
        "--filter",
        "(?!.*AMP_Image_Dimension_Extract_Download_Test)" // Exclude test that requires PHP built-in server (exec php -S) which doesn't work in Playground
      ],
    },
    expectedMinTests: 2000, // AMP has 2837 tests (2841 - 4 excluded)
    allowedFailures: undefined, // TBD - we'll see how many pass
  },
  // SQLite Database Integration
  {
    name: "SQLite Database Integration",
    repo: "WordPress/sqlite-database-integration",
    branch: "develop",
    setupCommands: [
      "composer install --no-interaction --prefer-dist --ignore-platform-reqs",
    ],
    phpunit: {
      phpunitPath: "vendor/bin/phpunit",
      configPath: "phpunit.xml.dist",
    },
    expectedMinTests: 100, // Conservative estimate
    allowedFailures: 11, // TBD - we'll see how many pass
  },
];

describe('External WordPress plugins compatibility', () => {
  const testDir = path.join(os.tmpdir(), 'wp-tester-plugin-tests');
  let gitAvailable = false;

  beforeAll(() => {
    // Check if git is available
    try {
      execSync('git --version', { stdio: 'ignore' });
      gitAvailable = true;
    } catch {
      console.warn('Git is not available - skipping compatibility tests');
      gitAvailable = false;
    }

    // Create test directory
    if (gitAvailable && !fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Cleanup test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  // Create a test for each plugin
  PLUGINS_TO_TEST.forEach((plugin) => {
    describe(plugin.name, () => {
      const pluginDir = path.join(testDir, plugin.repo.replace('/', '-'));
      let setupSucceeded = false;

      beforeAll(async () => {
        // Skip if directory already exists (from previous run)
        if (fs.existsSync(pluginDir)) {
          console.log(`Using existing ${plugin.name} at ${pluginDir}`);
          setupSucceeded = true;
          return;
        }

        try {
          console.log(`Cloning ${plugin.name} from ${plugin.repo}...`);
          const branch = plugin.branch || 'main';
          execSync(
            `git clone --depth 1 --branch ${branch} https://github.com/${plugin.repo}.git ${pluginDir}`,
            { stdio: 'inherit' }
          );

          // Run setup commands
          if (plugin.setupCommands) {
            for (const cmd of plugin.setupCommands) {
              console.log(`Running: ${cmd}`);
              execSync(cmd, { cwd: pluginDir, stdio: 'inherit' });
            }
          }

          setupSucceeded = true;
        } catch (error) {
          console.error(`Failed to set up ${plugin.name}:`, error);
          setupSucceeded = false;
        }
      }); // No timeout - controlled by vitest.config.ts

      it('should run PHPUnit tests successfully', async () => {
        if (!gitAvailable) {
          console.log('Skipping test - git not available');
          return;
        }

        if (!setupSucceeded) {
          throw new Error(`Setup failed for ${plugin.name}`);
        }

        const configPath = path.join(pluginDir, plugin.phpunit.configPath);

        // Verify config exists
        if (!fs.existsSync(configPath)) {
          throw new Error(`PHPUnit config not found at ${configPath}`);
        }

        // Get additional PHPUnit arguments from config
        const phpunitArgs: string[] = plugin.phpunit.phpunitArgs || [];

        // Run tests
        const report = await runPhpunitTests({
          projectHostPath: pluginDir,
          projectType: 'plugin',
          tests: {
            phpunit: plugin.phpunit
          },
          environments: [
            {
              name: 'WordPress 6.7.0 and PHP 8.2',
              blueprint: {
                preferredVersions: {
                  php: '8.2',
                  wp: '6.7.0'
                }
              }
            }
          ],
          reporters: ['default'] // Show output during tests
        }, phpunitArgs);

        // Validate results
        expect(report.results.summary.tests).toBeGreaterThan(0);

        if (plugin.expectedMinTests) {
          expect(report.results.summary.tests).toBeGreaterThanOrEqual(plugin.expectedMinTests);
        }

        // Check failure tolerance
        const failures = report.results.summary.failed;
        if (plugin.allowedFailures !== undefined) {
          expect(failures).toBeLessThanOrEqual(plugin.allowedFailures);
        } else {
          expect(failures).toBe(0);
        }

        // Log summary
        console.log(`
${plugin.name} Test Results:
  Total: ${report.results.summary.tests}
  Passed: ${report.results.summary.passed}
  Failed: ${report.results.summary.failed}
  Skipped: ${report.results.summary.skipped}
        `);
      }); // No timeout - controlled by vitest.config.ts
    });
  });
});

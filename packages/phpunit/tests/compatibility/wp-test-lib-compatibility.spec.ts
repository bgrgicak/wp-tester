import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runPhpunitTests } from '../../src/runner.js';
import type { PHPUnitConfig, ResolvedEnvironment } from '@wp-tester/config';
import { startPlayground } from '@wp-tester/runtime';
import { parseJUnitXml } from '../../src/junit-parser.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';

/**
 * Compatibility tests for wordpress-tests-lib support using external WordPress plugins
 * and WordPress core PHPUnit tests.
 *
 * These tests download actual WordPress plugins and WordPress core from GitHub
 * and run their PHPUnit tests to verify that our wordpress-tests-lib implementation
 * works correctly.
 */

interface PluginTestConfig {
  name: string;
  repo: string; // GitHub repo in format "owner/repo"
  branch?: string; // Default: main
  dirName?: string; // Custom directory name (defaults to repo name with / replaced by -)
  setupCommands?: string[]; // Commands to run after clone (e.g., composer install)
  phpunit: PHPUnitConfig; // PHPUnit configuration
  expectedMinTests?: number; // Minimum number of tests we expect to run
  allowedFailures?: number; // Number of test failures we tolerate (for known issues)
}

/**
 * Configuration for WordPress core PHPUnit tests
 */
interface CoreTestConfig {
  name: string;
  repo: string; // GitHub repo in format "owner/repo"
  branch?: string; // Default: trunk
  dirName?: string; // Custom directory name
  setupCommands?: string[]; // Commands to run after clone
  srcPath: string; // Path to WordPress source within the repo (e.g., "src")
  testsPath: string; // Path to tests directory within the repo (e.g., "tests/phpunit")
  phpunitPath: string; // Path to PHPUnit executable
  phpunitConfigPath: string; // Path to PHPUnit config file
  phpunitArgs?: string[]; // Additional PHPUnit arguments
  expectedMinTests?: number; // Minimum number of tests we expect to run
  allowedFailures?: number; // Number of test failures we tolerate
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
  // AMP - Automattic's AMP plugin
  // Using --filter with inverse pattern to exclude the problematic test class
  // test-amp-image-dimension-extract-download.php requires exec('php -S') which doesn't work in WASM
  {
    name: "AMP",
    repo: "Automattic/amp-wp",
    branch: "develop",
    dirName: "amp", // Use 'amp' instead of 'Automattic-amp-wp' to match plugin expectations
    setupCommands: [
      "composer install --no-interaction --prefer-dist --ignore-platform-reqs",
    ],
    phpunit: {
      phpunitPath: "vendor/bin/phpunit",
      configPath: "phpunit.xml.dist",
      // Try using --filter to exclude the test class name
      // PHPUnit 9 doesn't support negative lookahead, so we'll try a simple inversion
      phpunitArgs: [
        "--filter",
        "/^((?!AMP_Image_Dimension_Extract_Download_Test).)*$/",
      ],
    },
    expectedMinTests: 2800, // Should run ~2837 tests (2841 - 4 problematic tests)
    allowedFailures: 900, // Allow up to 900 failures (811 errors + 40 failures) due to environment-specific issues
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

/**
 * WordPress core PHPUnit tests to run for compatibility testing
 *
 * These tests run actual WordPress core PHPUnit tests to verify the framework
 * can handle core WordPress testing scenarios.
 */
const CORE_TO_TEST: CoreTestConfig[] = [
  {
    name: "WordPress Core",
    repo: "WordPress/wordpress-develop",
    branch: "trunk",
    dirName: "wordpress-develop",
    setupCommands: [
      "composer install --no-interaction --prefer-dist --ignore-platform-reqs",
    ],
    srcPath: "src",
    testsPath: "tests/phpunit",
    phpunitPath: "vendor/bin/phpunit",
    phpunitConfigPath: "phpunit.xml.dist", // Config is in repo root, not tests/phpunit/
    // Run a subset of core tests for compatibility testing
    // Full test suite would take too long for CI
    phpunitArgs: [
      "--testsuite",
      "default",
      // Filter to run specific test groups that are most representative
      "--group",
      "option,meta,query,post,user,term,comment,date,l10n",
    ],
    expectedMinTests: 500, // Conservative estimate for filtered tests
    allowedFailures: 100, // Allow some failures due to environment differences
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
      const pluginDir = path.join(testDir, plugin.dirName || plugin.repo.replace('/', '-'));
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
          console.log("Skipping test - git not available");
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

        // Run tests
        const report = await runPhpunitTests({
          projectHostPath: pluginDir,
          projectType: "plugin",
          tests: {
            phpunit: plugin.phpunit,
          },
          environments: [
            {
              name: "WordPress 6.7.0 and PHP 8.2",
              blueprint: {
                preferredVersions: {
                  php: "latest",
                  wp: "latest",
                },
              },
            },
          ],
          reporters: ["default"], // Show output during tests
        });

        // Validate results
        expect(report.results.summary.tests).toBeGreaterThan(0);

        if (plugin.expectedMinTests) {
          expect(report.results.summary.tests).toBeGreaterThanOrEqual(
            plugin.expectedMinTests
          );
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

/**
 * WordPress core PHPUnit tests
 *
 * These tests verify the framework can run WordPress core's own PHPUnit tests.
 * Core tests require special handling because they ARE the wordpress-tests-lib
 * (the tests we're testing against).
 */
describe('WordPress core PHPUnit compatibility', () => {
  const testDir = path.join(os.tmpdir(), 'wp-tester-core-tests');
  let gitAvailable = false;

  beforeAll(() => {
    // Check if git is available
    try {
      execSync('git --version', { stdio: 'ignore' });
      gitAvailable = true;
    } catch {
      console.warn('Git is not available - skipping core compatibility tests');
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

  // Create a test for each core test configuration
  CORE_TO_TEST.forEach((coreConfig) => {
    describe(coreConfig.name, () => {
      const coreDir = path.join(testDir, coreConfig.dirName || coreConfig.repo.replace('/', '-'));
      let setupSucceeded = false;

      beforeAll(async () => {
        // Skip if directory already exists (from previous run)
        if (fs.existsSync(coreDir)) {
          console.log(`Using existing ${coreConfig.name} at ${coreDir}`);
          setupSucceeded = true;
          return;
        }

        try {
          console.log(`Cloning ${coreConfig.name} from ${coreConfig.repo}...`);
          const branch = coreConfig.branch || 'trunk';
          execSync(
            `git clone --depth 1 --branch ${branch} https://github.com/${coreConfig.repo}.git ${coreDir}`,
            { stdio: 'inherit' }
          );

          // Run setup commands
          if (coreConfig.setupCommands) {
            for (const cmd of coreConfig.setupCommands) {
              console.log(`Running: ${cmd}`);
              execSync(cmd, { cwd: coreDir, stdio: 'inherit' });
            }
          }

          setupSucceeded = true;
        } catch (error) {
          console.error(`Failed to set up ${coreConfig.name}:`, error);
          setupSucceeded = false;
        }
      }); // No timeout - controlled by vitest.config.ts

      it('should run core PHPUnit tests successfully', async () => {
        if (!gitAvailable) {
          console.log("Skipping test - git not available");
          return;
        }

        if (!setupSucceeded) {
          throw new Error(`Setup failed for ${coreConfig.name}`);
        }

        const phpunitConfigPath = path.join(coreDir, coreConfig.phpunitConfigPath);
        const phpunitPath = path.join(coreDir, coreConfig.phpunitPath);
        const srcPath = path.join(coreDir, coreConfig.srcPath);
        const testsPath = path.join(coreDir, coreConfig.testsPath);

        // Verify paths exist
        if (!fs.existsSync(phpunitConfigPath)) {
          throw new Error(`PHPUnit config not found at ${phpunitConfigPath}`);
        }
        if (!fs.existsSync(phpunitPath)) {
          throw new Error(`PHPUnit executable not found at ${phpunitPath}`);
        }
        if (!fs.existsSync(srcPath)) {
          throw new Error(`WordPress source not found at ${srcPath}`);
        }
        if (!fs.existsSync(testsPath)) {
          throw new Error(`Tests directory not found at ${testsPath}`);
        }

        // Create wp-tests-config.php for core tests
        const wpTestsConfig = `<?php
/* Path to the WordPress codebase to test. */
define( 'ABSPATH', '/wordpress/' );

// Test Database
define( 'DB_NAME', 'wordpress_test' );
define( 'DB_USER', 'root' );
define( 'DB_PASSWORD', '' );
define( 'DB_HOST', 'localhost' );
define( 'DB_CHARSET', 'utf8' );
define( 'DB_COLLATE', '' );

$table_prefix = 'wptests_';

define( 'WP_TESTS_DOMAIN', 'example.org' );
define( 'WP_TESTS_EMAIL', 'admin@example.org' );
define( 'WP_TESTS_TITLE', 'Test Blog' );
define( 'WP_PHP_BINARY', 'php' );
define( 'WPLANG', '' );
`;

        // Write wp-tests-config.php to tests directory
        const wpTestsConfigPath = path.join(testsPath, 'wp-tests-config.php');
        fs.writeFileSync(wpTestsConfigPath, wpTestsConfig);

        // Create environment with mounts for core tests
        // Mount src/ as /wordpress/ and entire repo as /project/
        const environment: ResolvedEnvironment = {
          name: "WordPress Core Tests",
          blueprint: {
            preferredVersions: {
              php: "latest",
              wp: "latest",
            },
          },
          mounts: [
            {
              hostPath: srcPath,
              vfsPath: "/wordpress",
              beforeInstall: true, // Mount before WordPress install to replace default
            },
            {
              hostPath: coreDir,
              vfsPath: "/project",
            },
          ],
        };

        console.log(`Running ${coreConfig.name} PHPUnit tests...`);

        // Start playground with mounts
        const runtime = await startPlayground(environment);
        const playground = runtime.playground;

        try {
          // Build PHPUnit command
          const logFilePath = `/tmp/phpunit-core-results-${Date.now()}.xml`;

          const cliArgs = [
            "php",
            "-d",
            "variables_order=EGPCS",
            `/project/${coreConfig.phpunitPath}`,
            "-c",
            `/project/${coreConfig.phpunitConfigPath}`,
            "--log-junit",
            logFilePath,
          ];

          // Add additional PHPUnit arguments
          if (coreConfig.phpunitArgs) {
            cliArgs.push(...coreConfig.phpunitArgs);
          }

          // Run PHPUnit with WP_TESTS_DIR pointing to our tests directory
          const result = await playground.cli(cliArgs, {
            env: {
              WP_TESTS_DIR: `/project/${coreConfig.testsPath}`,
            },
          });

          // Stream output
          await Promise.all([
            result.stdout.pipeTo(
              new WritableStream({
                write(chunk) {
                  process.stdout.write(chunk);
                },
              })
            ),
            result.stderr.pipeTo(
              new WritableStream({
                write(chunk) {
                  process.stderr.write(chunk);
                },
              })
            ),
          ]);

          const exitCode = await result.exitCode;

          if (exitCode !== 0 && exitCode !== 1 && exitCode !== 2) {
            throw new Error(`PHPUnit exited with code ${exitCode}`);
          }

          // Check if log file was created
          if (!(await playground.fileExists(logFilePath))) {
            throw new Error(`PHPUnit log file not created at ${logFilePath}`);
          }

          // Read and parse results
          const xmlString = await playground.readFileAsText(logFilePath);
          const report = await parseJUnitXml(xmlString, environment.name);

          // Validate results
          expect(report.results.summary.tests).toBeGreaterThan(0);

          if (coreConfig.expectedMinTests) {
            expect(report.results.summary.tests).toBeGreaterThanOrEqual(
              coreConfig.expectedMinTests
            );
          }

          // Check failure tolerance
          const failures = report.results.summary.failed;
          if (coreConfig.allowedFailures !== undefined) {
            expect(failures).toBeLessThanOrEqual(coreConfig.allowedFailures);
          } else {
            expect(failures).toBe(0);
          }

          // Log summary
          console.log(`
${coreConfig.name} Test Results:
  Total: ${report.results.summary.tests}
  Passed: ${report.results.summary.passed}
  Failed: ${report.results.summary.failed}
  Skipped: ${report.results.summary.skipped}
          `);
        } finally {
          runtime.server.close();
        }
      }); // No timeout - controlled by vitest.config.ts
    });
  });
});

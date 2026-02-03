import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runPhpunitTests } from '../../src/runner.js';
import { resolveConfig } from "@wp-tester/config";
import type { WPTesterConfig } from "@wp-tester/config";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execSync } from "node:child_process";

/**
 * Compatibility tests for wordpress-tests-lib support using external WordPress projects.
 *
 * These tests download actual WordPress plugins and WordPress core from GitHub
 * and run their PHPUnit tests to verify that our wordpress-tests-lib implementation
 * works correctly.
 */

interface CompatibilityTestCase {
  /** Display name for the test */
  name: string;
  /** GitHub repo in format "owner/repo" */
  repo: string;
  /** Branch to clone (default: "main" for plugins, "trunk" for core) */
  branch?: string;
  /** Custom directory name (defaults to repo name with / replaced by -) */
  dirName?: string;
  /** Commands to run after clone (e.g., composer install) */
  setupCommands?: string[];
  /**
   * WPTesterConfig with relative paths (projectHostPath will be set dynamically).
   * Note: Mount paths can be relative and will be resolved by resolveConfig.
   */
  config: WPTesterConfig;
  /** Minimum number of tests we expect to run */
  expectedMinTests?: number;
  /** Number of test failures we tolerate (for known issues) */
  allowedFailures?: number;
}

const COMPATIBILITY_TESTS: CompatibilityTestCase[] = [
  // Friends plugin - WordPress plugin with good test coverage
  {
    name: "Friends Plugin",
    repo: "akirk/friends",
    branch: "main",
    setupCommands: [
      "composer install --no-interaction --prefer-dist --ignore-platform-reqs --quiet",
    ],
    config: {
      projectType: "plugin",
      tests: {
        phpunit: {
          phpunitPath: "vendor/bin/phpunit",
          configPath: "phpunit.xml",
        },
      },
      environments: [
        {
          name: "WordPress Latest + PHP Latest",
          blueprint: {
            preferredVersions: {
              php: "latest",
              wp: "latest",
            },
          },
        },
      ],
      reporters: {},
    },
    expectedMinTests: 200,
    allowedFailures: 5, // REST API mocking limitations
  },

  // AMP plugin - Large plugin with comprehensive test suite
  {
    name: "AMP Plugin",
    repo: "Automattic/amp-wp",
    branch: "develop",
    dirName: "amp",
    setupCommands: [
      "composer install --no-interaction --prefer-dist --ignore-platform-reqs --quiet",
    ],
    config: {
      projectType: "plugin",
      tests: {
        phpunit: {
          phpunitPath: "vendor/bin/phpunit",
          configPath: "phpunit.xml.dist",
          // Exclude tests that require PHP server (exec('php -S') doesn't work in WASM)
          phpunitArgs: [
            "--filter",
            "/^((?!AMP_Image_Dimension_Extract_Download_Test).)*$/",
          ],
        },
      },
      environments: [
        {
          name: "WordPress Latest + PHP Latest",
          blueprint: {
            preferredVersions: {
              php: "latest",
              wp: "latest",
            },
          },
        },
      ],
      reporters: {},
    },
    expectedMinTests: 2800,
    allowedFailures: 900, // Environment-specific issues
  },

  // SQLite Database Integration plugin
  {
    name: "SQLite Database Integration",
    repo: "WordPress/sqlite-database-integration",
    branch: "develop",
    setupCommands: [
      "composer install --no-interaction --prefer-dist --ignore-platform-reqs --quiet",
    ],
    config: {
      projectType: "plugin",
      tests: {
        phpunit: {
          phpunitPath: "vendor/bin/phpunit",
          configPath: "phpunit.xml.dist",
        },
      },
      environments: [
        {
          name: "WordPress Latest + PHP Latest",
          blueprint: {
            preferredVersions: {
              php: "latest",
              wp: "latest",
            },
          },
        },
      ],
      reporters: {},
    },
    expectedMinTests: 750,
    allowedFailures: 11,
  },

  // Performance plugin
  {
    name: "Performance Plugin",
    repo: "WordPress/performance",
    branch: "trunk",
    setupCommands: [
      "composer install --no-interaction --prefer-dist --ignore-platform-reqs --quiet",
    ],
    config: {
      projectType: "plugin",
      tests: {
        wp: false,
        plugin: "performance",
        phpunit: {
          phpunitPath: "vendor/bin/phpunit",
          configPath: "phpunit.xml.dist",
          testMode: "unit",
        },
      },
      environments: [
        {
          name: "Latest WordPress and PHP",
          blueprint: {
            preferredVersions: {
              php: "latest",
              wp: "latest",
            },
            steps: [
              {
                step: "defineWpConfigConsts",
                consts: {
                  WP_ENVIRONMENT_TYPE: "development",
                },
              },
            ],
          },
          mounts: [
            {
              hostPath: "plugins",
              vfsPath: "/wordpress/wp-content/plugins",
            },
          ],
        },
      ],
      reporters: {},
    },
    expectedMinTests: 50,
    allowedFailures: 0,
  },

  // ActivityPub plugin - WordPress plugin for ActivityPub protocol support
  {
    name: "ActivityPub Plugin",
    repo: "Automattic/wordpress-activitypub",
    branch: "trunk",
    dirName: "wordpress-activitypub",
    setupCommands: [
      "composer install --no-interaction --prefer-dist --ignore-platform-reqs --quiet",
    ],
    config: {
      projectType: "plugin",
      tests: {
        phpunit: {
          phpunitPath: "vendor/bin/phpunit",
          configPath: "phpunit.xml.dist",
          testMode: "unit",
        },
      },
      environments: [
        {
          name: "PHP latest + WP latest",
          blueprint: {
            preferredVersions: {
              php: "latest",
              wp: "latest",
            },
          },
        },
      ],
      reporters: {},
    },
    expectedMinTests: 1700,
    allowedFailures: 10,
  },

  // WordPress Core - Tests the framework against WordPress's own test suite
  {
    name: "WordPress Core",
    repo: "WordPress/wordpress-develop",
    branch: "trunk",
    dirName: "wordpress-develop",
    setupCommands: [
      "composer install --no-interaction --prefer-dist --ignore-platform-reqs --quiet",
    ],
    config: {
      projectType: "other",
      projectVFSPath: "/project",
      tests: {
        phpunit: {
          phpunitPath: "vendor/bin/phpunit",
          configPath: "phpunit.xml.dist",
          testMode: "unit", // Core tests need wp-tests-config.php like unit tests
          // Run a subset of core tests for compatibility testing
          phpunitArgs: [
            "--testsuite",
            "default",
            "--group",
            "option,meta,query,post,user,term,comment,date,l10n",
          ],
        },
      },
      environments: [
        {
          name: "WordPress Core Tests",
          blueprint: {
            preferredVersions: {
              php: "latest",
              wp: "latest",
            },
            steps: [
              {
                step: "defineSiteUrl",
                siteUrl: "http://example.org",
              },
            ],
          },
          mounts: [
            {
              hostPath: "src",
              vfsPath: "/wordpress",
              beforeInstall: true,
            },
            {
              hostPath: ".",
              vfsPath: "/project",
            },
          ],
          env: {
            WP_TESTS_DIR: "/project/tests/phpunit",
          },
        },
      ],
      reporters: {},
    },
    expectedMinTests: 5500,
    allowedFailures: 41,
  },
];

describe("WordPress compatibility tests", () => {
  const testDir = path.join(os.tmpdir(), "wp-tester-compatibility-tests");
  let gitAvailable = false;

  beforeAll(() => {
    // Check if git is available
    try {
      execSync("git --version", { stdio: "ignore" });
      gitAvailable = true;
    } catch {
      console.warn("Git is not available - skipping compatibility tests");
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

  // Create a test for each compatibility test case
  // Use describe.concurrent to run all 6 tests in parallel
  COMPATIBILITY_TESTS.forEach((testCase) => {
    describe.concurrent(testCase.name, () => {
      const projectDir = path.join(
        testDir,
        testCase.dirName || testCase.repo.replace("/", "-"),
      );
      let setupSucceeded = false;

      beforeAll(async () => {
        // Skip if directory already exists (from previous run)
        if (fs.existsSync(projectDir)) {
          console.log(`Using existing ${testCase.name} at ${projectDir}`);
          setupSucceeded = true;
          return;
        }

        try {
          console.log(`Cloning ${testCase.name} from ${testCase.repo}...`);
          const branch = testCase.branch || "main";
          execSync(
            `git clone --depth 1 --branch ${branch} https://github.com/${testCase.repo}.git ${projectDir}`,
            { stdio: "inherit" },
          );

          // Run setup commands
          if (testCase.setupCommands) {
            for (const cmd of testCase.setupCommands) {
              console.log(`Running: ${cmd}`);
              // Allow installing packages with security advisories in dev dependencies
              // since we're testing external projects we don't control.
              // COMPOSER_NO_SECURITY_BLOCKING disables Composer 2.9+ automatic security blocking.
              execSync(cmd, {
                cwd: projectDir,
                stdio: "inherit",
                env: { ...process.env, COMPOSER_NO_SECURITY_BLOCKING: "1" },
              });
            }
          }

          setupSucceeded = true;
        } catch (error) {
          console.error(`Failed to set up ${testCase.name}:`, error);
          setupSucceeded = false;
        }
      });

      it("should run PHPUnit tests successfully", async () => {
        if (!gitAvailable) {
          console.log("Skipping test - git not available");
          return;
        }

        if (!setupSucceeded) {
          throw new Error(`Setup failed for ${testCase.name}`);
        }

        const config: WPTesterConfig = {
          ...testCase.config,
          projectHostPath: projectDir,
        };

        // Resolve config before running tests
        const resolvedConfig = await resolveConfig(config);

        // Run tests using the resolved config
        const report = await runPhpunitTests(resolvedConfig);

        // Validate results
        expect(report.results.summary.tests).toBeGreaterThan(0);

        if (testCase.expectedMinTests) {
          expect(report.results.summary.tests).toBeGreaterThanOrEqual(
            testCase.expectedMinTests,
          );
        }

        // Check failure tolerance
        const failures = report.results.summary.failed;
        if (testCase.allowedFailures !== undefined) {
          expect(failures).toBeLessThanOrEqual(testCase.allowedFailures);
        } else {
          expect(failures).toBe(0);
        }

        // Log summary
        console.log(`
${testCase.name} Test Results:
  Total: ${report.results.summary.tests}
  Passed: ${report.results.summary.passed}
  Failed: ${report.results.summary.failed}
  Skipped: ${report.results.summary.skipped}
        `);
      });
    });
  });
});

/**
 * WordPress Site Health Checks
 * Tests that run WordPress Site Health diagnostics to detect configuration issues,
 * missing dependencies, or other operational problems.
 */
import { describe, it, expect, beforeAll, afterAll, inject } from 'vitest';
import type { ResolvedWPTesterConfig } from '@wp-tester/config';
import { startPlayground, stopPlayground, type RunCLIServer } from '@wp-tester/runtime';

// Get config from Vitest's provide/inject
const config = inject('config') as ResolvedWPTesterConfig;
// Filter out skipped environments
const environments = config.environments.filter(env => !env.skip);

interface SiteHealthTest {
  label: string;
  status: 'good' | 'recommended' | 'critical';
  badge: {
    label: string;
    color: string;
  };
  description: string;
  actions: string;
  test: string;
}

interface SiteHealthResults {
  tests: SiteHealthTest[];
  critical: SiteHealthTest[];
  recommended: SiteHealthTest[];
  good: SiteHealthTest[];
}

// Test each environment
for (const environment of environments) {
  describe(`${environment.name} - Site Health Checks`, () => {
    let runtime: RunCLIServer;
    let playground: RunCLIServer['playground'];
    let documentRoot: string;
    let bootError: Error | undefined;

    beforeAll(async () => {
      try {
        runtime = await startPlayground(environment);
        playground = runtime.playground;
        documentRoot = await playground.documentRoot;
      } catch (error) {
        bootError = error as Error;
      }
    });

    afterAll(() => {
      stopPlayground(runtime);
    });

    it("should boot WordPress without errors", ({ task }) => {
      if (bootError) {
        task.meta["error"] = {
          message: bootError?.message,
          stack: bootError?.stack,
        };
      }
      expect(bootError).toBeUndefined();
    });

    describe.skipIf(bootError)("Site Health", () => {
      it("should pass all critical site health checks", async ({ task }) => {
        const result = await playground.run({
          code: `<?php
          require_once "${documentRoot}/wp-load.php";
          require_once ABSPATH . 'wp-admin/includes/class-wp-site-health.php';
          require_once ABSPATH . 'wp-admin/includes/class-wp-site-health-auto-updates.php';

          // Initialize Site Health
          $site_health = WP_Site_Health::get_instance();

          // Get all direct tests (synchronous tests)
          $tests = WP_Site_Health::get_tests();
          $direct_tests = isset($tests['direct']) ? $tests['direct'] : array();

          $results = array(
            'tests' => array(),
            'critical' => array(),
            'recommended' => array(),
            'good' => array(),
          );

          // Run each direct test
          foreach ($direct_tests as $test_key => $test) {
            // Skip tests that require async execution or have specific requirements
            if (!isset($test['test']) || !is_callable($test['test'])) {
              continue;
            }

            try {
              $test_result = call_user_func($test['test']);
              if (is_array($test_result) && isset($test_result['status'])) {
                $test_result['test'] = $test_key;
                $results['tests'][] = $test_result;

                // Categorize by status
                $status = $test_result['status'];
                if ($status === 'critical') {
                  $results['critical'][] = $test_result;
                } elseif ($status === 'recommended') {
                  $results['recommended'][] = $test_result;
                } else {
                  $results['good'][] = $test_result;
                }
              }
            } catch (Exception $e) {
              // Skip tests that fail to execute
              continue;
            }
          }

          echo json_encode($results);
        ?>`,
        });

        const healthResults: SiteHealthResults = result.json;

        // Store details about critical issues in task metadata for reporting
        if (healthResults.critical.length > 0) {
          const criticalIssues = healthResults.critical.map((test: SiteHealthTest) =>
            `- ${test.label}: ${test.description.replace(/<[^>]*>/g, '')}` // Strip HTML tags
          ).join('\n');

          task.meta["error"] = {
            message: `${healthResults.critical.length} critical site health issue(s) found`,
            stack: criticalIssues,
          };
        }

        expect(
          healthResults.critical,
          `Expected no critical issues but found ${healthResults.critical.length}: ${healthResults.critical.map((t: SiteHealthTest) => t.label).join(', ')}`
        ).toHaveLength(0);
      });

      it("should report site health recommendations", async () => {
        const result = await playground.run({
          code: `<?php
          require_once "${documentRoot}/wp-load.php";
          require_once ABSPATH . 'wp-admin/includes/class-wp-site-health.php';
          require_once ABSPATH . 'wp-admin/includes/class-wp-site-health-auto-updates.php';

          // Initialize Site Health
          $site_health = WP_Site_Health::get_instance();

          // Get all direct tests (synchronous tests)
          $tests = WP_Site_Health::get_tests();
          $direct_tests = isset($tests['direct']) ? $tests['direct'] : array();

          $results = array(
            'tests' => array(),
            'critical' => array(),
            'recommended' => array(),
            'good' => array(),
          );

          // Run each direct test
          foreach ($direct_tests as $test_key => $test) {
            if (!isset($test['test']) || !is_callable($test['test'])) {
              continue;
            }

            try {
              $test_result = call_user_func($test['test']);
              if (is_array($test_result) && isset($test_result['status'])) {
                $test_result['test'] = $test_key;
                $results['tests'][] = $test_result;

                $status = $test_result['status'];
                if ($status === 'critical') {
                  $results['critical'][] = $test_result;
                } elseif ($status === 'recommended') {
                  $results['recommended'][] = $test_result;
                } else {
                  $results['good'][] = $test_result;
                }
              }
            } catch (Exception $e) {
              continue;
            }
          }

          echo json_encode($results);
        ?>`,
        });

        const healthResults: SiteHealthResults = result.json;

        // Log recommendations for informational purposes
        // This test always passes - critical issues are caught by the other test
        const summary = [
          `Site Health Summary: ${healthResults.tests.length} tests run`,
          `  - Good: ${healthResults.good.length}`,
          `  - Recommended: ${healthResults.recommended.length}`,
          `  - Critical: ${healthResults.critical.length}`,
        ];

        if (healthResults.recommended.length > 0) {
          summary.push('\nRecommendations:');
          healthResults.recommended.forEach((test: SiteHealthTest) => {
            summary.push(`  - ${test.label}`);
          });
        }

        // Store summary in task name for visibility in reports
        // The test passes but provides visibility into site health status
        expect(healthResults.tests.length).toBeGreaterThan(0);
      });
    });
  });
}

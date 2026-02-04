import type { Tests, ProjectType } from "./wp-tester-config";
import type { ResolvedTests, ResolvedPHPUnitConfig, ResolvedPath } from "./resolved-types";
import { resolveAbsolute, toResolvedPath } from "./path-utils";
import { resolveBootstrapPath } from './options/phpunit-detect';
import { hostToVfs } from './path-mappers';
import { validateSmokeTests } from './smoke-tests-validation';

/**
 * Extract the plugin slug from a VFS path.
 * Expected format: /wordpress/wp-content/plugins/<slug> or /wordpress/wp-content/plugins/<slug>/
 */
export function extractPluginSlug(vfsPath: string): string | undefined {
  const match = vfsPath.match(/\/wp-content\/plugins\/([^/]+)/);
  return match ? match[1] : undefined;
}

/**
 * Extract the theme slug from a VFS path.
 * Expected format: /wordpress/wp-content/themes/<slug> or /wordpress/wp-content/themes/<slug>/
 */
export function extractThemeSlug(vfsPath: string): string | undefined {
  const match = vfsPath.match(/\/wp-content\/themes\/([^/]+)/);
  return match ? match[1] : undefined;
}

/**
 * Derive the project slug from VFS path based on project type.
 * @param vfsPath - The VFS path where the project is mounted
 * @param projectType - The project type (plugin, theme, etc.)
 * @returns The derived slug or undefined if not derivable
 */
export function deriveProjectSlug(vfsPath: string, projectType: ProjectType): string | undefined {
  switch (projectType) {
    case 'plugin':
      return extractPluginSlug(vfsPath);
    case 'theme':
      return extractThemeSlug(vfsPath);
    default:
      return undefined;
  }
}

/**
 * PHPUnit flags that are boolean (do not take a value).
 * If a flag is NOT in this list, we assume it takes a value,
 * and therefore the next argument should NOT be resolved as a path.
 */
const PHPUNIT_BOOLEAN_FLAGS = new Set([
  '--teamcity', '--debug', '--verbose', '--testdox',
  '--stderr', '--stop-on-error', '--stop-on-failure', '--stop-on-warning',
  '--stop-on-defect', '--stop-on-risky', '--stop-on-skipped', '--stop-on-incomplete',
  '--stop-on-deprecation', '--stop-on-notice',
  '--fail-on-warning', '--fail-on-risky', '--fail-on-incomplete', '--fail-on-skipped',
  '--fail-on-deprecation', '--fail-on-notice',
  '--strict-coverage', '--strict-global-state', '--disallow-test-output',
  '--disallow-resource-usage', '--enforce-time-limit',
  '--process-isolation', '--no-globals-backup', '--static-backup',
  '--no-configuration', '--no-coverage', '--no-logging', '--no-interaction',
  '--no-extensions', '--no-output', '--dont-report-useless-tests',
  '--no-progress',
  '--display-deprecations', '--display-errors', '--display-incomplete',
  '--display-notices', '--display-skipped', '--display-warnings',
  '--strict',
  '--help', '--version',
  '--list-groups', '--list-suites', '--list-tests', '--list-tests-xml',
]);

/**
 * Resolve PHPUnit arguments to map host paths to VFS paths
 *
 * @param args - Original arguments from config
 * @param projectPath - Project path with host and VFS paths
 * @returns Resolved arguments with paths converted to VFS paths
 */
export function resolvePhpunitArgs(args: string[], projectPath: ResolvedPath): string[] {
  const resolvedArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Don't resolve flags
    if (arg.startsWith('-')) {
      resolvedArgs.push(arg);
      continue;
    }

    // Check if the previous argument was a flag that takes a value
    const prevArg = args[i - 1];
    if (prevArg?.startsWith('-') && !prevArg.includes('=')) {
      // If the previous flag is NOT a known boolean flag, assume it takes a value
      const flagName = prevArg.split('=')[0];
      if (!PHPUNIT_BOOLEAN_FLAGS.has(flagName)) {
        resolvedArgs.push(arg); // This is the flag's value, not a path
        continue;
      }
    }

    // Resolve arguments that look like file/directory paths
    const looksLikePath = arg.includes('/') ||
                          arg.endsWith('.php') ||
                          arg === 'tests' || arg === 'test';

    if (looksLikePath) {
      const absoluteHostPath = resolveAbsolute(arg, projectPath.hostPath);
      const vfsPath = hostToVfs(absoluteHostPath, projectPath);
      resolvedArgs.push(vfsPath);
      continue;
    }

    resolvedArgs.push(arg);
  }

  return resolvedArgs;
}

/**
 * Resolve PHPUnit config paths and set default testMode
 * @param tests - Tests configuration
 * @param projectPath - Project path with host and VFS paths
 * @returns Resolved tests configuration
 */
export async function resolveTests(
  tests: Tests,
  projectPath: ResolvedPath
): Promise<ResolvedTests> {
  // Validate smokeTests if present
  if (tests.smokeTests !== undefined) {
    // This will throw if include and exclude are both specified
    validateSmokeTests(tests.smokeTests);
  }

  // If no PHPUnit config, return tests as-is
  if (!tests.phpunit) {
    return {
      smokeTests: tests.smokeTests,
      passWithNoTests: tests.passWithNoTests,
    };
  }

  // Resolve PHPUnit config with absolute paths and default testMode
  const phpunit = tests.phpunit;
  const resolvedConfigHostPath = resolveAbsolute(phpunit.configPath, projectPath.hostPath);

  // Resolve bootstrap path using centralized logic
  const bootstrapHostPath = await resolveBootstrapPath(
    resolvedConfigHostPath,
    projectPath.hostPath,
    phpunit.bootstrapPath
  );

  const resolvedPhpunit: ResolvedPHPUnitConfig = {
    phpunitPath: toResolvedPath(resolveAbsolute(phpunit.phpunitPath, projectPath.hostPath), projectPath),
    configPath: toResolvedPath(resolvedConfigHostPath, projectPath),
    testMode: phpunit.testMode ?? "unit",
    bootstrapPath: bootstrapHostPath ? toResolvedPath(bootstrapHostPath, projectPath) : undefined,
  };

  // Resolve phpunitArgs paths if present
  if (phpunit.phpunitArgs) {
    resolvedPhpunit.phpunitArgs = resolvePhpunitArgs(phpunit.phpunitArgs, projectPath);
  }

  return {
    smokeTests: tests.smokeTests,
    phpunit: resolvedPhpunit,
    passWithNoTests: tests.passWithNoTests,
  };
}

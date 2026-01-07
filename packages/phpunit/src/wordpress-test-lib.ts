import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import * as yauzl from 'yauzl';
import { cacheFetch } from './cache-fetch';
import type { ResolvedEnvironment } from '@wp-tester/config';
import { resolveWordPressRelease } from '@wp-playground/wordpress';
import type { StepDefinition } from '@wp-playground/blueprints';

/**
 * Default path where WordPress test library is mounted in the VFS.
 * Can be overridden via environment.env.WP_TESTS_DIR
 */
export const DEFAULT_WP_TESTS_DIR = "/tmp/wordpress-tests-lib";

interface GitHubTag {
  name: string;
  zipball_url: string;
  tarball_url: string;
  commit: {
    sha: string;
    url: string;
  };
}

/**
 * Calculate checksum of a file
 */
function calculateFileChecksum(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Find the closest matching WordPress test library version tag
 * WordPress might use 6.9, but wordpress-develop uses 6.9.0
 *
 * Falls back to assuming exact tag exists if GitHub API is unavailable
 */
async function findMatchingTag(requestedVersion: string): Promise<string> {
  try {
    const response = await fetch('https://api.github.com/repos/WordPress/wordpress-develop/tags?per_page=100', {
      headers: {
        'User-Agent': 'wp-tester',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    // Check for non-200 status codes
    if (!response.ok) {
      console.warn(`GitHub API returned status ${response.status}. Attempting fallback version resolution.`);
      const fallbackTag = inferTagName(requestedVersion);
      if (fallbackTag) {
        return fallbackTag;
      }
      throw new Error(`GitHub API returned status ${response.status} and could not infer tag name for version ${requestedVersion}`);
    }

    const tags = await response.json() as GitHubTag[];

    // Try exact match first
    const exactMatch = tags.find(tag => tag.name === requestedVersion);
    if (exactMatch) {
      return exactMatch.name;
    }

    // Parse version to try X.Y.0 pattern
    const versionMatch = requestedVersion.match(/^(\d+\.\d+)(?:\.(\d+))?$/);
    if (versionMatch) {
      const [, baseVersion, patch] = versionMatch;

      // If no patch version provided (e.g., "6.9"), try X.Y.0
      if (!patch) {
        const tagWithZero = tags.find((tag) => tag.name === `${baseVersion}.0`);
        if (tagWithZero) {
          return tagWithZero.name;
        }
      }

      // Try to find closest patch version
      const matchingTags = tags.filter((tag) =>
        tag.name.startsWith(`${baseVersion}.`)
      );
      if (matchingTags.length > 0) {
        const closest = matchingTags[0];
        return closest.name;
      }
    }

    throw new Error(`No matching WordPress test library tag found for version ${requestedVersion}`);
  } catch (error) {
    // Fallback on any error (network, parse, etc.)
    if (error instanceof Error && error.message.includes('GitHub API returned status')) {
      // Already handled above, just rethrow if no fallback
      throw error;
    }

    console.warn(`Failed to fetch GitHub tags: ${error instanceof Error ? error.message : 'Unknown error'}. Attempting fallback version resolution.`);

    const fallbackTag = inferTagName(requestedVersion);
    if (fallbackTag) {
      return fallbackTag;
    }

    throw error;
  }
}

/**
 * Infer the tag name from a version string when GitHub API is unavailable
 * Converts "6.9" to "6.9.0", keeps "6.4.1" as is
 */
function inferTagName(version: string): string | null {
  const versionMatch = version.match(/^(\d+\.\d+)(?:\.(\d+))?$/);
  if (!versionMatch) {
    return null; // Invalid version format
  }

  const [, baseVersion, patch] = versionMatch;

  // If no patch version, assume .0
  if (!patch) {
    return `${baseVersion}.0`;
  }

  // Already has patch version, use as-is
  return version;
}

/**
 * Download WordPress test library from GitHub and cache it locally
 * Uses temp directory with atomic rename to prevent race conditions
 *
 * @param version - WordPress version (e.g., "6.9" or "6.4.1")
 * @param baseCacheDir - Optional base cache directory (for testing)
 * @returns Path to cached test library directory
 */
export async function downloadWordPressTestLib(
  version: string,
  baseCacheDir?: string
): Promise<string> {
  const cacheBase = baseCacheDir || path.join(os.homedir(), '.wp-tester', 'cache');

  // Find the matching tag on GitHub (e.g., "6.9" -> "6.9.0")
  const actualTag = await findMatchingTag(version);

  const finalDir = path.join(cacheBase, 'test-lib', actualTag);
  const checksumFile = path.join(finalDir, '.checksum');

  const url = `https://github.com/WordPress/wordpress-develop/archive/refs/tags/${actualTag}.zip`;

  // Download and cache the zip file (cache expires after 24 hours by default)
  const zipPath = await cacheFetch({
    baseCacheDir: cacheBase,
    cacheKey: `test-lib-zip/${actualTag}`,
    url,
  });

  // Calculate checksum of the zip file
  const currentChecksum = calculateFileChecksum(zipPath);

  // Check if we already have this exact version extracted
  if (fs.existsSync(checksumFile)) {
    const existingChecksum = fs.readFileSync(checksumFile, 'utf-8').trim();
    if (existingChecksum === currentChecksum) {
      // Already extracted with same checksum, return existing directory
      return finalDir;
    }
  }

  // Extract to temporary directory first
  const tempDir = fs.mkdtempSync(path.join(cacheBase, `temp-${actualTag}-`));

  try {
    // Extract zip file using yauzl (lightweight zip parser)
    await new Promise<void>((resolve, reject) => {
      yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
        if (err || !zipfile) {
          reject(err || new Error('Failed to open zip file'));
          return;
        }

        const testPrefix = 'tests/phpunit/';
        let extractedFiles = 0;

        zipfile.readEntry();

        zipfile.on('entry', (entry: yauzl.Entry) => {
          // Skip directories
          if (/\/$/.test(entry.fileName)) {
            zipfile.readEntry();
            return;
          }

          // Only extract files from tests/phpunit/
          if (entry.fileName.includes(testPrefix)) {
            const idx = entry.fileName.indexOf(testPrefix);
            if (idx !== -1) {
              const relativePath = entry.fileName.substring(idx + testPrefix.length);
              const targetPath = path.join(tempDir, relativePath);

              // Ensure parent directory exists
              fs.mkdirSync(path.dirname(targetPath), { recursive: true });

              // Extract file
              zipfile.openReadStream(entry, (err, readStream) => {
                if (err || !readStream) {
                  reject(err || new Error('Failed to read zip entry'));
                  return;
                }

                const writeStream = fs.createWriteStream(targetPath);
                readStream.pipe(writeStream);

                writeStream.on('close', () => {
                  extractedFiles++;
                  zipfile.readEntry();
                });

                writeStream.on('error', reject);
                readStream.on('error', reject);
              });
              return;
            }
          }

          zipfile.readEntry();
        });

        zipfile.on('end', () => {
          if (extractedFiles === 0) {
            reject(new Error('No test files found in archive'));
          } else {
            resolve();
          }
        });

        zipfile.on('error', reject);
      });
    });

    // Write checksum file
    fs.writeFileSync(path.join(tempDir, '.checksum'), currentChecksum);

    // Atomic operation: remove old directory and rename temp to final
    // If final directory exists, remove it
    if (fs.existsSync(finalDir)) {
      fs.rmSync(finalDir, { recursive: true, force: true });
    }

    // Ensure parent directory exists
    fs.mkdirSync(path.dirname(finalDir), { recursive: true });

    // Rename is atomic on most filesystems - if multiple processes try this,
    // only one will succeed, others will fail and retry
    fs.renameSync(tempDir, finalDir);

    return finalDir;
  } catch (error) {
    // Clean up temp directory on failure
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    throw new Error(`Failed to download WordPress test library version ${version} (tag: ${actualTag}). Please ensure the version exists in the WordPress repository: ${(error as Error).message}`);
  }
}

/**
 * Mount WordPress test library to environment and add initialization steps
 *
 * IMPORTANT: This function is designed for UNIT TESTS ONLY.
 * For integration tests, use the standard WordPress installation (wp-load.php).
 *
 * The WordPress test library provides test utilities and a clean test database,
 * but expects to control WordPress initialization itself. Integration tests that
 * load WordPress before the test library's bootstrap can cause conflicts.
 *
 * @param environment - Environment configuration
 * @returns Environment with test library mount and initialization steps added
 */
export async function mountWordPressTestLibrary(
  environment: ResolvedEnvironment
): Promise<ResolvedEnvironment> {
  // Resolve WordPress version from environment
  const wpRelease = await resolveWordPressRelease(
    environment.blueprint.preferredVersions.wp
  );
  const wpVersion = wpRelease.version as string;

  // Download and cache test library
  const cachePath = await downloadWordPressTestLib(wpVersion);

  // Get WP_TESTS_DIR from environment or use default
  const wpTestsDir = environment.env["WP_TESTS_DIR"] || DEFAULT_WP_TESTS_DIR;

  // Create wp-tests-config.php content
  const wpTestsConfig = `<?php
/* Path to the WordPress codebase you'd like to test. */
define( 'ABSPATH', '/wordpress/' );

// Test Database - Use separate database to avoid conflicts with main WordPress installation
// The test library's install.php drops all tables, so we need isolation
define( 'DB_NAME', 'wordpress_test' );
define( 'DB_USER', 'root' );
define( 'DB_PASSWORD', '' );
define( 'DB_HOST', 'localhost' );
define( 'DB_CHARSET', 'utf8' );
define( 'DB_COLLATE', '' );

$table_prefix = 'wptests_';

// Use a generic domain that tests can override via update_option('home')
// Don't use Playground's actual domain here as it prevents tests from
// dynamically changing the home URL for mock HTTP requests
define( 'WP_TESTS_DOMAIN', 'example.org' );
define( 'WP_TESTS_EMAIL', 'admin@example.org' );
define( 'WP_TESTS_TITLE', 'Test Blog' );

define( 'WP_PHP_BINARY', 'php' );
define( 'WPLANG', '' );
`;

  // Build blueprint steps for initialization
  // For unit tests, we only need to write the wp-tests-config.php file
  // WordPress initialization is handled by the user's bootstrap via test library's bootstrap
  const initSteps: StepDefinition[] = [
    // Write wp-tests-config.php
    {
      step: "writeFile" as const,
      path: `${wpTestsDir}/wp-tests-config.php`,
      data: wpTestsConfig,
    },
  ];

  // Add initialization steps to blueprint
  const existingSteps = environment.blueprint.steps || [];

  // Return environment copy with test library mount and initialization steps added
  const result: ResolvedEnvironment = {
    ...environment,
    blueprint: {
      ...environment.blueprint,
      steps: [...existingSteps, ...initSteps],
    },
    mounts: [
      ...environment.mounts,
      {
        hostPath: cachePath,
        vfsPath: wpTestsDir,
      },
    ],
    env: {
      ...environment.env,
      WP_TESTS_DIR: wpTestsDir,
    },
  };
  return result;
}



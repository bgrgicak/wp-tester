import { cacheFetch } from './cache-fetch';

/**
 * URL for wp-cli.phar download
 * This is the same URL used by WordPress Playground
 */
const WP_CLI_URL = 'https://playground.wordpress.net/wp-cli.phar';

/**
 * Default path where wp-cli.phar is mounted in the VFS
 */
export const WP_CLI_VFS_PATH = '/tmp/wp-cli.phar';

/**
 * Download and cache wp-cli.phar locally
 *
 * Uses ETag/Last-Modified validation to only re-download when the remote
 * file actually changes. This avoids both time-based expiration (which
 * re-downloads unnecessarily) and never-expiring cache (which misses updates).
 *
 * @param baseCacheDir - Optional base cache directory (for testing)
 * @returns Path to cached wp-cli.phar file
 */
export async function downloadWpCli(baseCacheDir?: string): Promise<string> {
  return await cacheFetch({
    baseCacheDir,
    cacheKey: 'wp-cli',
    url: WP_CLI_URL,
    useEtagValidation: true,
    maxRetries: 3,
  });
}

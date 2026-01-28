import { cacheFetch } from "./cache-fetch.js";

/**
 * URL for wp-cli.phar download.
 * This is the same URL used by WordPress Playground.
 */
const WP_CLI_URL = "https://playground.wordpress.net/wp-cli.phar";

/**
 * Default path where wp-cli.phar is mounted in the VFS.
 */
export const WP_CLI_VFS_PATH = "/tmp/wp-cli.phar";

/**
 * Download and cache wp-cli.phar locally.
 *
 * Uses the shared cacheFetch utility to download and cache the file at
 * ~/.wp-tester/cache/wp-cli/download. Uses the default 1-day cache
 * expiration so updates are picked up automatically.
 *
 * @param baseCacheDir - Optional base cache directory (for testing)
 * @returns Path to cached wp-cli.phar file on the host filesystem
 */
export async function downloadWpCli(baseCacheDir?: string): Promise<string> {
  return await cacheFetch({
    baseCacheDir,
    cacheKey: "wp-cli",
    url: WP_CLI_URL,
    maxRetries: 3,
  });
}

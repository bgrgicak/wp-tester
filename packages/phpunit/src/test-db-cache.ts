import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { RemoteAPI } from '@php-wasm/universal';
import type { PlaygroundCliBlueprintV1Worker } from '@wp-playground/cli/blueprints-v1/worker-thread-v1';
import type { PlaygroundCliBlueprintV2Worker } from '@wp-playground/cli/blueprints-v2/worker-thread-v2';

// TODO Remove once @wp-playground/cli exports this type
type PlaygroundCliWorker =
  | PlaygroundCliBlueprintV1Worker
  | PlaygroundCliBlueprintV2Worker;

/**
 * Path to the SQLite database file inside the Playground VFS
 */
export const SQLITE_DB_VFS_PATH = '/wordpress/wp-content/database/.ht.sqlite';

/**
 * Path to the database directory inside the Playground VFS
 */
export const SQLITE_DB_DIR_VFS_PATH = '/wordpress/wp-content/database';

/**
 * Get the cache path for a test database by WordPress version
 */
export function getTestDbCachePath(wpVersion: string, baseCacheDir?: string): string {
  const cacheBase = baseCacheDir || path.join(os.homedir(), '.wp-tester', 'cache');
  return path.join(cacheBase, 'test-db', wpVersion, 'test.sqlite');
}

/**
 * Check if a cached test database exists for the given WordPress version
 */
export function hasTestDbCache(wpVersion: string, baseCacheDir?: string): boolean {
  const cachePath = getTestDbCachePath(wpVersion, baseCacheDir);
  return fs.existsSync(cachePath);
}

/**
 * Save the test database from Playground to the host cache
 *
 * This should be called after install.php has run successfully.
 *
 * @param playground - The Playground instance to read the database from
 * @param wpVersion - WordPress version (used as cache key)
 * @param baseCacheDir - Optional base cache directory
 */
export async function saveTestDbToCache(
  playground: RemoteAPI<PlaygroundCliWorker>,
  wpVersion: string,
  baseCacheDir?: string
): Promise<void> {
  const cachePath = getTestDbCachePath(wpVersion, baseCacheDir);
  const cacheDir = path.dirname(cachePath);

  // Ensure cache directory exists
  fs.mkdirSync(cacheDir, { recursive: true });

  // Read the database file from Playground VFS
  try {
    const dbContent = await playground.readFileAsBuffer(SQLITE_DB_VFS_PATH);
    fs.writeFileSync(cachePath, dbContent);
  } catch (error) {
    // Database file might not exist yet, that's OK
    console.error(`Failed to cache test database: ${(error as Error).message}`);
  }
}

/**
 * Restore the test database from host cache to Playground VFS
 *
 * @param playground - The Playground instance to write the database to
 * @param wpVersion - WordPress version (used as cache key)
 * @param baseCacheDir - Optional base cache directory
 * @returns true if database was restored, false if no cache exists
 */
export async function restoreTestDbFromCache(
  playground: RemoteAPI<PlaygroundCliWorker>,
  wpVersion: string,
  baseCacheDir?: string
): Promise<boolean> {
  const cachePath = getTestDbCachePath(wpVersion, baseCacheDir);

  if (!fs.existsSync(cachePath)) {
    return false;
  }

  try {
    // Read cached database
    const dbContent = fs.readFileSync(cachePath);

    // Ensure the database directory exists in VFS
    if (!(await playground.isDir(SQLITE_DB_DIR_VFS_PATH))) {
      await playground.mkdir(SQLITE_DB_DIR_VFS_PATH);
    }

    // Write the database file to Playground VFS
    await playground.writeFile(SQLITE_DB_VFS_PATH, dbContent);

    return true;
  } catch (error) {
    console.error(`Failed to restore test database from cache: ${(error as Error).message}`);
    return false;
  }
}

/**
 * Clear the cached test database for a specific WordPress version
 */
export function clearTestDbCache(wpVersion: string, baseCacheDir?: string): void {
  const cachePath = getTestDbCachePath(wpVersion, baseCacheDir);
  if (fs.existsSync(cachePath)) {
    fs.unlinkSync(cachePath);
  }
}

/**
 * Clear all cached test databases
 */
export function clearAllTestDbCaches(baseCacheDir?: string): void {
  const cacheBase = baseCacheDir || path.join(os.homedir(), '.wp-tester', 'cache');
  const testDbDir = path.join(cacheBase, 'test-db');
  if (fs.existsSync(testDbDir)) {
    fs.rmSync(testDbDir, { recursive: true, force: true });
  }
}

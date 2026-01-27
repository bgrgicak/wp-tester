/**
 * WordPress Playground Testing Environment
 *
 * Provides WordPress Playground environment setup and utilities for testing.
 */

// Re-export types that test packages will need
export type { BlueprintV1Declaration as Blueprint } from "@wp-playground/blueprints";
export type { RunCLIServer } from "@wp-playground/cli";

/**
 * Represents a mount point mapping between host filesystem and WordPress VFS.
 */
export interface Mount {
	hostPath: string;
	vfsPath: string;
}

// Export playground lifecycle
export { startPlayground, stopPlayground, defaultWpCliPath } from "./playground.js";

// Export WP CLI utilities
export { wpCli, getWordPressVersion } from "./wp-cli.js";
export { downloadWpCli, WP_CLI_VFS_PATH } from "./wp-cli-cache.js";

// Export caching utilities
export { cacheFetch, CACHE_FOREVER, CACHE_DISABLED, CACHE_1_HOUR, CACHE_1_DAY, CACHE_1_WEEK } from "./cache-fetch.js";
export type { CacheFetchOptions } from "./cache-fetch.js";

// Export HTTP utilities
export { request } from "./request.js";

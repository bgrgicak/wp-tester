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

// Export HTTP utilities
export { request } from "./request.js";

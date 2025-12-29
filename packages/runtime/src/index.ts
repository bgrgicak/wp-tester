/**
 * WordPress Playground Testing Environment
 *
 * Provides WordPress Playground environment setup and utilities for testing.
 */

// Re-export types that test packages will need
export type { BlueprintV1Declaration as Blueprint } from "@wp-playground/blueprints";
export type { Mount } from "@wp-playground/cli/mounts";
export type { RunCLIServer } from "@wp-playground/cli";

// Export playground lifecycle
export { startPlayground, stopPlayground, defaultWpCliPath } from "./playground.js";

// Export WP CLI utilities
export { wpCli, getWordPressVersion } from "./wp-cli.js";

// Export HTTP utilities
export { request } from "./request.js";

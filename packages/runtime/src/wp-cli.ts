/**
 * WordPress CLI utilities for Playground
 */

import type { RemoteAPI } from "@php-wasm/universal";
import { PlaygroundCliBlueprintV1Worker } from "@wp-playground/cli/blueprints-v1/worker-thread-v1";
import { PlaygroundCliBlueprintV2Worker } from "@wp-playground/cli/blueprints-v2/worker-thread-v2";
import { defaultWpCliPath } from "./playground.js";

// TODO Remove once @wp-playground/cli exports this type
type PlaygroundCliWorker =
  | PlaygroundCliBlueprintV1Worker
  | PlaygroundCliBlueprintV2Worker;

/**
 * Run WP CLI command in WordPress Playground
 * and return the result.
 *
 * If --format=json is passed, the result is parsed as JSON,
 * otherwise the raw stdout text is returned.
 *
 * @param playground - The playground instance
 * @param args - The WP CLI arguments
 * @returns The CLI command result
 */
export async function wpCli(
  playground: RemoteAPI<PlaygroundCliWorker>,
  args: string[]
): Promise<object | string> {
  const result = await playground.cli([
    "php",
    defaultWpCliPath,
    `--path=${await playground.documentRoot}`,
    ...args,
  ]);

  if (args.includes("--format=json")) {
    try {
      return JSON.parse(await result.stdoutText) as object;
    } catch (e) {
      throw new Error(
        `Failed to parse WP CLI output: ${(e as Error).message}
        Output was: ${await result.stdoutText}`
      );
    }
  }
  return await result.stdoutText;
}

/**
 * Get the WordPress version from a running Playground instance
 *
 * @param playground - The playground instance
 * @returns The WordPress version string (e.g., "6.4.1")
 */
export async function getWordPressVersion(
  playground: RemoteAPI<PlaygroundCliWorker>
): Promise<string> {
  const result = await wpCli(playground, ['core', 'version']) as string;
  return result.trim();
}

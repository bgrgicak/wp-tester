/**
 * WordPress Playground Testing Environment
 *
 * Provides WordPress Playground environment setup and utilities for testing.
 */

import { runCLI } from '@wp-playground/cli';
import type { PHPRequest, PHPResponse } from '@php-wasm/universal';

// Re-export types that test packages will need
export type { BlueprintV1Declaration as Blueprint } from '@wp-playground/blueprints';
export type { Mount } from '@wp-playground/cli/mounts';

// Environment type definition
export interface Environment {
  name?: string;
  blueprint: any;
  mounts?: any[];
}

export const version = '0.0.1';

/**
 * Start a WordPress Playground server from an Environment configuration
 */
export async function startPlayground(environment: Environment) {
  return await runCLI({
    command: "server",
    blueprint: environment.blueprint,
    mount: environment.mounts || [],
    quiet: true,
    internalCookieStore: true,
  });
}

/**
 * Stop a WordPress Playground runtime and cleanup resources
 *
 * @param runtime - The runtime object returned by startPlayground()
 */
export async function stopPlayground(runtime: any): Promise<void> {
  if (runtime?.server) {
    await runtime.server.close();
  }
}

/**
 * Make a request to WordPress Playground
 *
 * @param playground - The playground instance
 * @param phpRequest - The PHP request object
 * @param redirect - How to handle redirects: 'follow' (default), 'error', or 'manual'
 * @param maxRedirects - Maximum number of redirects to follow (default: 20)
 * @returns The PHP response
 */
export async function request(
  playground: any,
  phpRequest: PHPRequest,
  redirect: "follow" | "error" | "manual" = "follow",
  maxRedirects: number = 20,
  _redirectCount: number = 0
): Promise<PHPResponse> {
  const response = await playground.request(phpRequest);

  if (
    redirect === "follow" &&
    response.httpStatusCode >= 300 &&
    response.httpStatusCode < 400 &&
    response.headers.location
  ) {
    if (_redirectCount >= maxRedirects) {
      throw new Error(
        `Too many redirects (${_redirectCount}). Last redirect was to ${response.headers.location[0]}`
      );
    }
    return request(
      playground,
      {
        url: response.headers.location[0],
      },
      redirect,
      maxRedirects,
      _redirectCount + 1
    );
  }
  if (
    redirect === "error" &&
    response.httpStatusCode >= 300 &&
    response.httpStatusCode < 400
  ) {
    throw new Error(
      `Redirect encountered: ${response.httpStatusCode} to ${response.headers.location?.[0]}`
    );
  }
  return response;
}

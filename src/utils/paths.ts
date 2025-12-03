import { fileURLToPath } from "url";
import path from "path";

/**
 * Gets the directory name of the current module.
 * Works in both ESM and CommonJS environments.
 *
 * In ESM (when import.meta is available), uses import.meta.url.
 * In CommonJS (when compiled with tsc), uses __dirname.
 *
 * @param importMetaUrl - Pass import.meta.url from the calling module
 * @returns The directory path of the current module
 */
export function getCurrentDir(importMetaUrl: string | undefined): string {
  // In ESM environments, import.meta.url is available
  if (importMetaUrl) {
    return path.dirname(fileURLToPath(importMetaUrl));
  }

  // In CommonJS environments (after tsc compilation), __dirname is available
  // TypeScript will replace this during CJS compilation
  // @ts-ignore - __dirname exists in CommonJS but not in ESM types
  if (typeof __dirname !== 'undefined') {
    // @ts-ignore
    return __dirname;
  }

  // Fallback (should never reach here in normal usage)
  throw new Error('Unable to determine current directory');
}

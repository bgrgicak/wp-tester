import AdmZip from 'adm-zip';
import { writeFile, rm } from 'fs/promises';
import { join } from 'path';
import {
  getWordPressCachePath,
  getWpCliCachePath,
  ensureCacheDirectories,
} from './cache.js';

const WORDPRESS_API_URL = 'https://api.wordpress.org/core/version-check/1.7/';
const WORDPRESS_DOWNLOAD_BASE = 'https://wordpress.org';
const WPCLI_DOWNLOAD_URL = 'https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar';

/**
 * Resolve "latest" to actual WordPress version number
 */
export async function resolveWordPressVersion(version: string): Promise<string> {
  if (version !== 'latest') {
    return version;
  }

  const response = await fetch(WORDPRESS_API_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch WordPress versions: ${response.statusText}`);
  }

  const data = await response.json() as {
    offers: Array<{ version: string; current?: string }>;
  };

  const latestVersion = data.offers[0]?.version;
  if (!latestVersion) {
    throw new Error('Could not determine latest WordPress version');
  }

  return latestVersion;
}

/**
 * Download and extract WordPress to cache
 * @param version - WordPress version to download
 * @throws Error if download fails or version doesn't exist
 */
export async function downloadWordPress(version: string): Promise<void> {
  await ensureCacheDirectories();

  const resolvedVersion = await resolveWordPressVersion(version);
  const downloadUrl = `${WORDPRESS_DOWNLOAD_BASE}/wordpress-${resolvedVersion}.zip`;
  const cachePath = getWordPressCachePath(version);

  // Download ZIP file
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to download WordPress ${version}: ${response.statusText}. ` +
      `Check https://wordpress.org/download/releases/ for available versions.`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Extract ZIP to cache directory
  try {
    const zip = new AdmZip(buffer);
    zip.extractAllTo(cachePath, true);
  } catch (error) {
    // Clean up on extraction failure
    await rm(cachePath, { recursive: true, force: true });
    throw new Error(
      `Failed to extract WordPress ${version}: ${(error as Error).message}`
    );
  }
}

/**
 * Download WP-CLI to cache
 * @throws Error if download fails
 */
export async function downloadWpCli(): Promise<void> {
  await ensureCacheDirectories();

  const response = await fetch(WPCLI_DOWNLOAD_URL);
  if (!response.ok) {
    throw new Error(`Failed to download WP-CLI: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await writeFile(getWpCliCachePath(), buffer);
}

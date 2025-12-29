import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { cacheFetch, CACHE_DISABLED, CACHE_FOREVER } from '../../src/cache-fetch';

describe('cacheFetch', () => {
  let testCacheDir: string;

  beforeEach(() => {
    // Create a temporary cache directory for testing
    testCacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-tester-cache-test-'));
  });

  afterEach(() => {
    // Clean up test cache directory
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }
  });

  it('should download and cache a file from a valid URL', async () => {
    const result = await cacheFetch({
      baseCacheDir: testCacheDir,
      cacheKey: 'test-download',
      url: 'https://raw.githubusercontent.com/WordPress/WordPress/master/license.txt',
      maxRetries: 1,
    });

    expect(fs.existsSync(result)).toBe(true);
    const content = fs.readFileSync(result, 'utf-8');
    expect(content).toContain('GNU GENERAL PUBLIC LICENSE');
  }, 30000);

  it('should return cached file on subsequent calls', async () => {
    const firstResult = await cacheFetch({
      baseCacheDir: testCacheDir,
      cacheKey: 'test-cache',
      url: 'https://raw.githubusercontent.com/WordPress/WordPress/master/license.txt',
      maxRetries: 1,
    });

    const firstMtime = fs.statSync(firstResult).mtimeMs;

    // Wait a bit to ensure mtime would be different if re-downloaded
    await new Promise(resolve => setTimeout(resolve, 100));

    const secondResult = await cacheFetch({
      baseCacheDir: testCacheDir,
      cacheKey: 'test-cache',
      url: 'https://raw.githubusercontent.com/WordPress/WordPress/master/license.txt',
      maxRetries: 1,
    });

    const secondMtime = fs.statSync(secondResult).mtimeMs;

    expect(firstResult).toBe(secondResult);
    expect(firstMtime).toBe(secondMtime); // File was not re-downloaded
  }, 30000);

  it('should throw error when URL fails', async () => {
    await expect(
      cacheFetch({
        baseCacheDir: testCacheDir,
        cacheKey: 'test-error',
        url: 'https://invalid-url-that-does-not-exist.example.com/file.txt',
        maxRetries: 1,
      })
    ).rejects.toThrow('Failed to download from');
  }, 30000);

  it('should respect cache expiration time', async () => {
    // First download with 100ms expiration
    await cacheFetch({
      baseCacheDir: testCacheDir,
      cacheKey: 'test-expiration',
      url: 'https://raw.githubusercontent.com/WordPress/WordPress/master/license.txt',
      cacheExpiration: 100, // 100ms
      maxRetries: 1,
    });

    const cachePath = path.join(testCacheDir, 'test-expiration', 'download');
    const firstMtime = fs.statSync(cachePath).mtimeMs;

    // Immediate second call should use cache
    await cacheFetch({
      baseCacheDir: testCacheDir,
      cacheKey: 'test-expiration',
      url: 'https://raw.githubusercontent.com/WordPress/WordPress/master/license.txt',
      cacheExpiration: 100,
      maxRetries: 1,
    });

    const secondMtime = fs.statSync(cachePath).mtimeMs;
    expect(secondMtime).toBe(firstMtime); // Cache was used

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 150));

    // Third call should re-download after expiration
    await cacheFetch({
      baseCacheDir: testCacheDir,
      cacheKey: 'test-expiration',
      url: 'https://raw.githubusercontent.com/WordPress/WordPress/master/license.txt',
      cacheExpiration: 100,
      maxRetries: 1,
    });

    const thirdMtime = fs.statSync(cachePath).mtimeMs;
    expect(thirdMtime).toBeGreaterThan(firstMtime); // File was re-downloaded
  }, 30000);

  it('should never expire with CACHE_FOREVER', async () => {
    // First download
    await cacheFetch({
      baseCacheDir: testCacheDir,
      cacheKey: 'test-no-expiration',
      url: 'https://raw.githubusercontent.com/WordPress/WordPress/master/license.txt',
      cacheExpiration: CACHE_FOREVER,
      maxRetries: 1,
    });

    const cachePath = path.join(testCacheDir, 'test-no-expiration', 'download');
    const firstMtime = fs.statSync(cachePath).mtimeMs;

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 100));

    // Second call should still use cache
    await cacheFetch({
      baseCacheDir: testCacheDir,
      cacheKey: 'test-no-expiration',
      url: 'https://raw.githubusercontent.com/WordPress/WordPress/master/license.txt',
      cacheExpiration: CACHE_FOREVER,
      maxRetries: 1,
    });

    const secondMtime = fs.statSync(cachePath).mtimeMs;
    expect(secondMtime).toBe(firstMtime); // Cache was used
  }, 30000);

  it('should always re-download with CACHE_DISABLED', async () => {
    // First download
    await cacheFetch({
      baseCacheDir: testCacheDir,
      cacheKey: 'test-always-download',
      url: 'https://raw.githubusercontent.com/WordPress/WordPress/master/license.txt',
      maxRetries: 1,
    });

    const cachePath = path.join(testCacheDir, 'test-always-download', 'download');
    const firstMtime = fs.statSync(cachePath).mtimeMs;

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 100));

    // Second call with CACHE_DISABLED should always re-download
    await cacheFetch({
      baseCacheDir: testCacheDir,
      cacheKey: 'test-always-download',
      url: 'https://raw.githubusercontent.com/WordPress/WordPress/master/license.txt',
      cacheExpiration: CACHE_DISABLED,
      maxRetries: 1,
    });

    const secondMtime = fs.statSync(cachePath).mtimeMs;
    expect(secondMtime).toBeGreaterThan(firstMtime); // File was re-downloaded
  }, 30000);
});

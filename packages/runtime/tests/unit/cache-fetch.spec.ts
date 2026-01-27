import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { cacheFetch, CACHE_DISABLED, CACHE_FOREVER } from '../../src/cache-fetch.js';

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

  it('should detect and replace corrupted zip files', async () => {
    // Create a corrupted zip file in the cache
    const cacheDir = path.join(testCacheDir, 'test-corrupted-zip');
    fs.mkdirSync(cacheDir, { recursive: true });
    const cachePath = path.join(cacheDir, 'download');
    fs.writeFileSync(cachePath, 'This is not a valid zip file');

    // Verify the corrupted file exists
    expect(fs.existsSync(cachePath)).toBe(true);
    const corruptedSize = fs.statSync(cachePath).size;
    expect(corruptedSize).toBeLessThan(100); // Small corrupted file

    // Try to fetch a real zip file - should detect corruption and re-download
    // Using a smaller test zip file to speed up the test
    const result = await cacheFetch({
      baseCacheDir: testCacheDir,
      cacheKey: 'test-corrupted-zip',
      url: 'https://github.com/WordPress/wordpress-develop/archive/refs/tags/5.0.0.zip',
      maxRetries: 1,
    });

    // Verify the file was replaced with a valid zip
    expect(fs.existsSync(result)).toBe(true);
    const validSize = fs.statSync(result).size;
    expect(validSize).toBeGreaterThan(100000); // Real WordPress zip is much larger than corrupted file

    // Verify it's a valid zip by checking for EOCD signature
    const fd = fs.openSync(result, 'r');
    try {
      const stats = fs.fstatSync(fd);
      const fileSize = stats.size;
      const searchSize = Math.min(fileSize, 65535 + 22);
      const buffer = Buffer.alloc(searchSize);
      fs.readSync(fd, buffer, 0, searchSize, fileSize - searchSize);

      let found = false;
      for (let i = searchSize - 22; i >= 0; i--) {
        if (buffer[i] === 0x50 && buffer[i + 1] === 0x4b && buffer[i + 2] === 0x05 && buffer[i + 3] === 0x06) {
          found = true;
          break;
        }
      }
      expect(found).toBe(true); // Should find valid EOCD signature
    } finally {
      fs.closeSync(fd);
    }
  }, 90000);
});

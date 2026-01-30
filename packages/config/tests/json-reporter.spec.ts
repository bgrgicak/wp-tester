import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveConfig } from '../src';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import * as os from 'os';
import type { WPTesterConfig } from '../src/types';

describe('JSON Reporter Config Resolution', () => {
  let testDir: string;
  let configDir: string;
  let configFile: string;

  const baseConfig: WPTesterConfig = {
    environments: [{ blueprint: {} }],
    tests: { wp: true },
  };

  beforeEach(async () => {
    testDir = os.tmpdir();
    configDir = join(testDir, `wp-tester-json-reporter-${Date.now()}`);
    await mkdir(configDir, { recursive: true });
    configFile = join(configDir, 'wp-tester.json');
  });

  afterEach(async () => {
    await rm(configDir, { recursive: true, force: true });
  });

  it('should not have json reporter when not configured', async () => {
    await writeFile(configFile, JSON.stringify(baseConfig, null, 2));

    const resolved = await resolveConfig(configFile);

    expect(resolved.reporters.json).toBeUndefined();
  });

  it('should resolve json reporter with default outputFile', async () => {
    const config: WPTesterConfig = {
      ...baseConfig,
      reporters: { json: {} },
    };
    await writeFile(configFile, JSON.stringify(config, null, 2));

    const resolved = await resolveConfig(configFile);

    expect(resolved.reporters.json).toBeDefined();
    expect(resolved.reporters.json?.outputFile).toBe(
      join(configDir, 'wp-tester-results.json')
    );
  });

  it('should resolve json reporter with custom relative outputFile', async () => {
    const config: WPTesterConfig = {
      ...baseConfig,
      reporters: { json: { outputFile: 'output/results.json' } },
    };
    await writeFile(configFile, JSON.stringify(config, null, 2));

    const resolved = await resolveConfig(configFile);

    expect(resolved.reporters.json).toBeDefined();
    expect(resolved.reporters.json?.outputFile).toBe(
      join(configDir, 'output/results.json')
    );
  });

  it('should resolve json reporter with absolute outputFile', async () => {
    const absolutePath = '/tmp/custom-results.json';
    const config: WPTesterConfig = {
      ...baseConfig,
      reporters: { json: { outputFile: absolutePath } },
    };
    await writeFile(configFile, JSON.stringify(config, null, 2));

    const resolved = await resolveConfig(configFile);

    expect(resolved.reporters.json).toBeDefined();
    expect(resolved.reporters.json?.outputFile).toBe(absolutePath);
  });

  it('should resolve json reporter alongside default reporter', async () => {
    const config: WPTesterConfig = {
      ...baseConfig,
      reporters: {
        default: { failed: true },
        json: { outputFile: 'results.json' },
      },
    };
    await writeFile(configFile, JSON.stringify(config, null, 2));

    const resolved = await resolveConfig(configFile);

    expect(resolved.reporters.default).toBeDefined();
    expect(resolved.reporters.json).toBeDefined();
    expect(resolved.reporters.json?.outputFile).toBe(
      join(configDir, 'results.json')
    );
  });
});

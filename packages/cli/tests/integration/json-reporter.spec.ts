import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { executeTests } from '../../src/commands/test/runner';
import { mkdir, writeFile, rm, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import * as os from 'os';
import type { WPTesterConfig } from '@wp-tester/config';

describe('JSON Reporter Integration', { timeout: 120000 }, () => {
  let testDir: string;
  let configFile: string;
  let jsonOutputFile: string;

  beforeEach(async () => {
    testDir = join(os.tmpdir(), `wp-tester-json-reporter-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    configFile = join(testDir, 'wp-tester.json');
    jsonOutputFile = join(testDir, 'wp-tester-results.json');
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should write JSON report file with default outputFile path using empty object', async () => {
    const config: WPTesterConfig = {
      environments: [{ blueprint: { landingPage: '/' } }],
      tests: { wp: true },
      reporters: { json: {} },
    };
    await writeFile(configFile, JSON.stringify(config, null, 2));

    await executeTests(configFile);

    // Verify JSON file was created
    expect(existsSync(jsonOutputFile)).toBe(true);

    // Verify JSON file contains valid CTRF format
    const content = await readFile(jsonOutputFile, 'utf-8');
    const report = JSON.parse(content);

    expect(report).toHaveProperty('reportFormat', 'CTRF');
    expect(report).toHaveProperty('results');
    expect(report.results).toHaveProperty('summary');
    expect(report.results).toHaveProperty('tests');
    expect(report.results.summary).toHaveProperty('tests');
    expect(report.results.summary).toHaveProperty('passed');
    expect(report.results.summary).toHaveProperty('failed');
  });

  it('should write JSON report file with default outputFile path using true shorthand', async () => {
    const config: WPTesterConfig = {
      environments: [{ blueprint: { landingPage: '/' } }],
      tests: { wp: true },
      reporters: { json: true },
    };
    await writeFile(configFile, JSON.stringify(config, null, 2));

    await executeTests(configFile);

    // Verify JSON file was created
    expect(existsSync(jsonOutputFile)).toBe(true);

    // Verify JSON file contains valid CTRF format
    const content = await readFile(jsonOutputFile, 'utf-8');
    const report = JSON.parse(content);

    expect(report).toHaveProperty('reportFormat', 'CTRF');
    expect(report).toHaveProperty('results');
    expect(report.results).toHaveProperty('summary');
    expect(report.results).toHaveProperty('tests');
    expect(report.results.summary).toHaveProperty('tests');
    expect(report.results.summary).toHaveProperty('passed');
    expect(report.results.summary).toHaveProperty('failed');
  });

  it('should write JSON report file to custom outputFile path', async () => {
    const customOutputFile = join(testDir, 'custom-output.json');
    const config: WPTesterConfig = {
      environments: [{ blueprint: { landingPage: '/' } }],
      tests: { wp: true },
      reporters: { json: { outputFile: 'custom-output.json' } },
    };
    await writeFile(configFile, JSON.stringify(config, null, 2));

    await executeTests(configFile);

    // Verify custom JSON file was created (not the default)
    expect(existsSync(customOutputFile)).toBe(true);
    expect(existsSync(jsonOutputFile)).toBe(false);

    // Verify JSON file contains valid CTRF format
    const content = await readFile(customOutputFile, 'utf-8');
    const report = JSON.parse(content);

    expect(report).toHaveProperty('reportFormat', 'CTRF');
  });

  it('should not write JSON report file when json reporter is not configured', async () => {
    const config: WPTesterConfig = {
      environments: [{ blueprint: { landingPage: '/' } }],
      tests: { wp: true },
    };
    await writeFile(configFile, JSON.stringify(config, null, 2));

    await executeTests(configFile);

    // Verify JSON file was NOT created
    expect(existsSync(jsonOutputFile)).toBe(false);
  });

  it('should always include all tests in JSON output regardless of filter settings', async () => {
    const config: WPTesterConfig = {
      environments: [{ blueprint: { landingPage: '/' } }],
      tests: { wp: true },
      reporters: { json: {} },
    };
    await writeFile(configFile, JSON.stringify(config, null, 2));

    await executeTests(configFile);

    const content = await readFile(jsonOutputFile, 'utf-8');
    const report = JSON.parse(content);

    // Total tests in output should match summary count
    expect(report.results.tests.length).toBe(report.results.summary.tests);
  });
});

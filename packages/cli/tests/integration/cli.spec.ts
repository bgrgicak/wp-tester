import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { join } from 'path';

const cliPath = join(__dirname, '../../src/cli/cli.ts');
const cliCommand = `npx tsx ${cliPath}`;

describe('CLI Integration Tests', { timeout: 30000 }, () => {
  it('should show help', () => {
    const output = execSync(`${cliCommand} --help`, { encoding: 'utf-8' });
    expect(output).toContain('wp-tester <command> [options]');
    expect(output).toContain('Commands:');
    expect(output).toContain('setup');
    expect(output).toContain('config');
    expect(output).toContain('test');
  });

  it('should show version', () => {
    const output = execSync(`${cliCommand} --version`, { encoding: 'utf-8' });
    expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should show config help', () => {
    const output = execSync(`${cliCommand} config --help`, { encoding: 'utf-8' });
    expect(output).toContain('Manage wp-tester configuration');
  });

  it('should validate config successfully', () => {
    const fixtureConfig = join(__dirname, '../fixtures/wp-tester.json');
    const output = execSync(`${cliCommand} config validate -c ${fixtureConfig}`, {
      encoding: 'utf-8',
      cwd: join(__dirname, '../../../..'),
    });
    expect(output).toContain('Configuration is valid');
  });

  it('should show configuration summary after validation', () => {
    const fixtureConfig = join(__dirname, '../fixtures/wp-tester.json');
    const output = execSync(`${cliCommand} config validate -c ${fixtureConfig}`, {
      encoding: 'utf-8',
      cwd: join(__dirname, '../../../..'),
    });
    expect(output).toContain('Configuration Summary');
    expect(output).toContain('Environments:');
    expect(output).toContain('Test suites:');
    expect(output).toContain('Total runs:');
  });
});

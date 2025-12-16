import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { join } from 'path';

const cliPath = join(__dirname, '../../dist/cli/cli.js');

describe('CLI Integration Tests', () => {
  it('should show help', () => {
    const output = execSync(`node ${cliPath} --help`, { encoding: 'utf-8' });
    expect(output).toContain('wp-tester <command> [options]');
    expect(output).toContain('Commands:');
    expect(output).toContain('setup');
    expect(output).toContain('config');
    expect(output).toContain('test');
  });

  it('should show version', () => {
    const output = execSync(`node ${cliPath} --version`, { encoding: 'utf-8' });
    expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should show config help', () => {
    const output = execSync(`node ${cliPath} config --help`, { encoding: 'utf-8' });
    expect(output).toContain('Manage wp-tester configuration');
  });

  it('should validate config successfully', () => {
    const fixtureConfig = join(__dirname, '../fixtures/wp-tester.json');
    const output = execSync(`node ${cliPath} config validate -c ${fixtureConfig}`, {
      encoding: 'utf-8',
      cwd: join(__dirname, '../../../..'),
    });
    expect(output).toContain('Configuration is valid');
  });
});

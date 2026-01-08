import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  getResultsDir,
  getLatestResultsPath,
  getSnapshotPath,
  writeJsonReport,
  readJsonReport,
  saveLatestResults,
  saveSnapshot,
  loadSnapshot,
  WP_TESTER_DIR,
  RESULTS_SUBDIR,
  type TestSignature,
} from './reporters.js';
import { compareToSnapshot } from './snapshot.js';
import type { Report } from 'ctrf';

function createTestReport(): Report {
  return {
    results: {
      summary: {
        tests: 2,
        passed: 2,
        failed: 0,
        skipped: 0,
        pending: 0,
        other: 0,
        start: 1000,
        stop: 2000,
      },
      tool: { name: 'test-tool' },
      tests: [
        { name: 'test1', status: 'passed', duration: 100 },
        { name: 'test2', status: 'passed', duration: 200 },
      ],
    },
    reportFormat: 'CTRF',
    specVersion: '0.0.4',
  };
}

describe('Test Signature Isolation', () => {
  describe('getResultsDir', () => {
    it('should return different directories for different projects', () => {
      const dir1 = getResultsDir('/project/a');
      const dir2 = getResultsDir('/project/b');

      expect(dir1).not.toBe(dir2);
    });

    it('should return different directories for different test types', () => {
      const dir1 = getResultsDir('/project/a', { testType: 'wp' });
      const dir2 = getResultsDir('/project/a', { testType: 'phpunit' });

      expect(dir1).not.toBe(dir2);
    });

    it('should return different directories for different args', () => {
      const dir1 = getResultsDir('/project/a', { args: ['--filter=Foo'] });
      const dir2 = getResultsDir('/project/a', { args: ['--filter=Bar'] });

      expect(dir1).not.toBe(dir2);
    });

    it('should return same directory for same signature', () => {
      const signature: TestSignature = { testType: 'phpunit', args: ['--filter=Foo'] };
      const dir1 = getResultsDir('/project/a', signature);
      const dir2 = getResultsDir('/project/a', signature);

      expect(dir1).toBe(dir2);
    });

    it('should return same directory regardless of args order', () => {
      const dir1 = getResultsDir('/project/a', { args: ['--filter=Foo', '--group=bar'] });
      const dir2 = getResultsDir('/project/a', { args: ['--group=bar', '--filter=Foo'] });

      expect(dir1).toBe(dir2);
    });

    it('should use "all" for empty test type', () => {
      const dirNoType = getResultsDir('/project/a', {});
      const dirExplicitUndefined = getResultsDir('/project/a', { testType: undefined });

      expect(dirNoType).toBe(dirExplicitUndefined);
    });

    it('should store in home directory under .wp-tester/results', () => {
      const dir = getResultsDir('/project/a');

      expect(dir).toContain(os.homedir());
      expect(dir).toContain(WP_TESTER_DIR);
      expect(dir).toContain(RESULTS_SUBDIR);
    });
  });

  describe('getLatestResultsPath and getSnapshotPath', () => {
    it('should return paths in the same results directory', () => {
      const signature = { testType: 'wp' };
      const latestPath = getLatestResultsPath('/project/a', signature);
      const snapshotPath = getSnapshotPath('/project/a', signature);

      expect(path.dirname(latestPath)).toBe(path.dirname(snapshotPath));
    });

    it('should have different filenames for latest and snapshot', () => {
      const signature = { testType: 'wp' };
      const latestPath = getLatestResultsPath('/project/a', signature);
      const snapshotPath = getSnapshotPath('/project/a', signature);

      expect(path.basename(latestPath)).toBe('latest.json');
      expect(path.basename(snapshotPath)).toBe('snapshot.json');
    });
  });
});

describe('JSON Report File Operations', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-tester-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('writeJsonReport and readJsonReport', () => {
    it('should write and read a report correctly', () => {
      const report = createTestReport();
      const filePath = path.join(tempDir, 'report.json');

      writeJsonReport(report, filePath);
      const readBack = readJsonReport(filePath);

      expect(readBack).toEqual(report);
    });

    it('should create nested directories if needed', () => {
      const report = createTestReport();
      const filePath = path.join(tempDir, 'nested', 'deep', 'report.json');

      writeJsonReport(report, filePath);

      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should return null for non-existent file', () => {
      const filePath = path.join(tempDir, 'nonexistent.json');

      const result = readJsonReport(filePath);

      expect(result).toBeNull();
    });

    it('should write formatted JSON', () => {
      const report = createTestReport();
      const filePath = path.join(tempDir, 'report.json');

      writeJsonReport(report, filePath);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Check it's formatted with indentation
      expect(content).toContain('\n');
      expect(content).toContain('  ');
    });
  });
});

describe('Snapshot and Latest Results Storage', () => {
  let testProjectRoot: string;
  let originalHome: string;
  let tempHome: string;

  beforeEach(() => {
    // Create a fake home directory for tests
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-tester-home-'));
    originalHome = process.env.HOME || '';

    // Mock os.homedir by using a unique project path
    testProjectRoot = path.join(tempHome, 'test-project-' + Date.now());
    fs.mkdirSync(testProjectRoot, { recursive: true });
  });

  afterEach(() => {
    // Clean up
    fs.rmSync(tempHome, { recursive: true, force: true });
    process.env.HOME = originalHome;
  });

  describe('saveLatestResults', () => {
    it('should save report to the correct location', () => {
      const report = createTestReport();

      saveLatestResults(report, testProjectRoot);

      const expectedPath = getLatestResultsPath(testProjectRoot);
      expect(fs.existsSync(expectedPath)).toBe(true);

      const saved = readJsonReport(expectedPath);
      expect(saved).toEqual(report);
    });

    it('should isolate results by test signature', () => {
      const report1 = createTestReport();
      report1.results.tests[0].name = 'signature1-test';

      const report2 = createTestReport();
      report2.results.tests[0].name = 'signature2-test';

      saveLatestResults(report1, testProjectRoot, { testType: 'wp' });
      saveLatestResults(report2, testProjectRoot, { testType: 'phpunit' });

      const path1 = getLatestResultsPath(testProjectRoot, { testType: 'wp' });
      const path2 = getLatestResultsPath(testProjectRoot, { testType: 'phpunit' });

      const saved1 = readJsonReport(path1);
      const saved2 = readJsonReport(path2);

      expect(saved1?.results.tests[0].name).toBe('signature1-test');
      expect(saved2?.results.tests[0].name).toBe('signature2-test');
    });
  });

  describe('saveSnapshot and loadSnapshot', () => {
    it('should save and load snapshot correctly', () => {
      const report = createTestReport();

      saveSnapshot(report, testProjectRoot);
      const loaded = loadSnapshot(testProjectRoot);

      expect(loaded).toEqual(report);
    });

    it('should return null when no snapshot exists', () => {
      const loaded = loadSnapshot(testProjectRoot);

      expect(loaded).toBeNull();
    });

    it('should isolate snapshots by test signature', () => {
      const report1 = createTestReport();
      report1.results.tests[0].name = 'wp-snapshot-test';

      const report2 = createTestReport();
      report2.results.tests[0].name = 'phpunit-snapshot-test';

      saveSnapshot(report1, testProjectRoot, { testType: 'wp' });
      saveSnapshot(report2, testProjectRoot, { testType: 'phpunit' });

      const loaded1 = loadSnapshot(testProjectRoot, { testType: 'wp' });
      const loaded2 = loadSnapshot(testProjectRoot, { testType: 'phpunit' });

      expect(loaded1?.results.tests[0].name).toBe('wp-snapshot-test');
      expect(loaded2?.results.tests[0].name).toBe('phpunit-snapshot-test');
    });

    it('should not find snapshot for different signature', () => {
      const report = createTestReport();

      saveSnapshot(report, testProjectRoot, { testType: 'wp' });

      // Should not find snapshot with different signature
      const loaded = loadSnapshot(testProjectRoot, { testType: 'phpunit' });

      expect(loaded).toBeNull();
    });
  });

  describe('latest and snapshot are independent', () => {
    it('should store latest and snapshot separately', () => {
      const latestReport = createTestReport();
      latestReport.results.tests[0].name = 'latest-test';

      const snapshotReport = createTestReport();
      snapshotReport.results.tests[0].name = 'snapshot-test';

      saveLatestResults(latestReport, testProjectRoot);
      saveSnapshot(snapshotReport, testProjectRoot);

      const latest = readJsonReport(getLatestResultsPath(testProjectRoot));
      const snapshot = loadSnapshot(testProjectRoot);

      expect(latest?.results.tests[0].name).toBe('latest-test');
      expect(snapshot?.results.tests[0].name).toBe('snapshot-test');
    });
  });
});

describe('Integration: Regression Testing Workflow', () => {
  let testProjectRoot: string;
  let tempHome: string;

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-tester-integration-'));
    testProjectRoot = path.join(tempHome, 'test-project-' + Date.now());
    fs.mkdirSync(testProjectRoot, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it('should detect no snapshot on first run', () => {
    const snapshot = loadSnapshot(testProjectRoot);

    expect(snapshot).toBeNull();
  });

  it('should capture snapshot on first run and compare on second run', () => {
    // First run: capture snapshot with all tests passing
    const firstRunReport = createTestReport();
    saveSnapshot(firstRunReport, testProjectRoot);

    const snapshotAfterFirstRun = loadSnapshot(testProjectRoot);
    expect(snapshotAfterFirstRun).not.toBeNull();

    // Second run: same results -> no regressions
    const secondRunReport = createTestReport();
    const comparison = compareToSnapshot(secondRunReport, snapshotAfterFirstRun!);

    expect(comparison.regressions).toHaveLength(0);
    expect(comparison.improvements).toHaveLength(0);
    expect(comparison.passed).toBe(true);
  });

  it('should detect regression when test starts failing', () => {
    // First run: all tests pass
    const snapshotReport = createTestReport();
    saveSnapshot(snapshotReport, testProjectRoot);

    // Second run: introduce a failure (simulating code change)
    const currentReport = createTestReport();
    currentReport.results.tests[0].status = 'failed';
    currentReport.results.tests[0].message = 'Assertion failed: expected 1, got 2';
    currentReport.results.summary.passed = 1;
    currentReport.results.summary.failed = 1;

    const snapshot = loadSnapshot(testProjectRoot);
    const comparison = compareToSnapshot(currentReport, snapshot!);

    expect(comparison.regressions).toHaveLength(1);
    expect(comparison.regressions[0].test.name).toBe('test1');
    expect(comparison.passed).toBe(false);
  });

  it('should detect improvement when failing test gets fixed', () => {
    // First run: one test failing
    const snapshotReport = createTestReport();
    snapshotReport.results.tests[1].status = 'failed';
    snapshotReport.results.tests[1].message = 'Known bug #123';
    snapshotReport.results.summary.passed = 1;
    snapshotReport.results.summary.failed = 1;
    saveSnapshot(snapshotReport, testProjectRoot);

    // Second run: test is fixed
    const currentReport = createTestReport();

    const snapshot = loadSnapshot(testProjectRoot);
    const comparison = compareToSnapshot(currentReport, snapshot!);

    expect(comparison.improvements).toHaveLength(1);
    expect(comparison.improvements[0].test.name).toBe('test2');
    expect(comparison.improvements[0].type).toBe('fixed');
    expect(comparison.passed).toBe(true);
  });

  it('should handle clear and recapture workflow', () => {
    // First snapshot: 2 tests passing
    const originalSnapshot = createTestReport();
    saveSnapshot(originalSnapshot, testProjectRoot);

    // Run with --clear: capture new snapshot with 3 tests
    const newSnapshot = createTestReport();
    newSnapshot.results.tests.push({ name: 'test3', status: 'passed', duration: 300 });
    newSnapshot.results.summary.tests = 3;
    newSnapshot.results.summary.passed = 3;
    saveSnapshot(newSnapshot, testProjectRoot);

    // Verify new snapshot is in place
    const loadedSnapshot = loadSnapshot(testProjectRoot);
    expect(loadedSnapshot?.results.tests).toHaveLength(3);
    expect(loadedSnapshot?.results.tests[2].name).toBe('test3');
  });

  it('should isolate regression testing by test command', () => {
    // Run 'wp-tester test -t wp' and capture snapshot
    const wpSnapshot = createTestReport();
    wpSnapshot.results.tests[0].name = 'wp-test1';
    saveSnapshot(wpSnapshot, testProjectRoot, { testType: 'wp' });

    // Run 'wp-tester test -t phpunit' and capture snapshot
    const phpunitSnapshot = createTestReport();
    phpunitSnapshot.results.tests[0].name = 'phpunit-test1';
    saveSnapshot(phpunitSnapshot, testProjectRoot, { testType: 'phpunit' });

    // Verify snapshots are isolated
    const wpLoaded = loadSnapshot(testProjectRoot, { testType: 'wp' });
    const phpunitLoaded = loadSnapshot(testProjectRoot, { testType: 'phpunit' });

    expect(wpLoaded?.results.tests[0].name).toBe('wp-test1');
    expect(phpunitLoaded?.results.tests[0].name).toBe('phpunit-test1');

    // Regression in one doesn't affect the other
    const currentWp = createTestReport();
    currentWp.results.tests[0].name = 'wp-test1';
    currentWp.results.tests[0].status = 'failed';

    const currentPhpunit = createTestReport();
    currentPhpunit.results.tests[0].name = 'phpunit-test1';

    const wpComparison = compareToSnapshot(currentWp, wpLoaded!);
    const phpunitComparison = compareToSnapshot(currentPhpunit, phpunitLoaded!);

    expect(wpComparison.passed).toBe(false);
    expect(phpunitComparison.passed).toBe(true);
  });

  it('should isolate by PHPUnit filter args', () => {
    // Run 'wp-tester test -- --filter=UnitTests'
    const unitSnapshot = createTestReport();
    unitSnapshot.results.tests[0].name = 'UnitTest::testAdd';
    saveSnapshot(unitSnapshot, testProjectRoot, { testType: 'phpunit', args: ['--filter=UnitTests'] });

    // Run 'wp-tester test -- --filter=IntegrationTests'
    const integrationSnapshot = createTestReport();
    integrationSnapshot.results.tests[0].name = 'IntegrationTest::testDb';
    saveSnapshot(integrationSnapshot, testProjectRoot, { testType: 'phpunit', args: ['--filter=IntegrationTests'] });

    // Verify snapshots are isolated
    const unitLoaded = loadSnapshot(testProjectRoot, { testType: 'phpunit', args: ['--filter=UnitTests'] });
    const integrationLoaded = loadSnapshot(testProjectRoot, { testType: 'phpunit', args: ['--filter=IntegrationTests'] });

    expect(unitLoaded?.results.tests[0].name).toBe('UnitTest::testAdd');
    expect(integrationLoaded?.results.tests[0].name).toBe('IntegrationTest::testDb');
  });

  it('should handle test additions without regression', () => {
    // Snapshot: 2 tests passing
    const snapshotReport = createTestReport();
    saveSnapshot(snapshotReport, testProjectRoot);

    // Current: 3 tests passing (new test added)
    const currentReport = createTestReport();
    currentReport.results.tests.push({ name: 'test3', status: 'passed', duration: 150 });
    currentReport.results.summary.tests = 3;
    currentReport.results.summary.passed = 3;

    const snapshot = loadSnapshot(testProjectRoot);
    const comparison = compareToSnapshot(currentReport, snapshot!);

    expect(comparison.regressions).toHaveLength(0);
    expect(comparison.passed).toBe(true);
  });

  it('should detect regression when new test is added and fails', () => {
    // Snapshot: 2 tests passing
    const snapshotReport = createTestReport();
    saveSnapshot(snapshotReport, testProjectRoot);

    // Current: 3 tests, new one fails
    const currentReport = createTestReport();
    currentReport.results.tests.push({
      name: 'test3',
      status: 'failed',
      duration: 150,
      message: 'New test that fails',
    });
    currentReport.results.summary.tests = 3;
    currentReport.results.summary.passed = 2;
    currentReport.results.summary.failed = 1;

    const snapshot = loadSnapshot(testProjectRoot);
    const comparison = compareToSnapshot(currentReport, snapshot!);

    expect(comparison.regressions).toHaveLength(1);
    expect(comparison.regressions[0].test.name).toBe('test3');
    expect(comparison.passed).toBe(false);
  });
});

#!/usr/bin/env node
import { execSync, spawnSync } from 'child_process';
import { mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const rootDir = resolve(__dirname, '..');

/**
 * Discover all packages in the monorepo
 * @returns {Array<{name: string, path: string, packageJson: object}>}
 */
function discoverPackages() {
  const packagesDir = join(rootDir, 'packages');
  const packageDirs = readdirSync(packagesDir);

  return packageDirs
    .map((dir) => {
      const packagePath = join(packagesDir, dir);
      const packageJsonPath = join(packagePath, 'package.json');

      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        return {
          name: packageJson.name,
          path: packagePath,
          packageJson,
        };
      } catch (err) {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Pack a package and return the tarball path
 * @param {string} packagePath - Path to package directory
 * @returns {string} - Path to created tarball
 */
function packPackage(packagePath, packageName) {
  try {
    const output = execSync('npm pack --silent', {
      cwd: packagePath,
      encoding: 'utf-8',
    }).trim();

    // npm pack outputs the filename of the created tarball
    const tarballPath = join(packagePath, output);
    return tarballPath;
  } catch (err) {
    throw new Error(`Failed to pack ${packageName}: ${err.message}`);
  }
}

/**
 * Install package from tarball in a temp directory
 * @param {string} tarballPath - Path to package tarball
 * @param {string} packageName - Package name for error messages
 * @returns {string} - Path to temp directory
 */
function installPackage(tarballPath, packageName) {
  const tempDir = mkdtempSync(join(tmpdir(), 'wp-tester-pkg-test-'));

  try {
    execSync(`npm install --production --silent ${tarballPath}`, {
      cwd: tempDir,
      stdio: 'pipe',
    });

    return tempDir;
  } catch (err) {
    rmSync(tempDir, { recursive: true, force: true });
    throw new Error(`Failed to install ${packageName}: ${err.message}`);
  }
}

/**
 * Try to import the main export of the package
 * @param {string} tempDir - Temp directory where package is installed
 * @param {string} packageName - Package name
 * @param {object} packageJson - Original package.json with exports info
 */
function testImport(tempDir, packageName, packageJson) {
  // Get the main entry point from package.json
  let entryPoint = packageJson.main || './dist/index.js';

  if (packageJson.exports && packageJson.exports['.']) {
    const exportConfig = packageJson.exports['.'];
    entryPoint = exportConfig.default || exportConfig.require || exportConfig.import || entryPoint;
  }

  const packagePath = join(tempDir, 'node_modules', packageName, entryPoint);

  // Create a simple test script that tries to import the package
  // Run it in a separate process to avoid process.exit() affecting us
  const testScript = `
    import('${packagePath}')
      .then(() => process.exit(0))
      .catch((err) => {
        console.error(err.message);
        process.exit(1);
      });
  `;

  const testScriptPath = join(tempDir, 'test-import.mjs');
  writeFileSync(testScriptPath, testScript);

  // Run the test script in a separate Node process
  const result = spawnSync('node', [testScriptPath], {
    encoding: 'utf-8',
    stdio: 'pipe',
  });

  if (result.status !== 0) {
    const errorMsg = result.stderr || result.stdout || 'Unknown error';

    // Check if this is a CLI that's working correctly but requires arguments
    if (errorMsg.includes('You must provide a command') || errorMsg.includes('--help')) {
      // CLI loaded and ran successfully, just needs arguments
      return;
    }

    throw new Error(`Failed to import ${packageName}: ${errorMsg.trim()}`);
  }
}

/**
 * Test a single package
 * @param {object} pkg - Package info
 * @returns {Promise<{success: boolean, error?: Error}>}
 */
async function testPackage(pkg) {
  let tempDir = null;
  let tarballPath = null;

  try {
    // Pack the package
    tarballPath = packPackage(pkg.path, pkg.name);

    // Install in temp directory
    tempDir = installPackage(tarballPath, pkg.name);

    // Try to import it
    testImport(tempDir, pkg.name, pkg.packageJson);

    return { success: true };
  } catch (err) {
    return { success: false, error: err };
  } finally {
    // Cleanup
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    if (tarballPath) {
      rmSync(tarballPath, { force: true });
    }
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log('\nTesting package installations...\n');

  // Discover packages
  const packages = discoverPackages();
  const publicPackages = packages.filter((pkg) => !pkg.packageJson.private);

  if (publicPackages.length === 0) {
    console.log('No public packages found to test.');
    return;
  }

  const results = [];

  // Test each package
  for (const pkg of publicPackages) {
    const result = await testPackage(pkg);
    results.push({ pkg, ...result });

    if (result.success) {
      console.log(`✓ ${pkg.name.padEnd(25)} - installed and imported successfully`);
    } else {
      console.log(`✗ ${pkg.name.padEnd(25)} - failed to import`);
      console.log(`  ${result.error.message}\n`);
    }
  }

  // Summary
  const failures = results.filter((r) => !r.success);

  console.log();

  if (failures.length === 0) {
    console.log('✓ All packages installed successfully!\n');
    process.exit(0);
  } else {
    console.log(`✗ Package installation test failed for ${failures.length} package(s)\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});

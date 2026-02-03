import { readFile, writeFile } from 'fs/promises';
import { optionNames, type OptionName, normalizeConfigPath } from '@wp-tester/config';
import { updateConfigOption } from './option';
import * as clack from '../../cli/theme';
import { validateConfig, generateConfigSummary, printConfigSummary } from './validate';
import { migrateConfig } from './migrate';
import pc from 'picocolors';

interface ConfigArgs {
  action: string;
  config?: string;
}

export const configHandler = async (argv: ConfigArgs): Promise<void> => {
  const { action, config = './wp-tester.json' } = argv;

  if (action === "validate") {
    const result = await validateConfig(config);
    if (!result.config) {
      process.exit(1);
    }
    console.log(pc.green(pc.bold("✓ Configuration is valid")));

    // Display configuration summary
    const summary = generateConfigSummary(result.config);
    printConfigSummary(summary);

    // Show migrate hint if there are deprecation warnings
    if (result.hasDeprecationWarnings) {
      clack.log.info(pc.dim(`Run ${pc.cyan('wp-tester config migrate')} to automatically update your configuration.`));
    }
  } else if (action === "migrate") {
    await runMigrate(config);
  } else if (action && optionNames.includes(action as OptionName)) {
    await updateConfigOption(action as OptionName, config);
  } else {
    clack.outro(`Error: Unknown action "${action}".`);
    process.exit(1);
  }
};

/**
 * Run the config migration command
 */
async function runMigrate(configPath: string): Promise<void> {
  try {
    const resolvedConfigPath = normalizeConfigPath(configPath);
    const configContent = await readFile(resolvedConfigPath, 'utf-8');
    const config = JSON.parse(configContent);

    const result = migrateConfig(config);

    if (!result.migrated) {
      console.log(pc.green(pc.bold("✓ No deprecated properties found. Configuration is up to date.")));
      return;
    }

    // Show changes that will be made
    clack.log.info(pc.bold('Migration changes:'));
    for (const change of result.changes) {
      clack.log.info(pc.cyan(`  • ${change}`));
    }

    // Write the updated config
    const updatedContent = JSON.stringify(result.config, null, 2) + '\n';
    await writeFile(resolvedConfigPath, updatedContent, 'utf-8');

    console.log('');
    console.log(pc.green(pc.bold("✓ Configuration migrated successfully.")));
    clack.log.info(pc.dim(`Updated: ${resolvedConfigPath}`));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    clack.log.error("Migration error:");
    clack.log.error(message);
    process.exit(1);
  }
}

export default configHandler;

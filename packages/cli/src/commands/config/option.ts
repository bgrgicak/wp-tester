import { readConfigFile, writeConfigFile, optionMap, type OptionName, configPath } from '@wp-tester/config';
import * as clack from '../../cli/theme';

export async function updateConfigOption(optionName: OptionName, configFilePathArg?: string): Promise<void> {
  try {
    const configFilePath = configFilePathArg || configPath();
    const config = await readConfigFile(configFilePath);

    const option = optionMap[optionName];
    const context = option.getContext?.(configFilePath);
    const updatedConfig = await option.handler(config, context);

    // Only write and show success message if config was actually changed
    const configChanged = JSON.stringify(config) !== JSON.stringify(updatedConfig);
    if (configChanged) {
      await writeConfigFile(updatedConfig, configFilePath);
      clack.outro(`✓ Configuration updated successfully!`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    clack.outro(`Error: Could not update config. ${message}`);
    process.exit(1);
  }
}

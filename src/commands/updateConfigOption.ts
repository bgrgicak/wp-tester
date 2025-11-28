import { readConfigFile, writeConfigFile } from '../config/config.js';
import { optionMap, type OptionName } from '../config/options/index.js';
import * as clack from '../cli/theme.js';

export async function updateConfigOption(optionName: OptionName): Promise<void> {
  try {
    const config = await readConfigFile();
    const option = optionMap[optionName];
    const updatedConfig = await option(config);
    await writeConfigFile(updatedConfig);
    clack.outro(`✓ Configuration updated successfully!`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    clack.outro(`Error: Could not update config. ${message}`);
    process.exit(1);
  }
}

import { setupOptions, writeConfigFile, isConfigWritable, getDefaultConfig, type WPTesterConfig } from '@wp-tester/config';
import * as clack from "../cli/theme";

export const setupHandler = async (): Promise<void> => {
  if (await isConfigWritable()) {
    const overwriteAnswer = await clack.confirm({
      message: "wp-tester.json already exists. Overwrite?",
    });

    if (clack.isCancel(overwriteAnswer) || !overwriteAnswer) {
      clack.cancel("Setup cancelled.");
      process.exit(0);
    }
  }

  let config: Partial<WPTesterConfig> = getDefaultConfig();

  for (const option of setupOptions) {
    config = await option(config);
  }

  try {
    await writeConfigFile(config);
    clack.outro("✓ wp-tester.json created successfully!");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    clack.outro(`Error: Could not write config file. ${message}`);
    process.exit(1);
  }
};

export default setupHandler;

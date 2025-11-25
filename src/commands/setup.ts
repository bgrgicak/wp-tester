import { configOptions } from '../config/options/index.js';
import {  updateConfigOption, writeConfigFile, isConfigWritable } from '../config/config.js';
import type { WPTesterConfig } from '../config/types.js';
import * as clack from '../cli/theme.js';

export const command = 'setup';
export const describe = 'Setup wp-tester configuration';

export const run = async (): Promise<void> => {
  if (await isConfigWritable()) {
    const overwriteAnswer = await clack.confirm({
      message: 'wp-tester.json already exists. Overwrite?'
    });

    if (clack.isCancel(overwriteAnswer) || !overwriteAnswer) {
      clack.cancel('Setup cancelled.');
      process.exit(0);
    }
  }

  let config: Partial<WPTesterConfig> = {};

  for (const option of configOptions) {
    let answer: boolean | string | string[] | symbol;

    switch (option.type) {
      case 'confirm':
        answer = await clack.confirm({
          message: option.prompt,
          initialValue: option.default as boolean
        });
        break;
      case 'text':
        answer = await clack.text({
          message: option.prompt,
          defaultValue: option.default as string
        });
        break;
      case 'select':
        answer = await clack.select({
          message: option.prompt,
          options: (option.choices || []) as any
        });
        break;
      case 'multiselect':
        answer = await clack.multiselect({
          message: option.prompt,
          options: (option.choices || []) as any
        });
        break;
      default:
        continue;
    }

    if (clack.isCancel(answer)) {
      clack.cancel('Setup cancelled.');
      process.exit(0);
    }

    config = updateConfigOption(config, option, answer as boolean | string | string[]);
  }

  try {
    await writeConfigFile(config);
    clack.outro('✓ wp-tester.json created successfully!');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    clack.outro(`Error: Could not write config file. ${message}`);
    process.exit(1);
  }
};

export default run;
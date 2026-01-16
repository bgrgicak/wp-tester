import { optionNames, type OptionName } from '@wp-tester/config';
import { updateConfigOption } from './option';
import * as clack from '../../cli/theme';
import { validateConfig, generateConfigSummary, printConfigSummary } from './validate';
import pc from 'picocolors';

interface ConfigArgs {
  action: string;
  config?: string;
}

export const configHandler = async (argv: ConfigArgs): Promise<void> => {
  const { action, config = './wp-tester.json' } = argv;

  if (action === "validate") {
    const validatedConfig = await validateConfig(config);
    if (!validatedConfig) {
      process.exit(1);
    }
    console.log(pc.green(pc.bold("✓ Configuration is valid")));

    // Display configuration summary
    const summary = generateConfigSummary(validatedConfig);
    printConfigSummary(summary);
  } else if (action && optionNames.includes(action as OptionName)) {
    await updateConfigOption(action as OptionName);
  } else {
    clack.outro(`Error: Unknown action "${action}".`);
    process.exit(1);
  }
};

export default configHandler;

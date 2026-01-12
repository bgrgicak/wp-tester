import { optionNames, type OptionName } from '@wp-tester/config';
import { updateConfigOption } from './option';
import * as clack from '../../cli/theme';
import { validateConfig } from './validate';
import pc from 'picocolors';

interface ConfigArgs {
  action: string;
  config: string;
}

export const configHandler = async (argv: ConfigArgs): Promise<void> => {
  const { action, config } = argv;

  if (action === "validate") {
    const isValid = await validateConfig(config);
    if (!isValid) {
      process.exit(1);
    }
    console.log(pc.green(pc.bold("✓ Configuration is valid")));
  } else if (action && optionNames.includes(action as OptionName)) {
    await updateConfigOption(action as OptionName);
  } else {
    clack.outro(`Error: Unknown action "${action}".`);
    process.exit(1);
  }
};

export default configHandler;

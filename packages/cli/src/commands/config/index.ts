import { optionNames, type OptionName } from '@wp-tester/config';
import { validateConfigCommand } from './validate';
import { updateConfigOption } from './option';
import * as clack from '../../cli/theme';

interface ConfigArgs {
  action: string;
  config: string;
}

export const configHandler = async (argv: ConfigArgs): Promise<void> => {
  const { action, config } = argv;

  if (action === "validate") {
    await validateConfigCommand(config);
  } else if (action && optionNames.includes(action as OptionName)) {
    await updateConfigOption(action as OptionName);
  } else {
    clack.outro(`Error: Unknown action "${action}".`);
    process.exit(1);
  }
};

export default configHandler;

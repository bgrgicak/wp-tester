import { optionNames, type OptionName } from '../config/options/index.js';
import { validateConfig } from './validate.js';
import { updateConfigOption } from './updateConfigOption.js';

interface ConfigArgs {
  action: string;
  config: string;
}

export const configHandler = async (argv: ConfigArgs): Promise<void> => {
  const { action, config } = argv;

  if (action === 'validate') {
    await validateConfig(config);
  } else if (action && optionNames.includes(action as OptionName)) {
    await updateConfigOption(action as OptionName);
  }
};

export default configHandler;

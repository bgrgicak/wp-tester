export type PromptType = 'confirm' | 'text' | 'select' | 'multiselect';

export interface WPTesterConfig {
  run: boolean;
}

export type OptionApply = (
  currentConfig: Partial<WPTesterConfig>,
  userChoice: boolean | string | string[]
) => Partial<WPTesterConfig>;

export interface SelectChoice {
  value: string | number;
  label: string;
  hint?: string;
}

export interface ConfigOption {
  key: string;
  type: PromptType;
  prompt: string;
  default?: boolean | string | number;
  choices?: SelectChoice[];
  apply?: OptionApply;
}

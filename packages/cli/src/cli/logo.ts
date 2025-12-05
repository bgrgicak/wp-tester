import pc from 'picocolors';

// WordPress Blue (rendered as cyan in terminal, closest to #21759B)
const wpBlue = pc.cyan;

export const logo = () => {
  return wpBlue(`
 ██     ██ ██████      ████████ ███████ ███████ ████████ ███████ ██████
 ██     ██ ██   ██        ██    ██      ██         ██    ██      ██   ██
 ██  █  ██ ██████         ██    █████   ███████    ██    █████   ██████
 ██ ███ ██ ██             ██    ██           ██    ██    ██      ██   ██
  ███ ███  ██             ██    ███████ ███████    ██    ███████ ██   ██
`);
};

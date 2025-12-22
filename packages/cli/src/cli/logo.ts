import pc from "picocolors";

function getTerminalClient() {
  const env = process.env;

  // 1. High-Precision Direct Matches
  if (env.VSCODE_GIT_IPC_HANDLE || env.TERM_PROGRAM === "vscode")
    return "vscode";
  if (env.ITERM_SESSION_ID) return "iterm2";
  if (env.WARP_SESSIONS_ID || env.TERM_PROGRAM === "WarpTerminal")
    return "warp";
  if (env.GHOSTTY_RESOURCES_DIR) return "ghostty";
  if (env.KITTY_PID) return "kitty";
  if (env.TERM_PROGRAM === "Hyper") return "hyper";
  if (env.ALACRITTY_LOG || env.ALACRITTY_WINDOW_ID) return "alacritty";

  // 2. OS-Specific Defaults
  if (env.TERM_PROGRAM === "Apple_Terminal") return "apple-terminal";
  if (env.WT_SESSION) return "windows-terminal"; // Modern Windows Terminal
  if (env.PROMPT_COMMAND && env.PROMPT_COMMAND.includes("vte"))
    return "gnome-terminal"; // Common for VTE-based

  // 3. Multiplexers (Often wrap other terminals)
  if (env.TMUX) return "tmux";
  if (env.STY) return "screen";

  // 4. Fallbacks based on TERM variable
  if (env.TERM === "xterm-256color") return "xterm-256";

  return "default";
}

// WordPress Blue (rendered as cyan in terminal, closest to #21759B)
function wpBlue(text: string) {
  const detectedTerminal = getTerminalClient();

  switch (detectedTerminal) {
    // Apple Terminal renders blue as a purple shade, so we use cyan instead
    case "apple-terminal":
      return pc.cyan(text);
    // Most other terminals render blue correctly
    case "vscode":
    case "iterm2":
    case "warp":
    case "ghostty":
    case "kitty":
    case "hyper":
    case "alacritty":
    case "windows-terminal":
    case "gnome-terminal":
    case "tmux":
    case "screen":
    case "xterm-256":
    case "default":
    default:
      return pc.blue(text);
  }
}

export const logo = () => {
  return wpBlue(`
 ██     ██ ██████      ████████ ███████ ███████ ████████ ███████ ██████
 ██     ██ ██   ██        ██    ██      ██         ██    ██      ██   ██
 ██  █  ██ ██████         ██    █████   ███████    ██    █████   ██████
 ██ ███ ██ ██             ██    ██           ██    ██    ██      ██   ██
  ███ ███  ██             ██    ███████ ███████    ██    ███████ ██   ██
`);
};

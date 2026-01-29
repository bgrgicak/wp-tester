import type { WPTesterConfig } from "../types";
import * as clack from "@clack/prompts";
import { mkdir, writeFile, access, readFile } from "fs/promises";
import { join, dirname, relative } from "path";
import { execSync } from "child_process";
import pc from "picocolors";
import { getProjectDir } from "../path-utils";

const WORKFLOW_PATH = ".github/workflows/wp-tester.yml";

/**
 * Detect the default branch name from git
 */
function detectDefaultBranch(projectPath: string): string {
  try {
    // Try to get the default branch from remote HEAD
    const result = execSync("git symbolic-ref refs/remotes/origin/HEAD", {
      cwd: projectPath,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    // Result is like "refs/remotes/origin/main"
    const branch = result.split("/").pop();
    if (branch) {
      return branch;
    }
  } catch {
    // Remote HEAD not set, try other methods
  }

  try {
    // Check which common branch names exist locally
    const branches = execSync("git branch --list main master trunk", {
      cwd: projectPath,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    // Parse branch list and return first match
    const branchList = branches
      .split("\n")
      .map((b) => b.replace("*", "").trim())
      .filter((b) => b.length > 0);

    if (branchList.includes("main")) return "main";
    if (branchList.includes("master")) return "master";
    if (branchList.includes("trunk")) return "trunk";
  } catch {
    // Git command failed
  }

  // Default to "main"
  return "main";
}

/**
 * Generate the GitHub Action workflow content
 */
function generateWorkflowContent(
  wpTesterArgs: string,
  defaultBranch: string
): string {
  // Clean up args - remove empty lines and trim
  const cleanArgs = wpTesterArgs
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(" ");

  return `# WP Tester - WordPress Testing Workflow
# This workflow runs wp-tester to test your WordPress plugin/theme
#
# For more information, see: https://github.com/bgrgicak/wp-tester
#
# To customize this workflow:
# - Modify the 'wp-tester args' input for different test configurations
# - Add additional arguments like --test=phpunit or --failed-only
# - See 'npx wp-tester --help' for all available options

name: WP Tester

on:
  push:
    branches: [${defaultBranch}]
  pull_request:
    branches: [${defaultBranch}]
  workflow_dispatch:
    inputs:
      wp-tester-args:
        description: 'Additional arguments for wp-tester'
        required: false
        default: ''

jobs:
  test:
    name: Run WordPress Tests
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Run WP Tester
        run: npx wp-tester@latest test${cleanArgs ? ` ${cleanArgs}` : ''} \${{ github.event.inputs.wp-tester-args }}
`;
}

/**
 * Check if workflow file already exists
 */
async function workflowExists(projectPath: string): Promise<boolean> {
  try {
    await access(join(projectPath, WORKFLOW_PATH));
    return true;
  } catch {
    return false;
  }
}

/**
 * Read existing workflow file
 */
async function readExistingWorkflow(
  projectPath: string
): Promise<string | null> {
  try {
    const content = await readFile(join(projectPath, WORKFLOW_PATH), "utf8");
    return content;
  } catch {
    return null;
  }
}

/**
 * Extract wp-tester args from existing workflow
 */
function extractArgsFromWorkflow(content: string): string {
  // Try to find the wp-tester command line
  const match = content.match(
    /npx\s+wp-tester(?:@\S+)?\s+test\s*(.*?)(?:\s*\$\{\{|$)/m
  );
  if (match && match[1]) {
    return match[1].trim();
  }
  return "";
}

/**
 * Display a beautiful box with the workflow path
 */
function displaySuccessMessage(
  workflowPath: string,
  defaultBranch: string
): void {
  const relativePath = relative(process.cwd(), workflowPath) || workflowPath;
  const branchInfo = `Triggers on push/PR to '${defaultBranch}' branch.`;

  console.log("");
  console.log(
    pc.green("  ╭─────────────────────────────────────────────────────────────╮")
  );
  console.log(
    pc.green("  │                                                             │")
  );
  console.log(
    pc.green("  │") +
      pc.bold("  ✓ GitHub Action created successfully!                      ") +
      pc.green("│")
  );
  console.log(
    pc.green("  │                                                             │")
  );
  console.log(
    pc.green("  │") +
      pc.cyan(`    ${relativePath.padEnd(55)}`) +
      pc.green("│")
  );
  console.log(
    pc.green("  │                                                             │")
  );
  console.log(
    pc.green("  │") +
      pc.dim(`  ${branchInfo.padEnd(57)}`) +
      pc.green("│")
  );
  console.log(
    pc.green("  │") +
      pc.dim("  You can also trigger it manually from GitHub Actions.      ") +
      pc.green("│")
  );
  console.log(
    pc.green("  │                                                             │")
  );
  console.log(
    pc.green("  ╰─────────────────────────────────────────────────────────────╯")
  );
  console.log("");
}

/**
 * Display configuration help
 */
function displayConfigHelp(): void {
  const helpText = `
${pc.bold("wp-tester CLI Arguments")}

${pc.cyan("Common options:")}
  --test=<type>      Run specific tests: wp, plugin, theme, phpunit
  --failed-only      Only display failed tests in output
  --watch            Watch for file changes (not for CI)
  --passWithNoTests  Allow passing when no tests found

${pc.cyan("Examples:")}
  ${pc.dim("# Run only PHPUnit tests")}
  --test=phpunit

  ${pc.dim("# Run plugin smoke tests only")}
  --test=plugin

  ${pc.dim("# Show only failures (cleaner CI output)")}
  --failed-only

${pc.cyan("Tip:")} Leave empty to run all configured tests.
`;

  clack.note(helpText, "Configuration Help");
}

/**
 * CI config option
 * Creates a GitHub Action workflow for running wp-tester
 */
export async function ciOption(
  config: WPTesterConfig,
  context?: { configPath?: string; skipPrompt?: boolean }
): Promise<WPTesterConfig> {
  const configPath = context?.configPath;
  const skipPrompt = context?.skipPrompt ?? false;
  const projectPath = getProjectDir(config, configPath);

  // Check if user wants to set up CI
  if (!skipPrompt) {
    const setupCI = await clack.select({
      message: "Would you like to create a GitHub Action for automated testing?",
      options: [
        {
          value: true,
          label: "Yes",
          hint: "Create .github/workflows/wp-tester.yml",
        },
        { value: false, label: "No", hint: "Skip CI setup" },
      ],
      initialValue: true,
    });

    if (clack.isCancel(setupCI)) {
      clack.cancel("Setup cancelled.");
      process.exit(0);
    }

    if (!setupCI) {
      return config;
    }
  }

  // Check if workflow already exists
  const exists = await workflowExists(projectPath);
  let currentArgs = "";

  if (exists) {
    const existingContent = await readExistingWorkflow(projectPath);
    if (existingContent) {
      currentArgs = extractArgsFromWorkflow(existingContent);
    }

    const overwrite = await clack.select({
      message: `${WORKFLOW_PATH} already exists. What would you like to do?`,
      options: [
        {
          value: "edit",
          label: "Edit configuration",
          hint: "Modify the wp-tester arguments",
        },
        {
          value: "overwrite",
          label: "Overwrite with defaults",
          hint: "Start fresh with default configuration",
        },
        { value: "skip", label: "Keep existing", hint: "Don't make changes" },
      ],
      initialValue: "edit",
    });

    if (clack.isCancel(overwrite)) {
      clack.cancel("Setup cancelled.");
      process.exit(0);
    }

    if (overwrite === "skip") {
      clack.log.info("Keeping existing workflow file.");
      return config;
    }

    if (overwrite === "overwrite") {
      currentArgs = "";
    }
  }

  // Show help for configuration
  displayConfigHelp();

  // Prompt for wp-tester arguments
  const argsInput = await clack.text({
    message: "Configure wp-tester arguments (press Enter to use defaults):",
    placeholder: "e.g., --test=phpunit --failed-only",
    initialValue: currentArgs,
  });

  if (clack.isCancel(argsInput)) {
    clack.cancel("Setup cancelled.");
    process.exit(0);
  }

  const finalArgs = typeof argsInput === "string" ? argsInput.trim() : "";

  // Detect and confirm the default branch
  const detectedBranch = detectDefaultBranch(projectPath);

  const branchInput = await clack.text({
    message: "Target branch for CI triggers:",
    initialValue: detectedBranch,
    placeholder: "main",
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return "Branch name cannot be empty";
      }
      if (/\s/.test(value)) {
        return "Branch name cannot contain spaces";
      }
      return undefined;
    },
  });

  if (clack.isCancel(branchInput)) {
    clack.cancel("Setup cancelled.");
    process.exit(0);
  }

  const defaultBranch =
    typeof branchInput === "string" ? branchInput.trim() : detectedBranch;

  // Generate workflow content
  const workflowContent = generateWorkflowContent(finalArgs, defaultBranch);

  // Create directory if it doesn't exist
  const workflowFullPath = join(projectPath, WORKFLOW_PATH);
  const workflowDir = dirname(workflowFullPath);

  try {
    await mkdir(workflowDir, { recursive: true });
    await writeFile(workflowFullPath, workflowContent, "utf8");

    // Display success message
    displaySuccessMessage(workflowFullPath, defaultBranch);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    clack.log.error(`Failed to create workflow file: ${message}`);
    process.exit(1);
  }

  return config;
}

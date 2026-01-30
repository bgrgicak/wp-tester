#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { setupHandler } from "../commands/setup";
import { configHandler } from "../commands/config/index";
import { testHandler } from "../commands/test/index";
import { optionNames } from "@wp-tester/config";
import { logo } from "./logo";

void yargs(hideBin(process.argv))
  .parserConfiguration({
    'populate--': true
  })
  .scriptName("wp-tester")
  .usage("$0 <command> [options]")
  .command(
    "setup",
    "Setup wp-tester configuration",
    () => {},
    async () => {
      console.log(logo());
      await setupHandler();
    }
  )
  .command(
    "config <action>",
    "Manage wp-tester configuration",
    (yargs) => {
      return yargs
        .positional("action", {
          describe: "Action to perform",
          type: "string",
          choices: ["validate", ...optionNames] as const,
          demandOption: true,
        })
        .option("config", {
          alias: "c",
          describe: "Path to wp-tester.json config file",
          type: "string",
        });
    },
    async (argv) => {
      console.log(logo());
      await configHandler(argv);
    }
  )
  .command(
    "test",
    "Run tests",
    (yargs) => {
      return yargs
        .option("config", {
          alias: "c",
          describe: "Path to wp-tester.json config file",
          type: "string",
        })
        .option("test", {
          alias: "t",
          describe: "Type of test to run (wp, plugin, theme, or phpunit)",
          type: "string",
          choices: ["wp", "plugin", "theme", "phpunit"] as const,
        })
        .option("watch", {
          alias: "w",
          describe: "Watch for file changes and re-run tests automatically",
          type: "boolean",
          default: false,
        })
        .option("passWithNoTests", {
          describe: "Allow the test suite to pass when no tests are executed",
          type: "boolean",
          default: false,
        })
        .option("verbose", {
          alias: "v",
          describe: "Display all test results, not just failed tests",
          type: "boolean",
          default: false,
        });
    },
    async (argv) => {
      console.log(logo());
      await testHandler(argv);
    }
  )
  .demandCommand(1, "You must provide a command. Use --help to see available commands.")
  .help()
  .version()
  .parse();

#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { setupHandler } from "../commands/setup.js";
import { configHandler } from "../commands/config.js";
import { optionNames } from "../config/options/index.js";
import { logo } from "./logo.js";

yargs(hideBin(process.argv))
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
          type: "string" as const,
          choices: ["validate", ...optionNames] as const,
          demandOption: true,
        })
        .option("config", {
          alias: "c",
          describe: "Path to wp-tester.json config file",
          type: "string" as const,
          default: "./wp-tester.json",
        });
    },
    async (argv) => {
      console.log(logo());
      await configHandler(argv);
    }
  )
  .help()
  .version().argv;

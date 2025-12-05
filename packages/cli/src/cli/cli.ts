#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { setupHandler } from "../commands/setup";
import { configHandler } from "../commands/config/index";
import { testHandler } from "../commands/test/index";
import { optionNames } from "@wp-tester/config";
import { logo } from "./logo";

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
  .command(
    "test",
    "Run tests",
    (yargs) => {
      return yargs
        .option("config", {
          alias: "c",
          describe: "Path to wp-tester.json config file",
          type: "string" as const,
          default: "./wp-tester.json",
        });
    },
    async (argv) => {
      console.log(logo());
      await testHandler(argv);
    }
  )
  .help()
  .version().argv;

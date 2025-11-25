#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import * as setupCommand from "../commands/setup.js";
import { logo } from "./logo.js";

yargs(hideBin(process.argv))
  .scriptName("wp-tester")
  .usage("$0 <command> [options]")
  .command(
    setupCommand.command,
    setupCommand.describe,
    () => {},
    async () => {
      console.log(logo());
      await setupCommand.run();
    }
  )
  .help()
  .version().argv;

#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import * as initCommand from "../commands/init.js";
import { logo } from "./logo.js";

yargs(hideBin(process.argv))
  .scriptName("wp-tester")
  .usage("$0 <command> [options]")
  .command(
    initCommand.command,
    initCommand.describe,
    () => {},
    async () => {
      console.log(logo());
      await initCommand.run();
    }
  )
  .help()
  .version().argv;

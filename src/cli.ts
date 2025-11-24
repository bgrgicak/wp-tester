#!/usr/bin/env -S node --no-warnings --experimental-strip-types
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

yargs(hideBin(process.argv))
  .scriptName('wp-tester')
  .usage('$0 <command> [options]')
  .help()
  .version()
  .argv;

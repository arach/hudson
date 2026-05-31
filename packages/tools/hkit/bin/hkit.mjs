#!/usr/bin/env node
// H Kit - Hudson workspace CLI. Keep broad product helpers here instead of
// tying them to the web SDK package.

import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const COMMANDS = {
  design: '../src/commands/design.mjs',
};

const USAGE = `hkit - Hudson Kit CLI

USAGE
  hkit <command> [...args]

COMMANDS
  design    Print Hudson Design briefs, token maps, and agent guidance.

  Run \`hkit <command> --help\` for command-specific options.
`;

async function main() {
  const [, , cmd, ...rest] = process.argv;

  if (!cmd || cmd === '-h' || cmd === '--help') {
    process.stdout.write(USAGE);
    process.exit(cmd ? 0 : 1);
  }

  const target = COMMANDS[cmd];
  if (!target) {
    process.stderr.write(`hkit: unknown command "${cmd}"\n\n${USAGE}`);
    process.exit(2);
  }

  const mod = await import(join(__dirname, target));
  await mod.run(rest);
}

main().catch(err => {
  process.stderr.write(`hkit: ${err?.stack ?? err}\n`);
  process.exit(1);
});

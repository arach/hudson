#!/usr/bin/env node
// hudsonkit — CLI entry point. Dispatches to subcommands under bin/commands/.

import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const COMMANDS = {
  preflight: 'commands/preflight.mjs',
  status: 'commands/status.mjs',
  panic: 'commands/panic.mjs',
};

const USAGE = `hudsonkit — toolkit CLI

USAGE
  hudsonkit <command> [...args]

COMMANDS
  preflight    Scan the current project for known-dangerous consumer config.
               Use --fail-on-risk in predev / prebuild hooks to fail fast.
  status       List Hudson-related processes on this host.
  panic        Terminate Hudson-related processes (dry-run unless --yes).

  Run \`hudsonkit <command> --help\` for command-specific options.
`;

async function main() {
  const [, , cmd, ...rest] = process.argv;

  if (!cmd || cmd === '-h' || cmd === '--help') {
    process.stdout.write(USAGE);
    process.exit(cmd ? 0 : 1);
  }

  const target = COMMANDS[cmd];
  if (!target) {
    process.stderr.write(`hudsonkit: unknown command "${cmd}"\n\n${USAGE}`);
    process.exit(2);
  }

  const mod = await import(join(__dirname, target));
  await mod.run(rest);
}

main().catch(err => {
  process.stderr.write(`hudsonkit: ${err?.stack ?? err}\n`);
  process.exit(1);
});

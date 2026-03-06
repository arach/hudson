#!/usr/bin/env node
// ---------------------------------------------------------------------------
// hx — Local service registry & smart router for Hudson
// ---------------------------------------------------------------------------

import { parseArgs } from './lib/args';
import { bold, cyan, dim } from './lib/log';

const VERSION = '0.1.0';

function printHelp() {
  console.log(`
  ${bold(cyan('hx'))} ${dim(`v${VERSION}`)} — Local service registry for Hudson

  ${bold('Daemon:')}
    hx up                              Start the daemon (default :4800)
      --port <n>                       Override port
    hx down                            Stop the daemon
    hx status                          Daemon health + service summary

  ${bold('Services:')}
    hx register <id> --port <n>        Register a local service
      --name "Display Name"
      --type agent|app|api|custom
      --endpoints /traces,/chat
      --host <hostname>
    hx deregister <id>                 Remove a service
    hx ls                              List registered services

  ${bold('Push:')}
    hx push trace <file.json>          Push a trace to Hudson
      --name, --agent                  Override trace fields
      supports stdin via -
    hx push context <file>             Push arbitrary data to Hudson
      --label "..."

  ${bold('Config:')}
    hx config set <key> <value>        Set config (port, hudsonUrl)
    hx config get [key]                Get config value(s)
`);
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.flags.help || args.flags.h) {
    printHelp();
    return;
  }

  if (args.flags.version || args.flags.v) {
    console.log(VERSION);
    return;
  }

  switch (args.command) {
    case 'up': {
      const { up } = await import('./commands/up');
      await up(args);
      break;
    }
    case 'down': {
      const { down } = await import('./commands/down');
      await down();
      break;
    }
    case 'register': {
      const { register } = await import('./commands/register');
      await register(args);
      break;
    }
    case 'deregister': {
      const { deregister } = await import('./commands/deregister');
      await deregister(args);
      break;
    }
    case 'ls': {
      const { ls } = await import('./commands/ls');
      await ls();
      break;
    }
    case 'status': {
      const { status } = await import('./commands/status');
      await status();
      break;
    }
    case 'push': {
      const { push } = await import('./commands/push');
      await push(args);
      break;
    }
    case 'config': {
      const { config } = await import('./commands/config');
      await config(args);
      break;
    }
    default:
      printHelp();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

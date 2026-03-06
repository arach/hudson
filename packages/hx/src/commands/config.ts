// ---------------------------------------------------------------------------
// hx config get/set — Configuration management
// ---------------------------------------------------------------------------

import type { ParsedArgs } from '../lib/args';
import { readConfig, updateConfig } from '../lib/config';
import { error, success, bold, cyan, dim } from '../lib/log';
import type { HxConfig } from '../types';

const VALID_KEYS: (keyof HxConfig)[] = ['port', 'hudsonUrl'];

export async function config(args: ParsedArgs) {
  const action = args.subcommand;

  if (action === 'set') {
    const key = args.positional[0] as keyof HxConfig | undefined;
    const value = args.positional[1];

    if (!key || value === undefined) {
      error('Usage: hx config set <key> <value>');
      console.log(`  ${dim('Valid keys:')} ${VALID_KEYS.join(', ')}`);
      process.exit(1);
    }

    if (!VALID_KEYS.includes(key)) {
      error(`Unknown key: ${key}. Valid keys: ${VALID_KEYS.join(', ')}`);
      process.exit(1);
    }

    const partial: Partial<HxConfig> = {};
    if (key === 'port') {
      partial.port = parseInt(value, 10);
      if (isNaN(partial.port)) {
        error('Port must be a number.');
        process.exit(1);
      }
    } else {
      (partial as Record<string, string>)[key] = value;
    }

    await updateConfig(partial);
    success(`Set ${cyan(key)} = ${bold(value)}`);
    return;
  }

  if (action === 'get' || !action) {
    const cfg = await readConfig();
    const key = args.positional[0] as keyof HxConfig | undefined;

    if (key) {
      if (!VALID_KEYS.includes(key)) {
        error(`Unknown key: ${key}. Valid keys: ${VALID_KEYS.join(', ')}`);
        process.exit(1);
      }
      console.log(cfg[key]);
    } else {
      console.log();
      for (const k of VALID_KEYS) {
        console.log(`  ${dim(k.padEnd(12))} ${cfg[k]}`);
      }
      console.log();
    }
    return;
  }

  error(`Usage: hx config ${bold('get')}|${bold('set')} [key] [value]`);
  process.exit(1);
}

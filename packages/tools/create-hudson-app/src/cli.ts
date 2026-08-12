import { createInterface } from 'readline/promises';
import { stdin, stdout } from 'process';
import type { Tier } from './utils';
import { validateAppName } from './utils';
import { bold, cyan, dim, error, yellow } from './log';

// ---------------------------------------------------------------------------
// Parsed CLI options
// ---------------------------------------------------------------------------

export interface CLIOptions {
  appId: string;
  description: string;
  tier: Tier;
  mode: 'panel' | 'canvas';
  noWorkspace: boolean;
}

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

export function parseArgs(argv: string[]): Partial<CLIOptions> & { help?: boolean } {
  const args = argv.slice(2); // skip bun + script
  const opts: Partial<CLIOptions> & { help?: boolean } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--tier' && args[i + 1]) {
      const t = args[++i];
      if (t === 'minimal' || t === 'standard' || t === 'full' || t === 'standalone') {
        opts.tier = t;
      }
    } else if (arg === '--mode' && args[i + 1]) {
      const m = args[++i];
      if (m === 'panel' || m === 'canvas') {
        opts.mode = m;
      }
    } else if (arg === '--description' && args[i + 1]) {
      opts.description = args[++i];
    } else if (arg === '--no-workspace') {
      opts.noWorkspace = true;
    } else if (!arg.startsWith('-') && !opts.appId) {
      opts.appId = arg;
    }
  }

  return opts;
}

// ---------------------------------------------------------------------------
// Interactive prompts
// ---------------------------------------------------------------------------

export async function promptInteractive(partial: Partial<CLIOptions>): Promise<CLIOptions> {
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    // App ID
    let appId = partial.appId ?? '';
    if (!appId) {
      appId = await rl.question(`  ${bold('?')} App name ${dim('(kebab-case)')}: `);
    }
    const nameError = validateAppName(appId);
    if (nameError) {
      error(nameError);
      process.exit(1);
    }

    // Description
    let description = partial.description ?? '';
    if (!description) {
      description = await rl.question(`  ${bold('?')} Description: `);
    }
    if (!description) description = `A Hudson app`;

    // Tier
    let tier = partial.tier;
    if (!tier) {
      console.log(`  ${bold('?')} Tier:`);
      console.log(`    ${cyan('1)')} Minimal    ${dim('— Provider + Content + basic hooks (monorepo app)')}`);
      console.log(`    ${cyan('2)')} Standard   ${dim('— + LeftPanel + Inspector + intents')}`);
      console.log(`    ${cyan('3)')} Full       ${dim('— + tools + Terminal + LeftFooter + manifest')}`);
      console.log(`    ${cyan('4)')} Standalone ${dim('— Vite+TanStack consumer client (HUD-014)')}`);
      const tierInput = await rl.question(`  ${dim('Choose [1/2/3/4]')}: `);
      const tierMap: Record<string, Tier> = {
        '1': 'minimal',
        '2': 'standard',
        '3': 'full',
        '4': 'standalone',
        minimal: 'minimal',
        standard: 'standard',
        full: 'full',
        standalone: 'standalone',
      };
      tier = tierMap[tierInput.trim()] ?? 'minimal';
    }

    // Mode
    let mode = partial.mode;
    if (!mode) {
      const modeInput = await rl.question(`  ${bold('?')} Mode ${dim('(panel/canvas)')} [panel]: `);
      mode = modeInput.trim() === 'canvas' ? 'canvas' : 'panel';
    }

    return {
      appId,
      description,
      tier,
      mode,
      noWorkspace: partial.noWorkspace ?? false,
    };
  } finally {
    rl.close();
  }
}

// ---------------------------------------------------------------------------
// Help text
// ---------------------------------------------------------------------------

export function printHelp() {
  console.log(`
  ${bold(cyan('create-hudson-app'))} ${dim('v0.1.0')}

  ${bold('Usage:')}
    bun run packages/tools/create-hudson-app/src/index.ts ${cyan('<app-name>')} [options]

  ${bold('Options:')}
    --tier ${dim('minimal|standard|full|standalone')}
                                    App complexity tier
                                    ${dim('standalone = Vite+TanStack consumer (not monorepo)')}
    --mode ${dim('panel|canvas')}             Layout mode (monorepo tiers)
    --description ${dim('"..."')}             App description
    --no-workspace                  Skip workspace file generation
    -h, --help                      Show this help

  ${bold('Examples:')}
    bun run packages/tools/create-hudson-app/src/index.ts my-browser
    bun run packages/tools/create-hudson-app/src/index.ts my-editor --tier full --mode canvas
    bun run packages/tools/create-hudson-app/src/index.ts my-client --tier standalone --no-workspace
`);
}

#!/usr/bin/env bun

import { resolve } from 'path';
import { stat } from 'fs/promises';
import { parseArgs, promptInteractive, printHelp } from './cli';
import { scaffold } from './scaffold';
import { generateWorkspace } from './workspace';
import { buildVars } from './utils';
import { header, summary, error, info, cyan } from './log';
import { wireStandaloneHudsonkit, warnMissingMonorepoPack } from './wireHudsonkit';

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const partial = parseArgs(process.argv);

  if (partial.help) {
    printHelp();
    process.exit(0);
  }

  header();

  const opts = await promptInteractive(partial);
  const isStandalone = opts.tier === 'standalone';

  // Resolve project root. Monorepo tiers walk up to the host with app/;
  // standalone always scaffolds under cwd/<appId>/.
  let projectRoot = process.cwd();

  if (!isStandalone) {
    let current = projectRoot;
    while (current !== '/') {
      try {
        const appStat = await stat(resolve(current, 'app'));
        if (appStat.isDirectory()) {
          projectRoot = current;
          break;
        }
      } catch {
        // not found, go up
      }
      current = resolve(current, '..');
    }
  }

  const appDir = isStandalone
    ? resolve(projectRoot, opts.appId)
    : resolve(projectRoot, 'app', 'apps', opts.appId);
  try {
    await stat(appDir);
    error(`Directory already exists: ${isStandalone ? opts.appId : `app/apps/${opts.appId}`}`);
    process.exit(1);
  } catch {
    // Good — directory doesn't exist
  }

  const vars = buildVars(opts.appId, opts.description, opts.mode);

  info(`Creating ${cyan(opts.appId)}${isStandalone ? ' (standalone Vite consumer)' : ''}...`);
  console.log();

  const appFiles = await scaffold({
    appId: opts.appId,
    tier: opts.tier,
    vars,
    projectRoot,
  });

  // Wire a monorepo pack (or HUDSONKIT_TGZ) when available so the generated
  // client can validate against the exact local HudsonKit build.
  if (isStandalone) {
    const wired = await wireStandaloneHudsonkit(appDir, process.cwd());
    if (!wired) warnMissingMonorepoPack(process.cwd());
  }

  // Workspace files only apply to monorepo app tiers.
  let hasWorkspace = false;
  if (!opts.noWorkspace && !isStandalone) {
    await generateWorkspace(vars, projectRoot);
    hasWorkspace = true;
  }

  summary(opts.appId, appFiles.length, hasWorkspace, { standalone: isStandalone });
  if (isStandalone) {
    info(`Validate the standalone client: cd ${opts.appId} && bun install && bun run check`);
  }
}

main().catch(err => {
  error(err.message ?? String(err));
  process.exit(1);
});

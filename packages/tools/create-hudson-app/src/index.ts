#!/usr/bin/env bun

import { resolve } from 'path';
import { stat } from 'fs/promises';
import { parseArgs, promptInteractive, printHelp } from './cli';
import { scaffold } from './scaffold';
import { generateWorkspace } from './workspace';
import { buildVars } from './utils';
import { header, summary, error, info, cyan } from './log';

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

  // Resolve project root (find where app/ directory lives)
  let projectRoot = process.cwd();

  // Walk up to find the project root with app/ directory
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

  // Check if app already exists
  const appDir = resolve(projectRoot, 'app', 'apps', opts.appId);
  try {
    await stat(appDir);
    error(`Directory already exists: app/apps/${opts.appId}`);
    process.exit(1);
  } catch {
    // Good — directory doesn't exist
  }

  const vars = buildVars(opts.appId, opts.description, opts.mode);

  info(`Creating ${cyan(opts.appId)}...`);
  console.log();

  // Scaffold app files
  const appFiles = await scaffold({
    appId: opts.appId,
    tier: opts.tier,
    vars,
    projectRoot,
  });

  // Generate workspace
  let hasWorkspace = false;
  if (!opts.noWorkspace) {
    await generateWorkspace(vars, projectRoot);
    hasWorkspace = true;
  }

  summary(opts.appId, appFiles.length, hasWorkspace);
}

main().catch(err => {
  error(err.message ?? String(err));
  process.exit(1);
});

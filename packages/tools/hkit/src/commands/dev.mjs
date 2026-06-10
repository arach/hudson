// hkit dev - declarative local builds and runs for Hudson-backed macOS apps.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const FEATURE_CATALOG = {
  terminal: {
    env: { HUDSONKIT_WITH_TERMINAL: '1' },
    note: 'HudsonTerminal — terminal and PTY-backed surfaces',
  },
  voice: {
    env: { HUDSONKIT_WITH_VOICE: '1' },
    note: 'HudsonVoice — in-process dictation and VoxEngine transcription',
  },
};

const USAGE = `hkit dev - declarative HudsonKit local builds

USAGE
  hkit dev macos --config <file> [--build-only]

OPTIONS
  --config <file>   Hudson package config (macos.features, macos.builds, macos.run).
  --build-only      Build without launching macos.run.

The config uses the same feature names as \`hkit package macos\`:
  terminal, voice
`;

function parse(argv) {
  const args = {
    target: argv[0],
    configPath: undefined,
    buildOnly: false,
    help: false,
    _err: undefined,
  };

  if (argv[0] === '--help' || argv[0] === '-h') {
    args.help = true;
    return args;
  }

  for (let i = 1; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help' || a === '-h') { args.help = true; continue; }
    if (a === '--config') { args.configPath = argv[++i]; continue; }
    if (a?.startsWith('--config=')) { args.configPath = a.slice('--config='.length); continue; }
    if (a === '--build-only') { args.buildOnly = true; continue; }
    args._err = `unknown argument: ${a}`;
  }

  if (!args.target) args.help = true;
  return args;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function rel(root, value) {
  if (!value) return undefined;
  return resolve(root, value);
}

function normalizeFeatures(value, label) {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array of feature names.`);
  }
  return value.map((feature, index) => {
    if (typeof feature !== 'string' || !feature.trim()) {
      throw new Error(`${label}[${index}] must be a non-empty feature name.`);
    }
    return feature.trim();
  });
}

function resolveFeatureEnv(features, label) {
  const env = {};
  for (const feature of features) {
    const entry = FEATURE_CATALOG[feature];
    if (!entry) {
      throw new Error(`Unknown feature "${feature}" in ${label}. Known features: ${Object.keys(FEATURE_CATALOG).join(', ')}.`);
    }
    Object.assign(env, entry.env);
  }
  return env;
}

function buildFeatures(config, build, index) {
  const shared = normalizeFeatures(config.features, 'macos.features');
  const local = normalizeFeatures(build.features, `macos.builds[${index}].features`);
  return Array.from(new Set([...shared, ...local]));
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function runCommand(command, args, options = {}) {
  const label = [command, ...args].map(shellQuote).join(' ');
  process.stdout.write(`==> ${label}\n`);
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: options.stdio ?? 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`command failed (${result.status ?? 'signal'}): ${label}`);
  }
  return result;
}

async function runMacos(args) {
  if (!args.configPath) throw new Error('--config is required');
  const configPath = resolve(process.cwd(), args.configPath);
  if (!existsSync(configPath)) throw new Error(`config not found: ${configPath}`);
  const configDir = dirname(configPath);
  const raw = readJson(configPath);
  const config = raw.macos ?? raw;
  const builds = config.builds ?? [];
  if (builds.length === 0) {
    throw new Error('macos.builds must contain at least one build step.');
  }

  process.stdout.write(`==> Dev: ${config.productName ?? 'Hudson app'}\n`);
  process.stdout.write(`==> Config: ${configPath}\n`);

  for (const [index, build] of builds.entries()) {
    if (!build?.command) continue;
    const cwd = rel(configDir, build.cwd ?? '.');
    const features = buildFeatures(config, build, index);
    const featureEnv = resolveFeatureEnv(features, `macos.builds[${index}].features`);
    for (const feature of features) {
      process.stdout.write(`==> Feature: ${feature} (${FEATURE_CATALOG[feature].note})\n`);
    }
    const env = { ...process.env, ...featureEnv, ...(build.env ?? {}) };
    if (build.label) process.stdout.write(`==> Build: ${build.label}\n`);
    runCommand(build.command, build.args ?? [], { cwd, env });
  }

  if (args.buildOnly) return;

  const run = config.run;
  if (!run?.command) {
    process.stdout.write('==> Build complete (no macos.run configured)\n');
    return;
  }

  const cwd = rel(configDir, run.cwd ?? '.');
  const features = buildFeatures(config, run, 'run');
  const featureEnv = resolveFeatureEnv(features, 'macos.run.features');
  for (const feature of features) {
    process.stdout.write(`==> Feature: ${feature} (${FEATURE_CATALOG[feature].note})\n`);
  }
  const env = { ...process.env, ...featureEnv, ...(run.env ?? {}) };
  process.stdout.write('==> Launching app\n');
  runCommand(run.command, run.args ?? [], { cwd, env });
}

export async function run(argv) {
  const args = parse(argv);
  if (args.help) {
    process.stdout.write(USAGE);
    return;
  }
  if (args._err) {
    process.stderr.write(`dev: ${args._err}\n\n${USAGE}`);
    process.exit(2);
  }
  if (args.target !== 'macos') {
    process.stderr.write(`dev: unknown target "${args.target}". Use macos.\n\n${USAGE}`);
    process.exit(2);
  }

  await runMacos(args);
}
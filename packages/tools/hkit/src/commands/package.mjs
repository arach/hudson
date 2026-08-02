// hkit package - app packaging helpers for Hudson-backed clients.

import { spawnSync, execFileSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import {
  basename,
  dirname,
  extname,
  join,
  relative,
  resolve,
} from 'node:path';
import process from 'node:process';

const FEATURE_CATALOG = {
  terminal: {
    env: { HUDSONKIT_WITH_TERMINAL: '1' },
    note: 'HudsonTerminal — terminal and PTY-backed surfaces',
  },
  voice: {
    env: {},
    note: 'HudsonVoice — included by default; model acquisition is runtime-controlled',
  },
};

const USAGE = `hkit package - Hudson-backed app packager

USAGE
  hkit package macos --config <file> [options]

OPTIONS
  --version <value>             Override config/package version.
  --local                       Build a local DMG: skip notarization and allow ad-hoc signing.
  --skip-sign                   Do not sign app bundles or the DMG.
  --skip-notarize               Do not notarize or staple the DMG.
  --sign-identity <identity>    Developer ID or Apple Development identity.
  --require-sign-identity       Fail instead of falling back to ad-hoc signing.
  --notary-profile <profile>    notarytool keychain profile.
  --no-layout                   Skip Finder background/icon positioning.
  --keep-staging                Preserve temporary staging directories for debugging.
`;

function parse(argv) {
  const args = {
    target: argv[0],
    configPath: undefined,
    version: undefined,
    local: false,
    skipSign: false,
    skipNotarize: false,
    signIdentity: undefined,
    requireSignIdentity: false,
    notaryProfile: undefined,
    layout: true,
    keepStaging: false,
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
    if (a === '--version') { args.version = argv[++i]; continue; }
    if (a?.startsWith('--version=')) { args.version = a.slice('--version='.length); continue; }
    if (a === '--local') { args.local = true; continue; }
    if (a === '--skip-sign') { args.skipSign = true; continue; }
    if (a === '--skip-notarize') { args.skipNotarize = true; continue; }
    if (a === '--sign-identity') { args.signIdentity = argv[++i]; continue; }
    if (a?.startsWith('--sign-identity=')) { args.signIdentity = a.slice('--sign-identity='.length); continue; }
    if (a === '--require-sign-identity') { args.requireSignIdentity = true; continue; }
    if (a === '--notary-profile') { args.notaryProfile = argv[++i]; continue; }
    if (a?.startsWith('--notary-profile=')) { args.notaryProfile = a.slice('--notary-profile='.length); continue; }
    if (a === '--no-layout') { args.layout = false; continue; }
    if (a === '--keep-staging') { args.keepStaging = true; continue; }
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

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function displayPath(path) {
  return relative(process.cwd(), path).startsWith('..') ? path : relative(process.cwd(), path);
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

function plistBuddy(plistPath, command) {
  execFileSync('/usr/libexec/PlistBuddy', ['-c', command, plistPath], { stdio: 'pipe' });
}

function setPlistValue(plistPath, key, type, value) {
  const serialized = type === 'bool' ? (value ? 'true' : 'false') : String(value);
  try {
    plistBuddy(plistPath, `Set :${key} ${serialized}`);
  } catch {
    plistBuddy(plistPath, `Add :${key} ${type} ${serialized}`);
  }
}

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function writeDefaultInfoPlist(plistPath, app, version, minimumSystemVersion) {
  const bundleIdentifier = app.bundleIdentifier;
  const displayName = app.displayName ?? app.name ?? app.executableName;
  const executableName = app.executableName ?? app.product ?? app.name;
  const urlSchemes = Array.isArray(app.urlSchemes) ? app.urlSchemes : [];
  const urlType = urlSchemes.length > 0
    ? `    <key>CFBundleURLTypes</key>
    <array>
        <dict>
            <key>CFBundleURLName</key>
            <string>${xmlEscape(bundleIdentifier)}</string>
            <key>CFBundleURLSchemes</key>
            <array>
${urlSchemes.map(s => `                <string>${xmlEscape(s)}</string>`).join('\n')}
            </array>
        </dict>
    </array>
`
    : '';
  const lsuiElement = app.lsuiElement
    ? `    <key>LSUIElement</key>
    <true/>
`
    : '';

  writeFileSync(plistPath, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleIdentifier</key>
    <string>${xmlEscape(bundleIdentifier)}</string>
    <key>CFBundleName</key>
    <string>${xmlEscape(displayName)}</string>
    <key>CFBundleDisplayName</key>
    <string>${xmlEscape(displayName)}</string>
    <key>CFBundleExecutable</key>
    <string>${xmlEscape(executableName)}</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleVersion</key>
    <string>${xmlEscape(version)}</string>
    <key>CFBundleShortVersionString</key>
    <string>${xmlEscape(version)}</string>
    <key>LSMinimumSystemVersion</key>
    <string>${xmlEscape(minimumSystemVersion)}</string>
${lsuiElement}    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSSupportsAutomaticTermination</key>
    <true/>
${urlType}</dict>
</plist>
`);
}

function applyPlistOverrides(plistPath, app, version, minimumSystemVersion) {
  const displayName = app.displayName ?? app.name ?? app.executableName;
  setPlistValue(plistPath, 'CFBundleIdentifier', 'string', app.bundleIdentifier);
  setPlistValue(plistPath, 'CFBundleName', 'string', displayName);
  setPlistValue(plistPath, 'CFBundleDisplayName', 'string', displayName);
  setPlistValue(plistPath, 'CFBundleExecutable', 'string', app.executableName ?? app.product ?? app.name);
  setPlistValue(plistPath, 'CFBundlePackageType', 'string', 'APPL');
  setPlistValue(plistPath, 'CFBundleVersion', 'string', version);
  setPlistValue(plistPath, 'CFBundleShortVersionString', 'string', version);
  setPlistValue(plistPath, 'LSMinimumSystemVersion', 'string', minimumSystemVersion);
  setPlistValue(plistPath, 'NSHighResolutionCapable', 'bool', true);
  setPlistValue(plistPath, 'NSSupportsAutomaticTermination', 'bool', true);
  if (typeof app.lsuiElement === 'boolean') {
    setPlistValue(plistPath, 'LSUIElement', 'bool', app.lsuiElement);
  }
  if (app.plist && typeof app.plist === 'object') {
    for (const [key, value] of Object.entries(app.plist)) {
      if (typeof value === 'boolean') setPlistValue(plistPath, key, 'bool', value);
      else setPlistValue(plistPath, key, 'string', value);
    }
  }
}

function copyIcon(iconPath, resourcesDir, tempRoots) {
  if (!iconPath || !existsSync(iconPath)) return false;
  mkdirSync(resourcesDir, { recursive: true });

  if (extname(iconPath).toLowerCase() === '.icns') {
    cpSync(iconPath, join(resourcesDir, 'AppIcon.icns'));
    return true;
  }

  const iconset = join(tmpdir(), `hkit-iconset-${process.pid}-${Date.now()}.iconset`);
  mkdirSync(iconset, { recursive: true });
  tempRoots.push(iconset);
  const sizes = [16, 32, 128, 256, 512];
  for (const size of sizes) {
    execFileSync('sips', ['-z', String(size), String(size), iconPath, '--out', join(iconset, `icon_${size}x${size}.png`)], { stdio: 'pipe' });
    execFileSync('sips', ['-z', String(size * 2), String(size * 2), iconPath, '--out', join(iconset, `icon_${size}x${size}@2x.png`)], { stdio: 'pipe' });
  }
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', join(resourcesDir, 'AppIcon.icns')], { stdio: 'pipe' });
  return true;
}

export function normalizeFrameworkPaths(app) {
  const frameworks = app.frameworks ?? [];
  if (!Array.isArray(frameworks)) {
    throw new Error(`frameworks for ${app.name ?? app.product ?? '<unnamed>'} must be an array of paths.`);
  }
  return frameworks.map((frameworkPath, index) => {
    if (typeof frameworkPath !== 'string' || !frameworkPath.trim()) {
      throw new Error(`frameworks[${index}] for ${app.name ?? app.product ?? '<unnamed>'} must be a non-empty path.`);
    }
    return frameworkPath.trim();
  });
}

export function parseExecutableRpaths(output) {
  return Array.from(
    String(output).matchAll(/^\s*path (.+) \(offset \d+\)$/gm),
    match => match[1],
  );
}

export function parseArchitectureRpaths(output) {
  const text = String(output);
  const headers = Array.from(text.matchAll(/^.+ \(architecture ([^)]+)\):\s*$/gm));
  if (headers.length === 0) {
    return [{ architecture: 'single', rpaths: parseExecutableRpaths(text) }];
  }

  return headers.map((header, index) => {
    const start = header.index + header[0].length;
    const end = headers[index + 1]?.index ?? text.length;
    return {
      architecture: header[1],
      rpaths: parseExecutableRpaths(text.slice(start, end)),
    };
  });
}

export function parseInstallNames(output) {
  return String(output)
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.endsWith(':'));
}

export function parseLinkedLibraries(output) {
  return String(output)
    .split('\n')
    .map(line => line.match(/^\s*(.+?) \(compatibility version /)?.[1])
    .filter(Boolean);
}

export function frameworkLinkageIssues(frameworkName, installNames, linkedLibraries) {
  const frameworkMarker = `/${frameworkName}/`;
  const portableInstallPrefix = `@rpath/${frameworkName}/`;
  const frameworkLoads = linkedLibraries.filter(path => (
    path.includes(frameworkMarker) || path.startsWith(`${frameworkName}/`)
  ));
  return {
    installNames: installNames.filter(path => !path.startsWith(portableInstallPrefix)),
    linkedLibraries: frameworkLoads.filter(path => !path.startsWith('@rpath/')),
  };
}

function executableRpaths(executablePath) {
  const output = execFileSync('otool', ['-l', executablePath], { encoding: 'utf8' });
  return parseArchitectureRpaths(output);
}

function assertPortableFrameworkLinkage(executablePath, frameworkBundle) {
  const frameworkName = basename(frameworkBundle);
  const frameworkExecutable = join(
    frameworkBundle,
    frameworkName.slice(0, -'.framework'.length),
  );
  if (!existsSync(frameworkExecutable)) {
    throw new Error(`framework executable not found: ${frameworkExecutable}`);
  }

  const installNames = parseInstallNames(
    execFileSync('otool', ['-D', frameworkExecutable], { encoding: 'utf8' }),
  );
  if (installNames.length === 0) {
    throw new Error(`framework has no LC_ID_DYLIB install name: ${frameworkExecutable}`);
  }
  const linkedLibraries = parseLinkedLibraries(
    execFileSync('otool', ['-L', executablePath], { encoding: 'utf8' }),
  );
  const issues = frameworkLinkageIssues(frameworkName, installNames, linkedLibraries);

  if (issues.installNames.length > 0) {
    throw new Error(
      `${frameworkName} has a non-portable LC_ID_DYLIB (${issues.installNames.join(', ')}); relink it with an @rpath install name or repair it with install_name_tool -id before packaging`,
    );
  }
  if (issues.linkedLibraries.length > 0) {
    throw new Error(
      `${basename(executablePath)} references ${frameworkName} through a non-portable LC_LOAD_DYLIB (${issues.linkedLibraries.join(', ')}); relink against its @rpath install name or repair it with install_name_tool -change before packaging`,
    );
  }
}

function embedFrameworks(app, contentsDir, executablePath, context) {
  const frameworks = normalizeFrameworkPaths(app);
  if (frameworks.length === 0) return;

  const frameworksDir = join(contentsDir, 'Frameworks');
  const embeddedNames = new Set();
  mkdirSync(frameworksDir, { recursive: true });

  for (const frameworkPath of frameworks) {
    const source = rel(context.configDir, frameworkPath);
    if (!source || !existsSync(source)) {
      throw new Error(`framework not found for ${app.name ?? app.product ?? '<unnamed>'}: ${source}`);
    }

    const frameworkName = basename(source);
    if (!frameworkName.endsWith('.framework')) {
      throw new Error(`framework path must reference a .framework bundle: ${source}`);
    }
    if (embeddedNames.has(frameworkName)) {
      throw new Error(`duplicate embedded framework name for ${app.name ?? app.product ?? '<unnamed>'}: ${frameworkName}`);
    }
    embeddedNames.add(frameworkName);

    const destination = join(frameworksDir, frameworkName);
    rmSync(destination, { recursive: true, force: true });
    // ditto preserves versioned-framework symlinks, resources, and nested code.
    runCommand('ditto', [source, destination], { stdio: 'inherit' });
    assertPortableFrameworkLinkage(executablePath, destination);
  }

  const frameworkRpath = '@executable_path/../Frameworks';
  const slices = executableRpaths(executablePath);
  const missingArchitectures = slices
    .filter(slice => !slice.rpaths.includes(frameworkRpath))
    .map(slice => slice.architecture);
  if (missingArchitectures.length > 0 && missingArchitectures.length < slices.length) {
    throw new Error(
      `${frameworkRpath} is missing from only some executable architectures (${missingArchitectures.join(', ')}); relink every slice with the same rpath`,
    );
  }

  if (missingArchitectures.length > 0) {
    try {
      runCommand('install_name_tool', ['-add_rpath', frameworkRpath, executablePath], { stdio: 'inherit' });
    } catch (error) {
      throw new Error(
        `could not add ${frameworkRpath} to ${executablePath}; relink the executable with that rpath or with -headerpad_max_install_names`,
        { cause: error },
      );
    }

    const remaining = executableRpaths(executablePath)
      .filter(slice => !slice.rpaths.includes(frameworkRpath))
      .map(slice => slice.architecture);
    if (remaining.length > 0) {
      throw new Error(`${frameworkRpath} was not added to executable architectures: ${remaining.join(', ')}`);
    }
  }
}

function signEmbeddedFrameworks(bundlePath, app, identity, options) {
  if (options.skipSign) return;

  const signing = signingPolicy(identity);
  for (const frameworkPath of normalizeFrameworkPaths(app)) {
    const frameworkBundle = join(bundlePath, 'Contents', 'Frameworks', basename(frameworkPath));
    const args = [
      '--force',
      '--deep',
      `--preserve-metadata=${signing.preserveMetadata}`,
    ];
    if (signing.hardenedRuntime) args.push('--options', 'runtime');
    if (signing.timestamp) args.push('--timestamp');
    args.push('--sign', signing.identity, frameworkBundle);

    process.stdout.write(`==> Signing ${basename(frameworkBundle)} with ${signing.label}\n`);
    runCommand('codesign', args, { stdio: 'inherit' });
    runCommand('codesign', ['--verify', '--deep', '--strict', frameworkBundle], { stdio: 'inherit' });
  }
}

function defaultSigningIdentity() {
  try {
    const identities = execFileSync('security', ['find-identity', '-v', '-p', 'codesigning'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return identities.match(/^\s*\d+\)\s+([A-F0-9]{40})\s+"Developer ID Application:[^"]+"/m)?.[1]
      ?? identities.match(/^\s*\d+\)\s+([A-F0-9]{40})\s+"Apple Development:[^"]+"/m)?.[1]
      ?? '';
  } catch {
    return '';
  }
}

function resolveSigningIdentity(cliArgs, config) {
  const identityEnv = config.signing?.identityEnv;
  return cliArgs.signIdentity
    ?? (identityEnv ? process.env[identityEnv] : undefined)
    ?? process.env.HUDSONKIT_SIGN_IDENTITY
    ?? process.env.HKIT_SIGN_IDENTITY
    ?? defaultSigningIdentity();
}

export function shouldUseDeepSigning(app) {
  return (app.embeddedHelpers?.length ?? 0) === 0
    && normalizeFrameworkPaths(app).length === 0;
}

export function signingPolicy(identity) {
  const trimmed = typeof identity === 'string' ? identity.trim() : '';
  const adHoc = trimmed === '' || trimmed === '-';
  return {
    identity: adHoc ? '-' : trimmed,
    label: adHoc ? 'ad-hoc' : trimmed,
    hardenedRuntime: !adHoc,
    timestamp: !adHoc,
    // An ad-hoc signature must not inherit the previous signature's flags:
    // preserving `flags` re-applies Hardened Runtime, and macOS then enforces
    // team-based library validation against a binary that has no Team ID —
    // which rejects the embedded frameworks at load time.
    preserveMetadata: adHoc ? 'identifier' : 'identifier,entitlements,requirements,flags',
  };
}

function signAppBundle(bundlePath, app, identity, options) {
  if (options.skipSign) {
    process.stdout.write(`==> Skipping app signing: ${displayPath(bundlePath)}\n`);
    return;
  }

  const executable = app.executableName ?? app.product ?? app.name;
  const tempBinary = join(bundlePath, 'Contents', 'MacOS', `${executable}.cstemp`);
  rmSync(tempBinary, { force: true });

  const entitlements = app.entitlementsPath;
  const signing = signingPolicy(identity);
  const args = ['--force'];
  if (shouldUseDeepSigning(app)) {
    args.push('--deep');
  }
  if (signing.hardenedRuntime) args.push('--options', 'runtime');
  if (signing.timestamp) args.push('--timestamp');
  args.push('--sign', signing.identity);
  if (entitlements && existsSync(entitlements)) args.push('--entitlements', entitlements);
  args.push('--identifier', app.bundleIdentifier, bundlePath);

  process.stdout.write(`==> Signing ${basename(bundlePath)} with ${signing.label}\n`);
  runCommand('codesign', args, { stdio: 'inherit' });
  runCommand('codesign', ['--verify', '--deep', '--strict', bundlePath], { stdio: 'inherit' });
}

function buildAppBundle(app, bundlePath, args, context, tempRoots) {
  if (!app.bundleIdentifier) throw new Error(`app ${app.name ?? '<unnamed>'} is missing bundleIdentifier`);

  const bundleName = basename(bundlePath);
  const contentsDir = join(bundlePath, 'Contents');
  const macosDir = join(contentsDir, 'MacOS');
  const resourcesDir = join(contentsDir, 'Resources');
  const binarySource = rel(context.configDir, app.binaryPath);
  const executableName = app.executableName ?? app.product ?? app.name;
  if (!binarySource || !existsSync(binarySource)) {
    throw new Error(`built binary not found for ${bundleName}: ${binarySource}`);
  }

  rmSync(bundlePath, { recursive: true, force: true });
  mkdirSync(macosDir, { recursive: true });
  mkdirSync(resourcesDir, { recursive: true });

  const executablePath = join(macosDir, executableName);
  cpSync(binarySource, executablePath);
  chmodSync(executablePath, 0o755);

  const plistPath = join(contentsDir, 'Info.plist');
  const template = rel(context.configDir, app.infoPlist);
  if (template && existsSync(template)) {
    cpSync(template, plistPath);
  } else {
    writeDefaultInfoPlist(plistPath, app, context.version, context.minimumSystemVersion);
  }
  applyPlistOverrides(plistPath, app, context.version, context.minimumSystemVersion);

  if (copyIcon(rel(context.configDir, app.icon), resourcesDir, tempRoots)) {
    setPlistValue(plistPath, 'CFBundleIconFile', 'string', 'AppIcon');
  }

  embedFrameworks(app, contentsDir, executablePath, context);

  for (const helper of app.embeddedHelpers ?? []) {
    const helperBundleName = helper.bundleName ?? `${helper.name ?? helper.product}.app`;
    const destination = helper.destination ?? 'Contents/Library/LoginItems';
    const helperBundlePath = join(bundlePath, destination, helperBundleName);
    buildAppBundle(helper, helperBundlePath, args, context, tempRoots);
  }

  signEmbeddedFrameworks(bundlePath, app, context.signingIdentity, args);
  const appForSigning = { ...app, executableName, entitlementsPath: rel(context.configDir, app.entitlements) };
  signAppBundle(bundlePath, appForSigning, context.signingIdentity, args);
  process.stdout.write(`==> Built ${displayPath(bundlePath)}\n`);
  return { ...app, bundleName, bundlePath };
}

function buildApps(config, args, context) {
  const apps = config.apps ?? [];
  if (!Array.isArray(apps) || apps.length === 0) {
    throw new Error('macos.apps must contain at least one app definition.');
  }

  for (const [index, build] of (config.builds ?? []).entries()) {
    if (!build?.command) continue;
    const cwd = rel(context.configDir, build.cwd ?? '.');
    const features = buildFeatures(config, build, index);
    const featureEnv = resolveFeatureEnv(features, `macos.builds[${index}].features`);
    for (const feature of features) {
      process.stdout.write(`==> Feature: ${feature} (${FEATURE_CATALOG[feature].note})\n`);
    }
    const env = { ...process.env, ...featureEnv, ...(build.env ?? {}) };
    runCommand(build.command, build.args ?? [], { cwd, env });
  }

  const built = [];
  const tempRoots = [];
  try {
    for (const app of apps) {
      const bundleName = app.bundleName ?? `${app.name ?? app.product}.app`;
      const bundlePath = join(context.distDir, bundleName);
      built.push(buildAppBundle(app, bundlePath, args, context, tempRoots));
    }
  } finally {
    if (!args.keepStaging) {
      for (const tempRoot of tempRoots) rmSync(tempRoot, { recursive: true, force: true });
    }
  }

  return built;
}

function replaceTokens(template, context) {
  return String(template)
    .replaceAll('${version}', context.version)
    .replaceAll('${productName}', context.productName);
}

function generatedBackgroundSvg(dmg, apps, context, width, height) {
  const title = dmg.title ?? context.productName;
  const subtitle = dmg.subtitle ?? 'Install the native app and desktop companion.';
  const accent = dmg.accent ?? '#22c55e';
  const bg = dmg.backgroundColor ?? '#0b0f14';
  const grid = dmg.gridColor ?? '#1f2937';
  const iconSize = dmg.iconSize ?? 96;
  const positions = dmg.positions ?? defaultPositions(apps, width, height);
  // Finder clips the icon-view background below the window titlebar.
  const windowChromeHeight = Math.max(0, Number(dmg.windowChromeHeight ?? 32));
  const visibleHeight = Math.max(1, height - (Number.isFinite(windowChromeHeight) ? windowChromeHeight : 32));
  const itemPositions = positions.filter(position => (
    position.name === 'Applications' || apps.some(app => app.bundleName === position.name)
  ));
  const top = Math.round(height * 0.22);
  const arrowY = itemPositions.length > 0 ? itemPositions[0].y : Math.round(height * 0.66);
  const source = itemPositions.find(position => position.name !== 'Applications') ?? itemPositions[0];
  const target = itemPositions.find(position => position.name === 'Applications') ?? itemPositions[itemPositions.length - 1];
  const arrowStart = source && target ? source.x + Math.round(iconSize * 0.92) : Math.round(width * 0.38);
  const arrowEnd = source && target ? target.x - Math.round(iconSize * 0.92) : Math.round(width * 0.68);
  const shelfTop = Math.round(Number(dmg.shelfTop ?? visibleHeight * 0.57));
  const shelfBottom = visibleHeight - Math.max(12, Number(dmg.shelfBottomInset ?? 20));
  const shelfHeight = Math.max(96, shelfBottom - shelfTop);
  const shelfInset = Math.round(Number(dmg.shelfInset ?? 34));
  const installLabelY = Math.round(Number(dmg.installLabelY ?? shelfTop - 22));
  const labelY = Math.round(arrowY + Number(dmg.labelPlateOffset ?? iconSize * 0.70));
  const bracketMode = dmg.cornerBrackets ?? 'all';
  const gridSize = 20;
  const bracketInset = Math.round((dmg.bracketInset ?? 40) / gridSize) * gridSize;
  const bracketLength = Math.max(gridSize, Math.round((dmg.bracketLength ?? gridSize) / gridSize) * gridSize);
  const bracketTop = Math.round((dmg.bracketTop ?? 60) / gridSize) * gridSize;
  const bracketStroke = Math.max(1, Math.round(Number(dmg.bracketStroke ?? 2)));
  const leftX = bracketInset;
  const rightX = width - bracketInset - bracketLength;
  const rightV = width - bracketInset;
  const configuredBottomY = dmg.bracketBottomY == null ? undefined : Number(dmg.bracketBottomY);
  const bottomY = Math.round(Number.isFinite(configuredBottomY) ? configuredBottomY : visibleHeight - bracketInset);
  const bottomV = bottomY - bracketLength;
  const topBrackets = bracketMode !== false
    ? `  <rect x="${leftX}" y="${bracketTop}" width="${bracketLength}" height="${bracketStroke}" fill="${xmlEscape(accent)}"/>
  <rect x="${leftX}" y="${bracketTop}" width="${bracketStroke}" height="${bracketLength}" fill="${xmlEscape(accent)}"/>
  <rect x="${rightX}" y="${bracketTop}" width="${bracketLength}" height="${bracketStroke}" fill="${xmlEscape(accent)}"/>
  <rect x="${rightV}" y="${bracketTop}" width="${bracketStroke}" height="${bracketLength}" fill="${xmlEscape(accent)}"/>
`
    : '';
  const bottomBrackets = bracketMode === 'all' || bracketMode === true
    ? `  <rect x="${leftX}" y="${bottomY}" width="${bracketLength}" height="${bracketStroke}" fill="${xmlEscape(accent)}"/>
  <rect x="${leftX}" y="${bottomV}" width="${bracketStroke}" height="${bracketLength}" fill="${xmlEscape(accent)}"/>
  <rect x="${rightX}" y="${bottomY}" width="${bracketLength}" height="${bracketStroke}" fill="${xmlEscape(accent)}"/>
  <rect x="${rightV}" y="${bottomV}" width="${bracketStroke}" height="${bracketLength}" fill="${xmlEscape(accent)}"/>
`
    : '';
  const labelPlates = dmg.labelPlates !== false
    ? itemPositions.map(position => {
        const rawLabel = position.name.endsWith('.app') ? position.name.slice(0, -4) : position.name;
        const plateWidth = Math.max(82, Math.min(148, rawLabel.length * 7 + 30));
        return `  <rect x="${position.x - Math.round(plateWidth / 2)}" y="${labelY - 14}" width="${plateWidth}" height="24" rx="8" fill="#f8fafc" fill-opacity="0.86" stroke="#ffffff" stroke-opacity="0.42"/>
`;
      }).join('')
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="${xmlEscape(grid)}" stroke-opacity="0.28" stroke-width="1"/>
    </pattern>
    <linearGradient id="arrow" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${xmlEscape(accent)}" stop-opacity="0.30"/>
      <stop offset="0.5" stop-color="${xmlEscape(accent)}" stop-opacity="0.92"/>
      <stop offset="1" stop-color="${xmlEscape(accent)}" stop-opacity="0.62"/>
    </linearGradient>
    <radialGradient id="heroGlow" cx="50%" cy="18%" r="58%">
      <stop offset="0" stop-color="${xmlEscape(accent)}" stop-opacity="0.12"/>
      <stop offset="0.42" stop-color="${xmlEscape(accent)}" stop-opacity="0.035"/>
      <stop offset="1" stop-color="${xmlEscape(bg)}" stop-opacity="0"/>
    </radialGradient>
    <filter id="softShadow" x="-20%" y="-60%" width="140%" height="220%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000000" flood-opacity="0.30"/>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="${xmlEscape(bg)}"/>
  <rect width="${width}" height="${height}" fill="url(#heroGlow)"/>
  <rect width="${width}" height="${height}" fill="url(#grid)"/>
  <rect x="${shelfInset}" y="${shelfTop}" width="${width - shelfInset * 2}" height="${shelfHeight}" rx="22" fill="#ffffff" fill-opacity="0.045" stroke="#ffffff" stroke-opacity="0.08" filter="url(#softShadow)"/>
${topBrackets}${bottomBrackets}
  <text x="${Math.round(width / 2)}" y="${top}" fill="#f8fafc" font-family="-apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif" font-size="34" font-weight="780" text-anchor="middle">${xmlEscape(title)}</text>
  <text x="${Math.round(width / 2)}" y="${top + 30}" fill="#aab4c2" font-family="SF Mono, Menlo, monospace" font-size="10" font-weight="700" letter-spacing="1.6" text-anchor="middle">${xmlEscape(subtitle.toUpperCase())}</text>
  <text x="${Math.round(width / 2)}" y="${installLabelY}" fill="#d7dee9" fill-opacity="0.74" font-family="SF Mono, Menlo, monospace" font-size="10" font-weight="700" letter-spacing="1.1" text-anchor="middle">DRAG TO INSTALL</text>
  <line x1="${arrowStart}" y1="${arrowY}" x2="${arrowEnd}" y2="${arrowY}" stroke="url(#arrow)" stroke-width="10" stroke-linecap="round"/>
  <path d="M ${arrowEnd - 2} ${arrowY - 20} L ${arrowEnd + 28} ${arrowY} L ${arrowEnd - 2} ${arrowY + 20} Z" fill="${xmlEscape(accent)}" fill-opacity="0.92"/>
${labelPlates}
</svg>`;
}

function materializeBackground(dmg, apps, context, backgroundDir) {
  mkdirSync(backgroundDir, { recursive: true });
  const width = dmg.width ?? 640;
  const height = dmg.height ?? 380;
  const configured = rel(context.configDir, dmg.backgroundImage);
  const out = join(backgroundDir, 'background.png');

  if (configured && existsSync(configured)) {
    cpSync(configured, out);
    return out;
  }

  const svgPath = join(backgroundDir, 'background.svg');
  writeFileSync(svgPath, generatedBackgroundSvg(dmg, apps, context, width, height));
  runCommand('sips', ['-s', 'format', 'png', svgPath, '--out', out], { stdio: 'pipe' });
  return out;
}

function defaultPositions(apps, width, height) {
  const y = Math.round(height * 0.66);
  if (apps.length === 1) {
    return [
      { name: apps[0].bundleName, x: Math.round(width * 0.28), y },
      { name: 'Applications', x: Math.round(width * 0.74), y },
    ];
  }
  const gap = width / (apps.length + 2);
  return [
    ...apps.map((app, index) => ({
      name: app.bundleName,
      x: Math.round(gap * (index + 1)),
      y,
    })),
    { name: 'Applications', x: Math.round(width - gap), y },
  ];
}

function appleScriptString(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function writeFinderLayoutScript(scriptPath, volumeName, dmg, apps, backgroundEnabled) {
  const width = dmg.width ?? 640;
  const height = dmg.height ?? 380;
  const iconSize = dmg.iconSize ?? 96;
  const positions = dmg.positions ?? defaultPositions(apps, width, height);
  const positionLines = positions.map(position => (
    `        set position of item "${appleScriptString(position.name)}" of container window to {${position.x}, ${position.y}}`
  )).join('\n');
  const backgroundLine = backgroundEnabled
    ? '        set background picture of theViewOptions to file ".background:background.png"'
    : '';

  writeFileSync(scriptPath, `tell application "Finder"
    tell disk "${appleScriptString(volumeName)}"
        open
        delay 1
        set current view of container window to icon view
        set toolbar visible of container window to false
        set statusbar visible of container window to false
        set bounds of container window to {400, 100, ${400 + width}, ${100 + height}}

        set theViewOptions to icon view options of container window
        set arrangement of theViewOptions to not arranged
        set icon size of theViewOptions to ${iconSize}
        set text size of theViewOptions to 10
        set label position of theViewOptions to bottom
        set shows item info of theViewOptions to false
${backgroundLine}
        delay 1
${positionLines}
        update without registering applications
        delay 1
        close
    end tell
end tell
`);
}

function createDmg(config, args, context, apps) {
  const dmg = config.dmg ?? {};
  const volumeName = replaceTokens(dmg.volumeName ?? context.productName, context);
  const dmgName = replaceTokens(dmg.name ?? `${context.productName}-${context.version}.dmg`, context);
  const dmgPath = join(context.distDir, dmgName);
  const latestPath = dmg.latestName ? join(context.distDir, replaceTokens(dmg.latestName, context)) : undefined;
  const staging = mkdtempSync(join(tmpdir(), 'hkit-dmg-staging-'));
  const tempDmg = join(context.distDir, `.${basename(dmgName, '.dmg')}.rw.dmg`);
  const mountPoint = join('/Volumes', volumeName.replaceAll('/', '-'));

  try {
    for (const app of apps) {
      // Preserve versioned-framework symlinks and nested bundle metadata while
      // moving the signed app into the DMG staging tree.
      runCommand('ditto', [app.bundlePath, join(staging, app.bundleName)], { stdio: 'inherit' });
    }
    execFileSync('ln', ['-s', '/Applications', join(staging, 'Applications')]);

    const backgroundDir = join(staging, '.background');
    let backgroundEnabled = false;
    if (dmg.background !== false) {
      materializeBackground(dmg, apps, context, backgroundDir);
      backgroundEnabled = true;
    }

    rmSync(dmgPath, { force: true });
    rmSync(tempDmg, { force: true });
    if (latestPath) rmSync(latestPath, { force: true });

    if (args.layout && dmg.layout !== false) {
      runCommand('hdiutil', ['create', '-srcfolder', staging, '-volname', volumeName, '-fs', 'HFS+', '-format', 'UDRW', '-ov', tempDmg], { stdio: 'inherit' });
      if (existsSync(mountPoint)) {
        spawnSync('hdiutil', ['detach', mountPoint, '-quiet'], { stdio: 'ignore' });
      }
      runCommand('hdiutil', ['attach', tempDmg, '-mountpoint', mountPoint, '-readwrite', '-noverify', '-noautoopen', '-quiet'], { stdio: 'inherit' });
      const scriptPath = join(staging, 'finder-layout.applescript');
      writeFinderLayoutScript(scriptPath, volumeName, dmg, apps, backgroundEnabled);
      try {
        runCommand('osascript', [scriptPath], { stdio: 'inherit' });
      } finally {
        try {
          runCommand('hdiutil', ['detach', mountPoint, '-quiet'], { stdio: 'inherit' });
        } catch {
          runCommand('hdiutil', ['detach', mountPoint, '-force', '-quiet'], { stdio: 'inherit' });
        }
      }
      runCommand('hdiutil', ['convert', tempDmg, '-format', 'UDZO', '-o', dmgPath, '-quiet'], { stdio: 'inherit' });
    } else {
      runCommand('hdiutil', ['create', '-srcfolder', staging, '-volname', volumeName, '-format', 'UDZO', '-ov', dmgPath], { stdio: 'inherit' });
    }

    if (!args.skipSign && context.signingIdentity) {
      runCommand('codesign', ['--force', '--timestamp', '--sign', context.signingIdentity, dmgPath], { stdio: 'inherit' });
    } else {
      process.stdout.write('==> Skipping DMG signing\n');
    }

    if (!args.skipNotarize) {
      if (!context.signingIdentity) {
        throw new Error('notarization requires a Developer ID signing identity');
      }
      if (!context.notaryProfile) {
        throw new Error('notarization requires --notary-profile or configured signing.notaryProfileEnv');
      }
      runCommand('xcrun', ['notarytool', 'submit', dmgPath, '--keychain-profile', context.notaryProfile, '--wait'], { stdio: 'inherit' });
      runCommand('xcrun', ['stapler', 'staple', dmgPath], { stdio: 'inherit' });
    } else {
      process.stdout.write('==> Skipping notarization\n');
    }

    if (latestPath) cpSync(dmgPath, latestPath);
    process.stdout.write(`==> DMG ready: ${displayPath(dmgPath)}\n`);
    if (latestPath) process.stdout.write(`==> Latest alias: ${displayPath(latestPath)}\n`);
    return dmgPath;
  } finally {
    rmSync(tempDmg, { force: true });
    if (!args.keepStaging) {
      rmSync(staging, { recursive: true, force: true });
    } else {
      process.stdout.write(`==> Preserved DMG staging: ${staging}\n`);
    }
  }
}

function resolveVersion(config, args, configDir) {
  if (args.version?.trim()) return args.version.trim();
  if (process.env.VERSION?.trim()) return process.env.VERSION.trim();
  if (config.version?.trim()) return config.version.trim();
  const packageJson = rel(configDir, config.packageJson ?? 'package.json');
  if (packageJson && existsSync(packageJson)) {
    const parsed = readJson(packageJson);
    if (parsed.version?.trim()) return parsed.version.trim();
  }
  return '0.1.0';
}

async function runMacos(args) {
  if (!args.configPath) throw new Error('--config is required');
  const configPath = resolve(process.cwd(), args.configPath);
  const configDir = dirname(configPath);
  const raw = readJson(configPath);
  const config = raw.macos ?? raw;
  const version = resolveVersion(config, args, configDir);
  const local = args.local || config.local === true;
  const signingIdentity = args.skipSign
    ? ''
    : resolveSigningIdentity(args, config);
  const requireIdentity = args.requireSignIdentity || (config.signing?.requireIdentity === true && !local);

  args.skipNotarize = args.skipNotarize || local || config.signing?.skipNotarize === true;
  if (requireIdentity && !signingIdentity) {
    throw new Error('No signing identity found. Pass --sign-identity, set the configured identity env var, or use --local.');
  }

  const context = {
    configDir,
    version,
    productName: config.productName ?? 'Hudson App',
    minimumSystemVersion: config.minimumSystemVersion ?? '14.0',
    distDir: rel(configDir, config.distDir ?? 'dist'),
    signingIdentity,
    notaryProfile: args.notaryProfile
      ?? (config.signing?.notaryProfileEnv ? process.env[config.signing.notaryProfileEnv] : undefined)
      ?? process.env.HUDSONKIT_NOTARY_PROFILE
      ?? process.env.HKIT_NOTARY_PROFILE
      ?? config.signing?.notaryProfile,
  };

  mkdirSync(context.distDir, { recursive: true });
  process.stdout.write(`==> Packaging ${context.productName} ${context.version}\n`);
  process.stdout.write(`==> Config: ${displayPath(configPath)}\n`);
  process.stdout.write(`==> Dist: ${displayPath(context.distDir)}\n`);
  if (!args.skipSign) process.stdout.write(`==> Signing: ${context.signingIdentity || 'ad-hoc'}\n`);

  const apps = buildApps(config, args, context);
  createDmg(config, args, context, apps);
}

export async function run(argv) {
  const args = parse(argv);
  if (args.help) {
    process.stdout.write(USAGE);
    return;
  }
  if (args._err) {
    process.stderr.write(`package: ${args._err}\n\n${USAGE}`);
    process.exit(2);
  }
  if (args.target !== 'macos') {
    process.stderr.write(`package: unknown target "${args.target}". Use macos.\n\n${USAGE}`);
    process.exit(2);
  }

  await runMacos(args);
}

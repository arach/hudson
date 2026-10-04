import { execFileSync, spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildAppBundle,
  normalizeResourcePaths,
  planAppResources,
} from '../src/commands/package.mjs';

const canSign = process.platform === 'darwin'
  && spawnSync('xcrun', ['-f', 'cc'], { stdio: 'ignore' }).status === 0;

let root;

function write(path, contents) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, contents);
}

function compileExecutable(path) {
  mkdirSync(join(path, '..'), { recursive: true });
  execFileSync('xcrun', ['cc', '-x', 'c', '-', '-o', path], { input: 'int main(void) { return 0; }\n' });
}

function context() {
  return {
    configDir: root,
    version: '1.2.3',
    minimumSystemVersion: '14.0',
    signingIdentity: '-',
  };
}

function build(app, bundlePath = join(root, 'dist', `${app.name}.app`)) {
  return buildAppBundle(app, bundlePath, { skipSign: false, keepStaging: false }, context(), []);
}

function sealedFiles(bundlePath) {
  const plist = execFileSync(
    'plutil',
    ['-extract', 'files2', 'xml1', '-o', '-', join(bundlePath, 'Contents', '_CodeSignature', 'CodeResources')],
    { encoding: 'utf8' },
  );
  return Array.from(plist.matchAll(/^\t<key>(.+)<\/key>$/gm), match => match[1]);
}

function verify(bundlePath) {
  return spawnSync('codesign', ['--verify', '--deep', '--strict', bundlePath], { encoding: 'utf8' });
}

function allFiles(dir) {
  return readdirSync(dir, { recursive: true })
    .map(entry => join(dir, entry))
    .filter(path => statSync(path).isFile());
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'hkit-resources-'));
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

describe('hkit package resources config', () => {
  it('normalizes resource paths and rejects malformed configuration', () => {
    expect(normalizeResourcePaths({})).toEqual([]);
    expect(normalizeResourcePaths({ resources: ['  .build/release/App_App.bundle  '] }))
      .toEqual(['.build/release/App_App.bundle']);
    expect(() => normalizeResourcePaths({ name: 'App', resources: 'App_App.bundle' }))
      .toThrow('resources for App must be an array of paths');
    expect(() => normalizeResourcePaths({ name: 'App', resources: [{ source: 'x' }] }))
      .toThrow('resources[0] for App must be a non-empty path');
  });

  it('maps each resource to Contents/Resources under its own basename', () => {
    write(join(root, '.build', 'release', 'App_App.bundle', 'Contents', 'Info.plist'), 'x');
    write(join(root, 'assets', 'notice.txt'), 'x');
    const bundlePath = join(root, 'dist', 'App.app');

    const plan = planAppResources(
      { name: 'App', resources: ['.build/release/App_App.bundle', 'assets/notice.txt'] },
      bundlePath,
      context(),
    );

    expect(plan.map(entry => entry.destination)).toEqual([
      join(bundlePath, 'Contents', 'Resources', 'App_App.bundle'),
      join(bundlePath, 'Contents', 'Resources', 'notice.txt'),
    ]);
  });

  it('rejects missing inputs, duplicate names, icon collisions, and self-containing sources', () => {
    write(join(root, 'a', 'shared.json'), '{}');
    write(join(root, 'b', 'shared.json'), '{}');
    write(join(root, 'art', 'AppIcon.icns'), 'icns');
    const bundlePath = join(root, 'dist', 'App.app');

    expect(() => planAppResources({ name: 'App', resources: ['missing/App_App.bundle'] }, bundlePath, context()))
      .toThrow(`resource not found for App: ${join(root, 'missing', 'App_App.bundle')}`);
    expect(() => planAppResources({ name: 'App', resources: ['a/shared.json', 'b/shared.json'] }, bundlePath, context()))
      .toThrow('duplicate resource name for App: shared.json');
    expect(() => planAppResources({ name: 'App', icon: 'icon.png', resources: ['art/AppIcon.icns'] }, bundlePath, context()))
      .toThrow('collides with the generated app icon');
    mkdirSync(join(root, 'dist'), { recursive: true });
    expect(() => planAppResources({ name: 'App', resources: ['dist'] }, bundlePath, context()))
      .toThrow('contains the output bundle');
  });
});

// Real compile + codesign work; allow for a loaded machine.
describe.skipIf(!canSign)('hkit package resource bundling', { timeout: 60_000 }, () => {
  it('copies resource bytes into the app and helper before sealing their signatures', () => {
    const payload = Buffer.from([0, 1, 2, 254, 255, 10, 13]);
    compileExecutable(join(root, '.build', 'release', 'App'));
    compileExecutable(join(root, '.build', 'release', 'Helper'));
    write(join(root, '.build', 'release', 'App_App.bundle', 'Contents', 'Resources', 'model.bin'), payload);
    write(join(root, '.build', 'release', 'App_App.bundle', 'Contents', 'Info.plist'), '<plist version="1.0"><dict/></plist>\n');
    write(join(root, 'assets', 'notice.txt'), 'notice\n');
    write(join(root, '.build', 'release', 'Helper_Helper.bundle', 'Contents', 'Resources', 'helper.json'), '{"ok":true}\n');

    const bundlePath = join(root, 'dist', 'App.app');
    build({
      name: 'App',
      bundleIdentifier: 'dev.hudson.test.app',
      binaryPath: '.build/release/App',
      resources: ['.build/release/App_App.bundle', 'assets/notice.txt'],
      embeddedHelpers: [{
        name: 'Helper',
        bundleIdentifier: 'dev.hudson.test.helper',
        binaryPath: '.build/release/Helper',
        resources: ['.build/release/Helper_Helper.bundle'],
      }],
    }, bundlePath);

    const resources = join(bundlePath, 'Contents', 'Resources');
    const helperPath = join(bundlePath, 'Contents', 'Library', 'LoginItems', 'Helper.app');
    expect(readFileSync(join(resources, 'App_App.bundle', 'Contents', 'Resources', 'model.bin'))).toEqual(payload);
    expect(readFileSync(join(resources, 'notice.txt'), 'utf8')).toBe('notice\n');
    expect(readFileSync(join(helperPath, 'Contents', 'Resources', 'Helper_Helper.bundle', 'Contents', 'Resources', 'helper.json'), 'utf8'))
      .toBe('{"ok":true}\n');

    // Each signature seals the resources, which is only possible if they
    // were in place when codesign ran.
    expect(sealedFiles(bundlePath)).toEqual(expect.arrayContaining([
      'Resources/App_App.bundle/Contents/Resources/model.bin',
      'Resources/notice.txt',
    ]));
    expect(sealedFiles(helperPath)).toContain('Resources/Helper_Helper.bundle/Contents/Resources/helper.json');
    expect(verify(bundlePath).status).toBe(0);
    expect(verify(helperPath).status).toBe(0);

    // The build machine's paths stay out of the shipped metadata.
    for (const file of allFiles(bundlePath).filter(path => !path.includes('/MacOS/'))) {
      expect(readFileSync(file, 'utf8')).not.toContain(root);
    }

    // Negative control: a resource changed after signing breaks the seal.
    appendFileSync(join(resources, 'notice.txt'), 'tampered\n');
    expect(verify(bundlePath).status).not.toBe(0);
  });

  it('fails before assembling anything when a helper resource is missing', () => {
    compileExecutable(join(root, '.build', 'release', 'App'));
    write(join(root, 'assets', 'notice.txt'), 'notice\n');
    const bundlePath = join(root, 'dist', 'App.app');

    expect(() => build({
      name: 'App',
      bundleIdentifier: 'dev.hudson.test.app',
      binaryPath: '.build/release/App',
      resources: ['assets/notice.txt'],
      embeddedHelpers: [{
        name: 'Helper',
        bundleIdentifier: 'dev.hudson.test.helper',
        binaryPath: '.build/release/App',
        resources: ['.build/release/Helper_Helper.bundle'],
      }],
    }, bundlePath)).toThrow('resource not found for Helper');
    expect(existsSync(bundlePath)).toBe(false);
  });

  it('rejects resource symlinks that point back into the build machine', () => {
    compileExecutable(join(root, '.build', 'release', 'App'));
    write(join(root, 'secret.txt'), 'secret\n');
    write(join(root, 'App_App.bundle', 'Contents', 'Resources', 'real.txt'), 'real\n');
    symlinkSync('real.txt', join(root, 'App_App.bundle', 'Contents', 'Resources', 'alias.txt'));
    symlinkSync(join(root, 'secret.txt'), join(root, 'App_App.bundle', 'Contents', 'Resources', 'leak.txt'));

    expect(() => build({
      name: 'App',
      bundleIdentifier: 'dev.hudson.test.app',
      binaryPath: '.build/release/App',
      resources: ['App_App.bundle'],
    })).toThrow(/resource symlink .*leak\.txt points outside the resource/);

    rmSync(join(root, 'App_App.bundle', 'Contents', 'Resources', 'leak.txt'));
    const bundlePath = build({
      name: 'App',
      bundleIdentifier: 'dev.hudson.test.app',
      binaryPath: '.build/release/App',
      resources: ['App_App.bundle'],
    }).bundlePath;
    expect(readFileSync(join(bundlePath, 'Contents', 'Resources', 'App_App.bundle', 'Contents', 'Resources', 'alias.txt'), 'utf8'))
      .toBe('real\n');
    expect(verify(bundlePath).status).toBe(0);
  });
});

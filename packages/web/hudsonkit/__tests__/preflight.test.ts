import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';

const cli = resolve(__dirname, '../bin/hudsonkit.mjs');
const tempRoots: string[] = [];

function makeTempRoot() {
  const root = mkdtempSync(join(tmpdir(), 'hudsonkit-preflight-'));
  tempRoots.push(root);
  return root;
}

function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

function makeInstalledStyles(consumer: string) {
  const styles = join(consumer, 'node_modules/hudsonkit/dist/styles.css');
  mkdirSync(dirname(styles), { recursive: true });
  writeFileSync(styles, '');
}

function runPreflight(consumer: string) {
  const output = execFileSync(process.execPath, [cli, 'preflight', '--cwd', consumer, '--json', '--no-color'], {
    encoding: 'utf8',
  });
  return JSON.parse(output) as { findings: Array<{ id: string; severity: string; detail?: string; fix?: string }> };
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('hudsonkit preflight external workspace detection', () => {
  test('reports an external hudsonkit workspace consumed through workspace:*', () => {
    const root = makeTempRoot();
    const consumer = join(root, 'consumer');
    const hudsonkit = join(root, 'hudsonkit');
    writeJson(join(consumer, 'package.json'), {
      name: 'consumer',
      workspaces: ['../hudsonkit'],
      dependencies: { hudsonkit: 'workspace:*' },
    });
    writeJson(join(hudsonkit, 'package.json'), { name: 'hudsonkit' });
    makeInstalledStyles(consumer);

    const result = runPreflight(consumer);
    const finding = result.findings.find(item => item.id === 'workspace-dep-to-external-source');

    expect(finding).toMatchObject({ severity: 'HIGH' });
    expect(finding?.detail).toContain('outside the consumer root');
    expect(finding?.fix).toContain('sealed');

    const failed = spawnSync(
      process.execPath,
      [cli, 'preflight', '--cwd', consumer, '--json', '--no-color', '--fail-on-risk'],
      { encoding: 'utf8' },
    );
    expect(failed.status).toBe(1);
    expect(JSON.parse(failed.stdout).findings).toContainEqual(expect.objectContaining({
      id: 'workspace-dep-to-external-source',
    }));
  });

  test('supports object-form workspaces', () => {
    const root = makeTempRoot();
    const consumer = join(root, 'consumer');
    const hudsonkit = join(root, 'hudsonkit');
    writeJson(join(consumer, 'package.json'), {
      name: 'consumer',
      workspaces: { packages: ['../hudsonkit'] },
      devDependencies: { hudsonkit: 'workspace:*' },
    });
    writeJson(join(hudsonkit, 'package.json'), { name: 'hudsonkit' });
    makeInstalledStyles(consumer);

    expect(runPreflight(consumer).findings).toContainEqual(expect.objectContaining({
      id: 'workspace-dep-to-external-source',
      severity: 'HIGH',
    }));
  });

  test('does not report internal workspaces or non-workspace dependencies', () => {
    const root = makeTempRoot();
    const internalConsumer = join(root, 'internal-consumer');
    writeJson(join(internalConsumer, 'package.json'), {
      name: 'consumer',
      workspaces: ['packages/hudsonkit'],
      dependencies: { hudsonkit: 'workspace:*' },
    });
    writeJson(join(internalConsumer, 'packages/hudsonkit/package.json'), { name: 'hudsonkit' });
    makeInstalledStyles(internalConsumer);

    const externalConsumer = join(root, 'external-consumer');
    writeJson(join(externalConsumer, 'package.json'), {
      name: 'consumer',
      workspaces: ['../hudsonkit'],
      dependencies: { hudsonkit: '^0.3.3' },
    });
    writeJson(join(root, 'hudsonkit/package.json'), { name: 'hudsonkit' });
    makeInstalledStyles(externalConsumer);

    for (const consumer of [internalConsumer, externalConsumer]) {
      expect(runPreflight(consumer).findings).not.toContainEqual(expect.objectContaining({
        id: 'workspace-dep-to-external-source',
      }));
    }
  });
});

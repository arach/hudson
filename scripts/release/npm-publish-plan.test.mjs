import { describe, expect, test } from 'bun:test';
import { planPackagePublish } from './npm-publish-plan.mjs';

function metadata(latest, versions = []) {
  return {
    versions: Object.fromEntries(versions.map(version => [version, {}])),
    'dist-tags': latest ? { latest } : {},
  };
}

describe('npm publish planner', () => {
  test('skips an exact version without retargeting latest', () => {
    expect(planPackagePublish({
      packageName: 'hudsonkit',
      localVersion: '0.4.0',
      distTag: 'latest',
      metadata: metadata('0.5.0', ['0.4.0', '0.5.0']),
    }).action).toBe('skip');
  });

  test('publishes only a stable version newer than latest', () => {
    expect(planPackagePublish({
      packageName: 'hudsonkit',
      localVersion: '0.4.0',
      distTag: 'latest',
      metadata: metadata('0.3.5', ['0.3.5']),
    })).toMatchObject({ action: 'publish', reason: 'advances latest from 0.3.5' });

    expect(() => planPackagePublish({
      packageName: 'hudsonkit',
      localVersion: '0.3.4',
      distTag: 'latest',
      metadata: metadata('0.3.5', ['0.3.5']),
    })).toThrow('would move latest backward');
  });

  test('requires an explicit monotonic tag for prereleases', () => {
    expect(() => planPackagePublish({
      packageName: 'hudsonkit',
      localVersion: '0.5.0-beta.1',
      distTag: 'latest',
      metadata: metadata('0.4.0', ['0.4.0']),
    })).toThrow('requires an explicit non-latest dist-tag');

    expect(planPackagePublish({
      packageName: 'hudsonkit',
      localVersion: '0.5.0-beta.2',
      distTag: 'next',
      metadata: {
        versions: { '0.5.0-beta.1': {} },
        'dist-tags': { latest: '0.4.0', next: '0.5.0-beta.1' },
      },
    }).action).toBe('publish');
  });

  test('rejects stable releases on prerelease tags and malformed versions', () => {
    expect(() => planPackagePublish({
      packageName: 'hudsonkit',
      localVersion: '0.5.0',
      distTag: 'next',
      metadata: metadata('0.4.0', ['0.4.0']),
    })).toThrow('stable and must publish to the latest');

    expect(() => planPackagePublish({
      packageName: 'hudsonkit',
      localVersion: 'next',
      distTag: 'latest',
      metadata: metadata('0.4.0', ['0.4.0']),
    })).toThrow('not a strict semantic version');
  });
});

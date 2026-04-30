import { describe, expect, it } from 'vitest';
import type { HudsonWorkspace } from 'hudsonkit';
import { uniqueWorkspaces } from '../../app/apps/registry-utils';

function workspace(id: string): HudsonWorkspace {
  return {
    id,
    name: id,
    mode: 'canvas',
    apps: [],
  };
}

describe('workspace registry utils', () => {
  it('keeps workspace ids unique and reports duplicates', () => {
    const duplicates: Parameters<NonNullable<Parameters<typeof uniqueWorkspaces>[1]>>[0][] = [];

    const result = uniqueWorkspaces(
      [
        { workspace: workspace('hudson-os'), source: 'core' },
        { workspace: workspace('logo-studio'), source: 'core' },
        { workspace: workspace('logo-studio'), source: 'local' },
        { workspace: workspace('developer-mode'), source: 'local' },
      ],
      duplicate => duplicates.push(duplicate),
    );

    expect(result.map(candidate => candidate.id)).toEqual(['hudson-os', 'logo-studio', 'developer-mode']);
    expect(duplicates).toEqual([
      { id: 'logo-studio', keptSource: 'core', skippedSource: 'local' },
    ]);
  });
});

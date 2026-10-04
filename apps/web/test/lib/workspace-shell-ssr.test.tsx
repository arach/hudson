// @vitest-environment node
/**
 * Characterization test — SSR smoke (plan §4.6, risk R5).
 *
 * renderToString of WorkspaceShell in a REAL node environment (no jsdom, no
 * window, no localStorage): the render must not throw and must not touch
 * storage or the network. This pins the useHydrated/render-phase-restore
 * timing through the usePersistentState unification — during SSR the
 * hydration gate reports false, so no storage read can happen before the
 * client mounts.
 */
import React from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceShell } from '../../../../packages/web/hudsonkit/src/workspace';
import { makeTestWorkspace } from '../helpers/workspaceShellFixture';

describe('WorkspaceShell SSR smoke', () => {
  beforeEach(() => {
    // Prove nothing in the render path touches these: install throwing
    // stand-ins so any accidental use becomes a hard failure. (Recent Node
    // versions ship a real global localStorage, so its mere presence can't
    // be asserted — access is what matters.)
    vi.stubGlobal('fetch', vi.fn(() => {
      throw new Error('fetch must not be called during SSR render');
    }));
    vi.stubGlobal(
      'localStorage',
      new Proxy(
        {},
        {
          get() {
            throw new Error('localStorage must not be touched during SSR render');
          },
        },
      ),
    );
  });

  it('renderToString renders all app content without window/localStorage', () => {
    const fixture = makeTestWorkspace();

    expect(typeof window).toBe('undefined');

    const html = renderToString(
      <WorkspaceShell
        workspaces={[fixture.workspace]}
        defaultWorkspaceId="test"
        bootMode="none"
        persistSession
      />,
    );

    expect(html.length).toBeGreaterThan(0);
    // The server-rendered markup includes every activated app's Content slot.
    // (React inserts <!-- --> between text segments, so match the testids.)
    expect(html).toContain('data-testid="content-alpha"');
    expect(html).toContain('data-testid="content-beta"');
    expect(html).toContain('data-testid="content-gamma"');
    // No network during render (effects don't run server-side).
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('SSR uses initial values (not stored ones) — every Provider renders exactly once', () => {
    const fixture = makeTestWorkspace();

    renderToString(
      <WorkspaceShell
        workspaces={[fixture.workspace]}
        defaultWorkspaceId="test"
        bootMode="none"
        persistSession
      />,
    );

    for (const spy of Object.values(fixture.spies)) {
      // Server render: one render pass per Provider, no mount effects.
      expect(spy.renders).toHaveLength(1);
      expect(spy.mountCount).toBe(0);
      expect(spy.renders[0]).toEqual({
        disabled: false,
        visible: true,
        focused: spy.appId === 'alpha',
      });
    }
  });

  it('keeps focused panel content between the shell header and status bar', () => {
    const fixture = makeTestWorkspace();
    const config = fixture.workspace.apps[0];
    const workspace = {
      ...fixture.workspace,
      mode: 'panel' as const,
      apps: [{ ...config, app: {
        ...config.app,
        mode: 'panel' as const,
        hooks: { ...config.app.hooks, useLayoutMode: () => 'focus' as const },
      } }],
    };
    const html = renderToString(
      <WorkspaceShell workspaces={[workspace]} defaultWorkspaceId="test" bootMode="none" />,
    );
    const world = html.match(/<div[^>]*data-hudson-world[^>]*>/)?.[0];
    expect(world).toBeDefined();
    expect(world).toContain('absolute');
    expect(world).toMatch(/top:[1-9]\d*px/);
    expect(world).toMatch(/bottom:[1-9]\d*px/);
    expect(world).toContain('left:0');
    expect(world).toContain('right:0');
    expect(html).toContain('data-testid="content-alpha"');
  });

  it('honors server-provided initialState during SSR (initialState wins over defaults)', () => {
    const fixture = makeTestWorkspace();

    renderToString(
      <WorkspaceShell
        workspaces={[fixture.workspace]}
        defaultWorkspaceId="test"
        bootMode="none"
        persistSession
        initialState={{
          activeWorkspaceId: 'test',
          activatedAppIds: ['beta'],
          focusedAppId: 'beta',
          tileWindowBounds: {},
          theme: 'dark',
          template: 'hudson',
        }}
      />,
    );

    expect(fixture.spies.beta.renders[0]).toEqual({
      disabled: false,
      visible: true,
      focused: true,
    });
    expect(fixture.spies.alpha.renders[0]).toEqual({
      disabled: false,
      visible: false,
      focused: false,
    });
  });
});

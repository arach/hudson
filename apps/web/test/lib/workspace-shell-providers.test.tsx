/**
 * Characterization tests — Provider runtime gating (plan §4.4, risk R4).
 *
 * The Provider + slots + hooks bridge is behavior-frozen through the
 * decomposition: every app's Provider is nested exactly once for the lifetime
 * of the workspace (INCLUDING disabled apps), and visibility/focus flow
 * through props — never through mount/unmount.
 */
import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WorkspaceShell } from '../../../../packages/web/hudsonkit/src/workspace';
import {
  installShellDomPolyfills,
  installWorkspaceFetchMock,
  makeTestWorkspace,
  resetShellEnvironment,
  WORKSPACE_STATE_ROUTE,
  type TestWorkspaceFixture,
  type WorkspaceFetchMock,
} from '../helpers/workspaceShellFixture';

installShellDomPolyfills();

let fetchMock: WorkspaceFetchMock | null = null;

beforeEach(() => {
  resetShellEnvironment();
});

afterEach(() => {
  cleanup();
  fetchMock?.restore();
  fetchMock = null;
});

async function mountShell(options: {
  fixture?: TestWorkspaceFixture;
  workspaceState?: { visibleApps?: string[]; disabledApps?: string[] };
  withStateRoute?: boolean;
} = {}) {
  fetchMock = installWorkspaceFetchMock({ workspaceState: options.workspaceState });
  const fixture = options.fixture ?? makeTestWorkspace();
  const environment = options.withStateRoute
    ? { routes: { workspaceState: WORKSPACE_STATE_ROUTE } }
    : undefined;
  const utils = render(
    <WorkspaceShell
      workspaces={[fixture.workspace]}
      defaultWorkspaceId="test"
      bootMode="none"
      persistSession
      environment={environment}
    />,
  );
  await act(async () => {});
  return { fixture, ...utils };
}

describe('WorkspaceShell provider runtime gating', () => {
  it('mounts every Provider exactly once and marks all default apps visible', async () => {
    const { fixture } = await mountShell();
    const { spies } = fixture;

    for (const spy of Object.values(spies)) {
      expect(spy.mountCount).toBe(1);
      expect(spy.latest()).toEqual({ disabled: false, visible: true, focused: spy.appId === 'alpha' });
    }
  });

  it('focuses only defaultFocusedAppId on mount', async () => {
    const { fixture } = await mountShell();
    expect(fixture.spies.alpha.latest()?.focused).toBe(true);
    expect(fixture.spies.beta.latest()?.focused).toBe(false);
    expect(fixture.spies.gamma.latest()?.focused).toBe(false);
  });

  it('keeps a disk-disabled app MOUNTED with disabled=true / visible=false', async () => {
    const { fixture } = await mountShell({
      withStateRoute: true,
      workspaceState: { disabledApps: ['gamma'], visibleApps: ['alpha', 'beta'] },
    });

    await waitFor(() => {
      expect(fixture.spies.gamma.latest()).toEqual({
        disabled: true,
        visible: false,
        focused: false,
      });
    });

    // The frozen invariant: the Provider stayed in the tree (no remount) and
    // its Content slot is NOT rendered. (waitFor: AnimatePresence keeps the
    // slot in the DOM during the 0.15s exit fade.)
    expect(fixture.spies.gamma.mountCount).toBe(1);
    await waitFor(() => {
      expect(screen.queryByTestId('content-gamma')).not.toBeInTheDocument();
    });

    // Enabled siblings unaffected.
    expect(fixture.spies.alpha.latest()).toEqual({ disabled: false, visible: true, focused: true });
    expect(fixture.spies.beta.latest()).toEqual({ disabled: false, visible: true, focused: false });
    expect(fixture.spies.alpha.mountCount).toBe(1);
    expect(fixture.spies.beta.mountCount).toBe(1);
  });

  it('honors visibleApps from the workspace-state route (visible=false stays mounted)', async () => {
    const { fixture } = await mountShell({
      withStateRoute: true,
      workspaceState: { visibleApps: ['alpha'] },
    });

    await waitFor(() => {
      expect(fixture.spies.beta.latest()?.visible).toBe(false);
    });
    expect(fixture.spies.alpha.latest()?.visible).toBe(true);
    expect(fixture.spies.gamma.latest()?.visible).toBe(false);
    // Hidden ≠ unmounted: Providers persist, only slots disappear.
    expect(fixture.spies.beta.mountCount).toBe(1);
    expect(screen.queryByTestId('content-beta')).not.toBeInTheDocument();
    expect(screen.getByTestId('content-alpha')).toBeInTheDocument();
  });

  it('flips focus via #focus= hash without remounting any Provider', async () => {
    const { fixture } = await mountShell();
    expect(fixture.spies.alpha.latest()?.focused).toBe(true);

    const mountsBefore = Object.fromEntries(
      Object.values(fixture.spies).map(spy => [spy.appId, spy.mountCount]),
    );

    await act(async () => {
      window.location.hash = '#focus=beta';
      window.dispatchEvent(new Event('hashchange'));
    });

    await waitFor(() => {
      expect(fixture.spies.beta.latest()?.focused).toBe(true);
    });
    expect(fixture.spies.alpha.latest()?.focused).toBe(false);
    expect(fixture.spies.gamma.latest()?.focused).toBe(false);

    for (const spy of Object.values(fixture.spies)) {
      expect(spy.mountCount).toBe(mountsBefore[spy.appId]);
    }
  });

  it('ignores #focus= for app ids not in the workspace', async () => {
    const { fixture } = await mountShell();

    await act(async () => {
      window.location.hash = '#focus=not-an-app';
      window.dispatchEvent(new Event('hashchange'));
    });

    expect(fixture.spies.alpha.latest()?.focused).toBe(true);
  });

  it('restores persisted focus into the inner shell but NOT into Provider props (wart)', async () => {
    localStorage.setItem('hudson.ws.test.focus', JSON.stringify('gamma'));
    const { fixture } = await mountShell();

    // The inner shell restored gamma as the focused app — the hash-sync
    // effect proves it.
    expect(window.location.hash).toBe('#focus=gamma');

    // Wart pinned on purpose: on mount, WorkspaceInner publishes the restored
    // focus (gamma) via onProviderRuntimeChange, but the OUTER shell's
    // default-reset effect runs after it (parent effects run after child
    // effects) and overwrites providerRuntime with the workspace default
    // (alpha). The publish effect's deps don't change again, so Provider
    // `focused` props stay on the default until the next focus interaction.
    // PR 10 (state/useFocusAndZOrder) must not silently change this.
    expect(fixture.spies.gamma.latest()?.focused).toBe(false);
    expect(fixture.spies.alpha.latest()?.focused).toBe(true);
    for (const spy of Object.values(fixture.spies)) {
      expect(spy.mountCount).toBe(1);
    }
  });

  it('mirrors focus into the URL hash on mount (hash sync contract)', async () => {
    await mountShell();
    // The hash-sync effect writes #focus={focusedAppId} via replaceState.
    expect(window.location.hash).toBe('#focus=alpha');
  });
});

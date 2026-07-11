import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceShell } from '../../../../packages/web/hudsonkit/src/workspace';
import {
  useHudsonAIRuntime,
  type HudsonAIRuntimeData,
} from '../../../../packages/web/hudsonkit/src/workspace/shell/HudsonAIRuntimeContext';
import {
  installShellDomPolyfills,
  installWorkspaceFetchMock,
  makeTestWorkspace,
  readStored,
  resetShellEnvironment,
  type TestWorkspaceFixture,
  type WorkspaceFetchMock,
} from '../helpers/workspaceShellFixture';

installShellDomPolyfills();

let fetchMock: WorkspaceFetchMock;
let runtime: HudsonAIRuntimeData | null = null;

interface StoredShellSettings {
  voice: {
    autoSend: boolean;
    speakReplies: boolean;
  };
}

function RuntimeProbe() {
  const currentRuntime = useHudsonAIRuntime();
  React.useEffect(() => {
    runtime = currentRuntime;
    return () => {
      if (runtime === currentRuntime) runtime = null;
    };
  }, [currentRuntime]);
  return <div data-testid="runtime-probe" />;
}

function getRuntime() {
  if (!runtime) throw new Error('Workspace AI runtime has not mounted');
  return runtime;
}

beforeEach(() => {
  resetShellEnvironment();
  fetchMock = installWorkspaceFetchMock();
  runtime = null;
});

afterEach(() => {
  cleanup();
  fetchMock.restore();
  runtime = null;
  vi.restoreAllMocks();
});

async function mountShell(options: { allWindowed?: boolean } = {}) {
  const fixture = makeTestWorkspace();
  fixture.apps.alpha.slots.Content = RuntimeProbe;

  if (options.allWindowed) {
    fixture.workspace.apps.forEach(config => {
      config.canvasMode = 'windowed';
      config.defaultWindowBounds = { x: 0, y: 0, w: 400, h: 300 };
    });
  }

  const utils = render(
    <WorkspaceShell
      workspaces={[fixture.workspace]}
      defaultWorkspaceId="test"
      bootMode="none"
      persistSession
    />,
  );
  await act(async () => {});
  expect(screen.getByTestId('runtime-probe')).toBeInTheDocument();
  return { fixture, ...utils };
}

async function callTool(name: string, args: Record<string, unknown>) {
  await act(async () => {
    await getRuntime().onToolCall(name, args);
  });
}

function openPalette() {
  fireEvent.keyDown(window, { key: 'k', metaKey: true });
}

function providerMounts(fixture: TestWorkspaceFixture) {
  return Object.fromEntries(
    Object.values(fixture.spies).map(spy => [spy.appId, spy.mountCount]),
  );
}

describe('WorkspaceShell stale-closure characterization', () => {
  it('disables, reactivates, shows, and hides an app without remounting Providers', async () => {
    const { fixture } = await mountShell();
    const mounts = providerMounts(fixture);

    await callTool('set_app_state', { appId: 'beta', disabled: true });
    await waitFor(() => {
      expect(fixture.spies.beta.latest()).toEqual({ disabled: true, visible: false, focused: false });
    });

    await callTool('set_app_state', { appId: 'beta', disabled: false });
    await waitFor(() => {
      expect(fixture.spies.beta.latest()).toEqual({ disabled: false, visible: true, focused: false });
    });

    await callTool('set_app_state', { appId: 'beta', visible: false });
    await waitFor(() => expect(fixture.spies.beta.latest()?.visible).toBe(false));

    await callTool('set_app_state', { appId: 'beta', visible: true });
    await waitFor(() => expect(fixture.spies.beta.latest()?.visible).toBe(true));

    await callTool('set_app_state', { appId: 'beta', visible: false });
    await waitFor(() => expect(fixture.spies.beta.latest()?.visible).toBe(false));

    expect(providerMounts(fixture)).toEqual(mounts);
  });

  it('keeps the focus-mode command label and action fresh after focus/fullscreen changes', async () => {
    const { fixture } = await mountShell();

    await act(async () => {
      window.location.hash = '#focus=beta';
      window.dispatchEvent(new Event('hashchange'));
    });
    await waitFor(() => expect(fixture.spies.beta.latest()?.focused).toBe(true));

    openPalette();
    fireEvent.click(screen.getByText('Focus App'));
    await waitFor(() => expect(window.location.hash).toBe('#focus=beta&fullscreen=beta'));

    openPalette();
    fireEvent.click(screen.getByText('Exit Focus Mode'));
    await waitFor(() => expect(window.location.hash).toBe('#focus=beta'));
  });

  it('auto-layout uses the current visible app set', async () => {
    await mountShell({ allWindowed: true });
    await callTool('set_app_state', { appId: 'gamma', visible: false });
    await waitFor(() => {
      expect(getRuntime().toolContext.workspace.visibleAppIds).not.toContain('gamma');
    });

    const setItem = vi.spyOn(localStorage, 'setItem');
    setItem.mockClear();

    openPalette();
    fireEvent.click(screen.getByText('Auto Layout Windows'));

    const tiledWindowKeys = setItem.mock.calls
      .map(([key]) => key)
      .filter(key => key.startsWith('hudson.ws.test.win.'));
    expect(tiledWindowKeys).toContain('hudson.ws.test.win.alpha');
    expect(tiledWindowKeys).toContain('hudson.ws.test.win.beta');
    expect(tiledWindowKeys).not.toContain('hudson.ws.test.win.gamma');
  });

  it('preserves prior nested shell settings across sequential tool calls', async () => {
    await mountShell();

    await callTool('set_shell_setting', { key: 'voice.autoSend', value: false });
    await waitFor(() => {
      expect(readStored<StoredShellSettings>('hudson.settings')?.voice.autoSend).toBe(false);
    });

    await callTool('set_shell_setting', { key: 'voice.speakReplies', value: true });
    await waitFor(() => {
      const settings = readStored<StoredShellSettings>('hudson.settings');
      expect(settings?.voice.autoSend).toBe(false);
      expect(settings?.voice.speakReplies).toBe(true);
    });
  });
});

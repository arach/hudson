import React from 'react';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HudsonApp, HudsonWorkspace } from 'hudsonkit';
import {
  normalizeWorkspaceAppIdList,
  normalizeWorkspaceAppOrder,
  toggleWorkspaceDisabledAppIds,
  useWorkspaceAppOrderState,
} from '../../packages/web/hudsonkit/src/workspace/shell/workspaceAppOrder';
import {
  WorkspaceManagerPanel,
  WorkspaceManagerProvider,
  type WorkspaceManagerData,
} from '../../packages/web/hudsonkit/src/workspace/shell/workspace-manager';
import { DEFAULT_SHELL_SETTINGS } from '../../packages/web/hudsonkit/src/workspace/shell/shellSettings';

const APP_IDS = ['assets', 'shaper', 'logo', 'hero', 'docs'];

function AppOrderProbe({
  workspaceId = 'atelier',
  appIds = APP_IDS,
  route = '/api/workspace-state',
}: {
  workspaceId?: string;
  appIds?: string[];
  route?: string;
}) {
  const { appOrder, setAppOrder } = useWorkspaceAppOrderState({
    workspaceId,
    appIds,
    persistSession: true,
    workspaceStateRoute: route || undefined,
    debounceMs: 0,
  });

  return (
    <div>
      <output data-testid="app-order">{appOrder.join(',')}</output>
      <button type="button" onClick={() => setAppOrder(['logo', 'assets', 'hero', 'shaper'])}>
        Sort custom
      </button>
    </div>
  );
}

function mockWorkspaceState(initial: Record<string, unknown>) {
  let state = { ...initial };
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as { state?: Record<string, unknown> };
      state = { ...state, ...(body.state ?? {}) };
    }
    return {
      ok: true,
      json: async () => ({ ...state }),
    } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, getState: () => ({ ...state }) };
}

function makeApp(id: string, name: string): HudsonApp {
  return {
    id,
    name,
    mode: 'panel',
    Provider: ({ children }) => <>{children}</>,
    slots: { Content: () => null },
    hooks: {
      useCommands: () => [],
      useStatus: () => ({ label: 'OK', color: 'emerald' }),
    },
  };
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('workspace app navigation order', () => {
  it('normalizes persisted appOrder by dropping deleted IDs, deduping, and appending new apps', () => {
    expect(normalizeWorkspaceAppOrder(['ghost', 'logo', 'assets', 'logo'], ['assets', 'shaper', 'logo', 'hero'])).toEqual([
      'logo',
      'assets',
      'shaper',
      'hero',
    ]);
  });

  it('persists reordered appOrder through routes.workspaceState and reloads it', async () => {
    const remote = mockWorkspaceState({ appOrder: ['assets', 'shaper', 'logo', 'hero', 'docs'] });
    const first = render(<AppOrderProbe />);

    await waitFor(() => expect(screen.getByTestId('app-order')).toHaveTextContent('assets,shaper,logo,hero,docs'));

    fireEvent.click(screen.getByRole('button', { name: 'Sort custom' }));

    await waitFor(() => expect(remote.getState().appOrder).toEqual(['logo', 'assets', 'hero', 'shaper', 'docs']));

    first.unmount();
    render(<AppOrderProbe />);

    await waitFor(() => expect(screen.getByTestId('app-order')).toHaveTextContent('logo,assets,hero,shaper,docs'));
  });

  it('uses localStorage for appOrder only when no workspaceState route exists', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem('hudson.ws.local.appOrder', JSON.stringify(['hero', 'assets']));

    render(<AppOrderProbe workspaceId="local" route="" />);

    await waitFor(() => expect(screen.getByTestId('app-order')).toHaveTextContent('hero,assets,shaper,logo,docs'));
    fireEvent.click(screen.getByRole('button', { name: 'Sort custom' }));

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('hudson.ws.local.appOrder') ?? '[]')).toEqual([
        'logo',
        'assets',
        'hero',
        'shaper',
        'docs',
      ]);
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normalizes hidden apps and supports restoring a hidden app ID', () => {
    expect(normalizeWorkspaceAppIdList(['logo', 'deleted', 'logo'], APP_IDS)).toEqual(['logo']);
    expect(toggleWorkspaceDisabledAppIds(['logo'], 'logo', APP_IDS)).toEqual([]);
    expect(toggleWorkspaceDisabledAppIds([], 'hero', APP_IDS)).toEqual(['hero']);
  });

  it('offers a restore path for apps hidden from navigation in the workspace manager', () => {
    const assets = makeApp('assets', 'Assets');
    const logo = makeApp('logo', 'Logo');
    const workspace: HudsonWorkspace = {
      id: 'atelier',
      name: 'Atelier',
      mode: 'canvas',
      apps: [
        { app: assets, canvasMode: 'windowed' },
        { app: logo, canvasMode: 'windowed' },
      ],
    };
    const onToggleAppDisabled = vi.fn();
    const value: WorkspaceManagerData = {
      workspace,
      workspaces: [workspace],
      activatedAppIds: new Set(['assets']),
      disabledAppIds: new Set(['logo']),
      appOrder: ['assets', 'logo'],
      focusedAppId: 'assets',
      onToggleAppVisibility: vi.fn(),
      onToggleAppDisabled,
      onReorderApps: vi.fn(),
      onFocusApp: vi.fn(),
      serviceRegistry: {
        catalog: [],
        records: {},
        history: [],
        autoStartIds: [],
        checkHealth: vi.fn(),
        checkAll: vi.fn(),
        executeAction: vi.fn(),
        toggleAutoStart: vi.fn(),
      },
      appSettings: [],
      windowBoundsMap: {},
      onResetLayout: vi.fn(),
      onFitAll: vi.fn(),
      shellSettings: DEFAULT_SHELL_SETTINGS,
      onUpdateShellSettings: vi.fn(),
      onResetShellSettings: vi.fn(),
    };

    render(
      <WorkspaceManagerProvider value={value}>
        <WorkspaceManagerPanel isOpen onClose={() => {}} defaultTab="overview" />
      </WorkspaceManagerProvider>,
    );

    expect(screen.getByText('Hidden from Navigation')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restore Logo to navigation' }));

    expect(onToggleAppDisabled).toHaveBeenCalledWith('logo');
  });
});

/**
 * Characterization-test fixture for the WorkspaceShell decomposition
 * (docs/plans/workspace-shell-decomposition.md §4).
 *
 * Provides:
 *  - makeTestApp()        — a minimal HudsonApp whose Provider records the
 *                           visible/focused/disabled props it receives
 *  - makeTestWorkspace()  — a 3-app workspace (windowed + native + Chat slot)
 *  - installWorkspaceFetchMock() — fetch stub for routes.workspaceState et al.
 *  - installShellDomPolyfills()  — jsdom gaps the shell mount path needs
 *
 * These helpers pin CURRENT behavior. Do not "fix" observed warts here —
 * the characterization suites assert them on purpose.
 */
import React, { useEffect, useMemo, type ReactNode } from 'react';
import { vi } from 'vitest';
import type { HudsonApp, HudsonWorkspace, WorkspaceAppConfig, CommandOption } from 'hudsonkit';

// ---------------------------------------------------------------------------
// Provider spy
// ---------------------------------------------------------------------------

export interface ProviderPropsRecord {
  disabled: boolean | undefined;
  visible: boolean | undefined;
  focused: boolean | undefined;
}

export interface ProviderSpy {
  appId: string;
  /** Number of times the Provider component mounted (should stay 1). */
  mountCount: number;
  /** Prop snapshot from every render, in order. */
  renders: ProviderPropsRecord[];
  /** Latest prop snapshot. */
  latest: () => ProviderPropsRecord | undefined;
}

function createProviderSpy(appId: string): ProviderSpy {
  return {
    appId,
    mountCount: 0,
    renders: [],
    latest() {
      return this.renders[this.renders.length - 1];
    },
  };
}

// ---------------------------------------------------------------------------
// Minimal HudsonApp factory
// ---------------------------------------------------------------------------

export interface TestAppOptions {
  id: string;
  name?: string;
  /** Add an app-level Chat slot (console AI routing). */
  withChatSlot?: boolean;
  /** Add a contextual left-panel slot. */
  withLeftPanel?: boolean;
}

export interface TestApp {
  app: HudsonApp;
  spy: ProviderSpy;
}

export function makeTestApp({
  id,
  name,
  withChatSlot = false,
  withLeftPanel = false,
}: TestAppOptions): TestApp {
  const spy = createProviderSpy(id);

  function Provider({
    children,
    disabled,
    visible,
    focused,
  }: {
    children: ReactNode;
    disabled?: boolean;
    visible?: boolean;
    focused?: boolean;
  }) {
    spy.renders.push({ disabled, visible, focused });
    useEffect(() => {
      spy.mountCount += 1;
    }, []);
    return <>{children}</>;
  }

  function Content() {
    return <div data-testid={`content-${id}`}>content:{id}</div>;
  }

  const Chat = withChatSlot
    ? function Chat() {
        return <div data-testid={`chat-${id}`}>chat:{id}</div>;
      }
    : undefined;

  const LeftPanel = withLeftPanel
    ? function LeftPanel() {
        return <div data-testid={`left-panel-${id}`}>left-panel:{id}</div>;
      }
    : undefined;

  const app: HudsonApp = {
    id,
    name: name ?? `Test ${id}`,
    mode: 'canvas',
    ...(LeftPanel ? {
      leftPanel: {
        title: `${name ?? `Test ${id}`} context`,
      },
    } : {}),
    Provider,
    slots: {
      Content,
      ...(LeftPanel ? { LeftPanel } : {}),
      ...(Chat ? { Chat } : {}),
    },
    hooks: {
      // Stable references — freshly-created arrays/objects per render are
      // tolerated by the shell, but keeping them module-stable avoids noise.
      useCommands: () =>
        useMemo<CommandOption[]>(
          () => [{ id: `${id}:ping`, label: `Ping ${id}`, action: () => {} }],
          [],
        ),
      useStatus: () => useMemo(() => ({ label: 'READY', color: 'emerald' as const }), []),
    },
  };

  return { app, spy };
}

// ---------------------------------------------------------------------------
// Workspace fixture — alpha (windowed), beta (native), gamma (native + Chat)
// ---------------------------------------------------------------------------

export const TEST_WORKSPACE_ID = 'test';

export interface TestWorkspaceFixture {
  workspace: HudsonWorkspace;
  spies: Record<string, ProviderSpy>;
  apps: Record<string, HudsonApp>;
}

export function makeTestWorkspace(
  overrides: Partial<Omit<HudsonWorkspace, 'apps'>> = {},
): TestWorkspaceFixture {
  const alpha = makeTestApp({ id: 'alpha', withLeftPanel: true });
  const beta = makeTestApp({ id: 'beta' });
  const gamma = makeTestApp({ id: 'gamma', withChatSlot: true });

  const apps: WorkspaceAppConfig[] = [
    {
      app: alpha.app,
      canvasMode: 'windowed',
      defaultWindowBounds: { x: -400, y: -300, w: 800, h: 600 },
    },
    { app: beta.app, canvasMode: 'native' },
    { app: gamma.app, canvasMode: 'native' },
  ];

  const workspace: HudsonWorkspace = {
    id: TEST_WORKSPACE_ID,
    name: 'Test Workspace',
    mode: 'canvas',
    apps,
    defaultFocusedAppId: 'alpha',
    ...overrides,
  };

  return {
    workspace,
    spies: { alpha: alpha.spy, beta: beta.spy, gamma: gamma.spy },
    apps: { alpha: alpha.app, beta: beta.app, gamma: gamma.app },
  };
}

// ---------------------------------------------------------------------------
// fetch mock for host routes (routes.workspaceState etc.)
// ---------------------------------------------------------------------------

export const WORKSPACE_STATE_ROUTE = '/api/workspace-state';

export interface WorkspaceFetchMockOptions {
  /** Response for GET {workspaceState}?id=… — shell reads visibleApps/disabledApps. */
  workspaceState?: { visibleApps?: string[]; disabledApps?: string[] };
}

export interface WorkspaceFetchMock {
  fetchMock: ReturnType<typeof vi.fn>;
  /** URLs of every request, in order. */
  requests: () => string[];
  /** Bodies of POSTs to the workspace-state route, parsed. */
  workspaceStatePosts: () => unknown[];
  restore: () => void;
}

export function installWorkspaceFetchMock(
  options: WorkspaceFetchMockOptions = {},
): WorkspaceFetchMock {
  const originalFetch = globalThis.fetch;
  const posts: unknown[] = [];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    let body: unknown = {};
    if (url.startsWith(WORKSPACE_STATE_ROUTE)) {
      if ((init?.method ?? 'GET').toUpperCase() === 'POST') {
        posts.push(JSON.parse(String(init?.body ?? '{}')));
        body = { ok: true };
      } else {
        body = options.workspaceState ?? {};
      }
    }
    return {
      ok: true,
      status: 200,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response;
  });

  globalThis.fetch = fetchMock as unknown as typeof fetch;

  return {
    fetchMock,
    requests: () =>
      fetchMock.mock.calls.map(([input]) => {
        const i = input as RequestInfo | URL;
        return typeof i === 'string' ? i : i instanceof URL ? i.href : (i as Request).url;
      }),
    workspaceStatePosts: () => [...posts],
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

// ---------------------------------------------------------------------------
// jsdom polyfills required by the shell mount path
// ---------------------------------------------------------------------------

/**
 * jsdom lacks a handful of APIs the mounted shell touches:
 *  - ResizeObserver (Minimap's canvas measures itself)
 *  - Element#scrollIntoView (CommandPalette selection tracking)
 *  - matchMedia (xterm boots inside AppShell's Assistant relay mode)
 * Install no-op stand-ins. Idempotent; safe to call in every suite.
 */
export function installShellDomPolyfills() {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
  if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'undefined') {
    const matchMediaStub = (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList;
    window.matchMedia = matchMediaStub as typeof window.matchMedia;
  }
  if (typeof globalThis.requestAnimationFrame === 'undefined') {
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 16)) as unknown as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((id: number) =>
      clearTimeout(id)) as unknown as typeof cancelAnimationFrame;
  }
}

/** Reset URL hash + storage between tests (the shell syncs #focus=… on mount). */
export function resetShellEnvironment() {
  window.history.replaceState(null, '', '/');
  localStorage.clear();
}

/** Enumerate stored keys through the Storage API (works with the test-setup
 *  localStorage mock, whose backing store is not an enumerable object). */
export function storageKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key !== null) keys.push(key);
  }
  return keys.sort();
}

/** Read + JSON-parse a stored value (null when absent). */
export function readStored<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  return raw === null ? null : (JSON.parse(raw) as T);
}

/** Collects `hudson:saved` CustomEvent keys for save-indicator contract tests. */
export function recordSavedEvents(): { keys: string[]; stop: () => void } {
  const keys: string[] = [];
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<{ key?: string }>).detail;
    if (detail?.key) keys.push(detail.key);
  };
  window.addEventListener('hudson:saved', listener);
  return { keys, stop: () => window.removeEventListener('hudson:saved', listener) };
}

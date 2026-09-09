/**
 * Characterization tests — WorkspaceShell localStorage key contracts.
 * PR 1 of docs/plans/workspace-shell-decomposition.md (§4.1).
 *
 * These pin CURRENT behavior, warts included. If a refactor changes any key
 * spelling, scoping, or write timing, a test here must fail. Never "fix" an
 * expected value here without an explicit product decision — a silently
 * changed key wipes users' saved layouts (risk R1 in the plan).
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// NOTE: imported through the real package path (not the `hudsonkit` alias):
// esbuild skips tsconfig discovery under node_modules, which breaks the
// automatic-JSX transform for kit files that don't `import React`.
import { WorkspaceShell } from '../../../../packages/web/hudsonkit/src/workspace';
import {
  installShellDomPolyfills,
  installWorkspaceFetchMock,
  makeTestWorkspace,
  readStored,
  recordSavedEvents,
  resetShellEnvironment,
  storageKeys,
  type WorkspaceFetchMock,
} from '../helpers/workspaceShellFixture';

installShellDomPolyfills();

let fetchMock: WorkspaceFetchMock;

beforeEach(() => {
  resetShellEnvironment();
  fetchMock = installWorkspaceFetchMock();
});

afterEach(() => {
  cleanup();
  fetchMock.restore();
});

async function mountShell(options: {
  persistSession?: boolean;
  sideNavMode?: 'legacy' | 'anchored';
} = {}) {
  const fixture = makeTestWorkspace();
  const utils = render(
    <WorkspaceShell
      workspaces={[fixture.workspace]}
      defaultWorkspaceId="test"
      bootMode="none"
      persistSession={options.persistSession ?? true}
      sideNavMode={options.sideNavMode}
    />,
  );
  // Flush post-mount microtasks (mocked fetch resolutions → setState).
  await act(async () => {});
  return { fixture, ...utils };
}

function openPalette() {
  fireEvent.keyDown(window, { key: 'k', metaKey: true });
}

function runPaletteCommand(label: string) {
  openPalette();
  fireEvent.click(screen.getByText(label));
}

/**
 * GOLDEN: every localStorage key written by a fresh mount of a 3-app canvas
 * workspace (id "test", one windowed app "alpha") with persistSession on.
 * Byte-identical spellings are the contract for shell-core/keys.ts (PR 4).
 */
const MOUNT_GOLDEN_KEYS = [
  'frame_sounds',
  'hudson.app.alpha.settings',
  'hudson.app.beta.settings',
  'hudson.app.gamma.settings',
  'hudson.minimap',
  'hudson.services',
  'hudson.services.autoStart',
  'hudson.services.history',
  'hudson.settings',
  'hudson.termH',
  'hudson.workspace-ai.dev-model-preset',
  'hudson.ws.test.appOrder',
  'hudson.ws.test.codeSheetWidth',
  'hudson.ws.test.codeWorkbenchChatWidth',
  'hudson.ws.test.codeWorkbenchEditorWidth',
  'hudson.ws.test.codeWorkbenchSize',
  'hudson.ws.test.decor',
  'hudson.ws.test.decor.selected',
  'hudson.ws.test.focus',
  'hudson.ws.test.guides',
  'hudson.ws.test.leftCollapsed',
  'hudson.ws.test.leftW',
  'hudson.ws.test.rightCollapsed',
  'hudson.ws.test.rightW',
  'hudson.ws.test.terminal',
  'hudson.ws.test.win.alpha',
];

describe('WorkspaceShell persistence keys (golden)', () => {
  it('mounts and renders all activated app content slots', async () => {
    await mountShell();
    expect(screen.getByTestId('content-alpha')).toBeInTheDocument();
    expect(screen.getByTestId('content-beta')).toBeInTheDocument();
    expect(screen.getByTestId('content-gamma')).toBeInTheDocument();
  });

  it('writes exactly the golden key set on mount', async () => {
    await mountShell();
    expect(storageKeys()).toEqual(MOUNT_GOLDEN_KEYS);
  });

  it('does NOT write pan/zoom keys at mount (they are 5s-debounced)', async () => {
    await mountShell();
    expect(localStorage.getItem('hudson.ws.test.pan')).toBeNull();
    expect(localStorage.getItem('hudson.ws.test.zoom')).toBeNull();
  });

  it('writes windowed-app bounds immediately under hudson.ws.{ws}.win.{app}', async () => {
    await mountShell();
    // Immediate (non-debounced) write of the default bounds on mount.
    expect(readStored('hudson.ws.test.win.alpha')).toEqual({ x: -400, y: -300, w: 800, h: 600 });
    // Native apps get no .win entry.
    expect(localStorage.getItem('hudson.ws.test.win.beta')).toBeNull();
    expect(localStorage.getItem('hudson.ws.test.win.gamma')).toBeNull();
  });

  it('scopes terminal-visible per workspace but terminal HEIGHT + minimap globally', async () => {
    await mountShell();
    // Wart pinned on purpose: `terminal` open/closed is per-workspace, but
    // `termH` and `minimap` are global spellings shared across workspaces.
    expect(localStorage.getItem('hudson.ws.test.terminal')).not.toBeNull();
    expect(localStorage.getItem('hudson.termH')).not.toBeNull();
    expect(localStorage.getItem('hudson.minimap')).not.toBeNull();
    expect(localStorage.getItem('hudson.ws.test.termH')).toBeNull();
    expect(localStorage.getItem('hudson.ws.test.minimap')).toBeNull();
  });

  it('Toggle Left Panel via palette flips hudson.ws.test.leftCollapsed and fires hudson:saved', async () => {
    await mountShell();
    expect(readStored('hudson.ws.test.leftCollapsed')).toBe(false);

    const saved = recordSavedEvents();
    runPaletteCommand('Toggle Left Panel');

    expect(readStored('hudson.ws.test.leftCollapsed')).toBe(true);
    expect(saved.keys).toContain('hudson.ws.test.leftCollapsed');
    saved.stop();
  });

  it('Toggle Right Panel via palette flips hudson.ws.test.rightCollapsed', async () => {
    await mountShell();
    expect(readStored('hudson.ws.test.rightCollapsed')).toBe(false);
    runPaletteCommand('Toggle Right Panel');
    expect(readStored('hudson.ws.test.rightCollapsed')).toBe(true);
  });

  it('Toggle Terminal via palette flips hudson.ws.test.terminal', async () => {
    await mountShell();
    expect(readStored('hudson.ws.test.terminal')).toBe(false);
    runPaletteCommand('Toggle Terminal');
    expect(readStored('hudson.ws.test.terminal')).toBe(true);
  });

  it('restores a pre-seeded workspace-scoped value instead of the default', async () => {
    localStorage.setItem('hudson.ws.test.leftW', JSON.stringify(333));
    await mountShell();
    // Restore happens render-phase; the persist effect writes the restored
    // value back — it must not be clobbered by the default (260).
    expect(readStored('hudson.ws.test.leftW')).toBe(333);
  });

  it('persistSession=false suppresses workspace-scoped keys but NOT ungated globals (wart)', async () => {
    await mountShell({ persistSession: false });
    const keys = storageKeys();
    // Wart pinned on purpose: WorkspaceDecorProvider is NOT gated by
    // persistSession — decor keys leak into storage even in embed sessions.
    expect(keys.filter(k => k.startsWith('hudson.ws.'))).toEqual([
      'hudson.ws.test.decor',
      'hudson.ws.test.decor.selected',
    ]);
    // Wart pinned on purpose: these hooks don't receive { enabled } gating,
    // so they persist even in non-persistent (embed) sessions today.
    expect(keys).toContain('hudson.services');
    expect(keys).toContain('hudson.services.autoStart');
    expect(keys).toContain('hudson.services.history');
    expect(keys).toContain('hudson.app.alpha.settings');
    expect(keys).toContain('hudson.workspace-ai.dev-model-preset');
    expect(keys).toContain('frame_sounds');
    // Wart pinned on purpose: the shell's OWN (gated) hudson.settings hook is
    // off, but useHudsonAI holds an ungated usePersistentState('hudson.settings', {})
    // which still writes `{}` to the global settings key in embed sessions.
    expect(keys).toContain('hudson.settings');
    expect(readStored('hudson.settings')).toEqual({});
    // Terminal height + minimap ARE gated off.
    expect(keys).not.toContain('hudson.termH');
    expect(keys).not.toContain('hudson.minimap');
  });
});

describe('WorkspaceShell anchored side navigation', () => {
  it('keeps primary destinations and focused-app context in separate rails', async () => {
    await mountShell({ sideNavMode: 'anchored' });

    const primary = screen.getByRole('navigation', { name: 'Workspace destinations' });
    expect(within(primary).getByRole('button', { name: 'Home' })).toBeInTheDocument();
    expect(within(primary).getByRole('button', { name: 'Test alpha' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('complementary', { name: 'Test alpha context' })).toBeInTheDocument();
    expect(screen.getByTestId('left-panel-alpha')).toBeVisible();

    const primaryToggle = screen.getByRole('button', { name: 'Toggle primary navigation' });
    expect(screen.getAllByRole('button', { name: 'Toggle primary navigation' })).toHaveLength(1);
    expect(primaryToggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(primaryToggle);
    expect(primaryToggle).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(within(primary).getByRole('button', { name: 'Test beta' }));
    expect(within(primary).getByRole('button', { name: 'Test beta' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.queryByRole('complementary', { name: 'Test alpha context' })).not.toBeInTheDocument();
  });
});

describe('WorkspaceShell command palette (behavior-level, survives a11y rework)', () => {
  it('Cmd+K opens the palette (adds one input), executing a command closes it', async () => {
    await mountShell();
    const inputsBefore = document.querySelectorAll('input').length;

    openPalette();
    const inputsOpen = document.querySelectorAll('input').length;
    expect(inputsOpen).toBe(inputsBefore + 1);

    // Command labels from shell + app hooks are both present.
    expect(screen.getByText('Toggle Left Panel')).toBeInTheDocument();
    expect(screen.getByText('Ping alpha')).toBeInTheDocument();
    expect(screen.getByText('Ping gamma')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Toggle Left Panel'));
    expect(document.querySelectorAll('input').length).toBe(inputsBefore);
  });

  it('Escape in the palette input closes the palette', async () => {
    await mountShell();
    const inputsBefore = document.querySelectorAll('input').length;

    openPalette();
    const inputs = Array.from(document.querySelectorAll('input'));
    expect(inputs.length).toBe(inputsBefore + 1);
    // The palette input is the newly added one — Escape on it closes.
    const paletteInput = inputs[inputs.length - 1];
    fireEvent.keyDown(paletteInput, { key: 'Escape' });
    expect(document.querySelectorAll('input').length).toBe(inputsBefore);
  });
});

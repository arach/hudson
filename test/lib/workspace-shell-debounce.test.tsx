/**
 * Characterization tests — WorkspaceShell debounce timings (plan §4.3, risk R2).
 *
 * Pins two engineered timings that must survive the decomposition byte-for-byte:
 *  - BOUNDS_FLUSH_MS  = 500  — window bounds live in a ref; the state flush
 *    that feeds the minimap indicators is debounced at 500ms.
 *  - PERSIST_DEBOUNCE_MS = 5000 — pan/zoom persist to localStorage 5s after
 *    the last change, plus an immediate flush-on-unmount.
 *
 * Note on §4.3 adaptation: the plan suggested asserting the minimap rect;
 * that works in jsdom (the rect divs carry percentage geometry inline), so we
 * assert both the debounce timing AND the percentage math.
 */
import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceShell } from '@/packages/web/hudsonkit/src/workspace';
import {
  installShellDomPolyfills,
  installWorkspaceFetchMock,
  makeTestWorkspace,
  readStored,
  resetShellEnvironment,
  type WorkspaceFetchMock,
} from '../helpers/workspaceShellFixture';

installShellDomPolyfills();

let fetchMock: WorkspaceFetchMock;

beforeEach(() => {
  vi.useFakeTimers();
  resetShellEnvironment();
  fetchMock = installWorkspaceFetchMock();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  fetchMock.restore();
});

async function mountShell() {
  // leftNavigation 'on': the minimap lives in the left panel footer, and the
  // default ('hidden') canvas workspace renders no left panel at all.
  const fixture = makeTestWorkspace({ leftNavigation: 'on' });
  const utils = render(
    <WorkspaceShell
      workspaces={[fixture.workspace]}
      defaultWorkspaceId="test"
      bootMode="none"
      persistSession
    />,
  );
  await act(async () => {}); // flush mocked-fetch microtasks
  return { fixture, ...utils };
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** Window indicator rects inside the minimap: percentage-positioned divs that
 *  are siblings of the [data-frame-element="minimap-viewport"] rectangle. */
function minimapWindowRects(container: HTMLElement): HTMLElement[] {
  const viewport = container.querySelector('[data-frame-element="minimap-viewport"]');
  const canvas = viewport?.parentElement;
  if (!canvas) return [];
  return Array.from(canvas.children).filter(
    (el): el is HTMLElement =>
      el instanceof HTMLElement && el.style.left.endsWith('%') && el.style.width.endsWith('%'),
  );
}

describe('window-bounds flush debounce (BOUNDS_FLUSH_MS = 500)', () => {
  it('shows no minimap window rect before 500ms, then flushes with % geometry', async () => {
    const { container } = await mountShell();

    // WindowedApp reported alpha's bounds on mount, but the state flush is
    // debounced — the minimap must NOT have an indicator yet.
    expect(minimapWindowRects(container)).toHaveLength(0);

    advance(499);
    expect(minimapWindowRects(container)).toHaveLength(0);

    advance(2); // crosses BOUNDS_FLUSH_MS
    const rects = minimapWindowRects(container);
    expect(rects).toHaveLength(1);

    // Geometry contract: percentage of the 4000-unit world centered at 0.
    // alpha bounds { x:-400, y:-300, w:800, h:600 } →
    //   left  = (−400+2000)/4000 = 40%   top    = (−300+2000)/4000 = 42.5%
    //   width = 800/4000        = 20%   height = 600/4000         = 15%
    expect(rects[0].style.left).toBe('40%');
    expect(rects[0].style.top).toBe('42.5%');
    expect(rects[0].style.width).toBe('20%');
    expect(rects[0].style.height).toBe('15%');
  });

  it('renders exactly one rect (only the windowed app reports bounds)', async () => {
    const { container } = await mountShell();
    advance(600);
    expect(minimapWindowRects(container)).toHaveLength(1);
  });
});

describe('pan/zoom persist debounce (PERSIST_DEBOUNCE_MS = 5000)', () => {
  it('writes hudson.ws.{ws}.pan/.zoom only after 5000ms', async () => {
    await mountShell();

    expect(localStorage.getItem('hudson.ws.test.pan')).toBeNull();
    expect(localStorage.getItem('hudson.ws.test.zoom')).toBeNull();

    advance(4999);
    expect(localStorage.getItem('hudson.ws.test.pan')).toBeNull();
    expect(localStorage.getItem('hudson.ws.test.zoom')).toBeNull();

    advance(2); // crosses PERSIST_DEBOUNCE_MS
    expect(readStored('hudson.ws.test.pan')).toEqual({ x: 0, y: 0 });
    expect(readStored('hudson.ws.test.zoom')).toBe(1);
  });

  it('flushes pan/zoom immediately on unmount (flush-on-unmount contract)', async () => {
    const { unmount } = await mountShell();

    expect(localStorage.getItem('hudson.ws.test.pan')).toBeNull();

    act(() => {
      unmount();
    });

    // No timer advance — the unmount cleanup wrote the current values.
    expect(readStored('hudson.ws.test.pan')).toEqual({ x: 0, y: 0 });
    expect(readStored('hudson.ws.test.zoom')).toBe(1);
  });

  it('starts from workspace defaultPan/defaultScale when provided', async () => {
    const fixture = makeTestWorkspace({ defaultPan: { x: 120, y: -60 }, defaultScale: 0.75 });
    const { unmount } = render(
      <WorkspaceShell
        workspaces={[fixture.workspace]}
        defaultWorkspaceId="test"
        bootMode="none"
        persistSession
      />,
    );
    await act(async () => {});

    act(() => {
      unmount();
    });
    expect(readStored('hudson.ws.test.pan')).toEqual({ x: 120, y: -60 });
    expect(readStored('hudson.ws.test.zoom')).toBe(0.75);
  });
});

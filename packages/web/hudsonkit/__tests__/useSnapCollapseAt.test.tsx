import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PENDING_PROGRAMMATIC_WIDTH_CLEAR_MS,
  useSnapCollapseAt,
  type UseSnapCollapseAtOptions,
} from '../src/components/nav/useSnapCollapseAt';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const NATURAL = { collapsed: 292, expanded: 396 } as const;
const SNAP_AT = 344;
const HYSTERESIS = 12;

type HostProps = Omit<UseSnapCollapseAtOptions, 'naturalWidths' | 'snapCollapseAt' | 'hysteresis'> & {
  snapCollapseAt?: number;
  hysteresis?: number;
};

function Host({
  expanded,
  setOpen,
  width,
  setWidth,
  snapCollapseAt = SNAP_AT,
  hysteresis = HYSTERESIS,
}: HostProps) {
  useSnapCollapseAt({
    expanded,
    setOpen,
    width,
    setWidth,
    snapCollapseAt,
    hysteresis,
    naturalWidths: NATURAL,
  });
  return null;
}

describe('useSnapCollapseAt — 180ms anti-strand belt', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('clears pendingProgrammaticWidth when responsivePanelMax clamps below natural expanded (LIVE)', () => {
    // LIVE edge case (Iris adoption review): responsivePanelMax: true on a
    // narrow viewport where AppShell clamps max below natural expanded (396).
    // setWidth(396) never settles → without the belt, pendingProgrammaticWidth
    // stays armed and drag-to-morph silently disables until the next toggle.
    // Iris's min/max config masks this; small windows hit it.
    // Fixture: clamp max to 360 (< 396).
    const setOpen = vi.fn();
    const setWidth = vi.fn();
    const CLAMP_MAX = 360; // e.g. AppShell responsive cap below NATURAL.expanded

    const { rerender, unmount } = render(
      <Host expanded={false} setOpen={setOpen} width={292} setWidth={setWidth} />,
    );

    // Explicit morph toggle (⌘B) arms pending for natural expanded width.
    rerender(<Host expanded={true} setOpen={setOpen} width={292} setWidth={setWidth} />);
    expect(setWidth).toHaveBeenCalledWith(NATURAL.expanded);
    expect(NATURAL.expanded).toBe(396);
    expect(CLAMP_MAX).toBeLessThan(NATURAL.expanded);

    // AppShell clamp: live width stuck at max — never reaches pending target.
    expect(Math.abs(CLAMP_MAX - NATURAL.expanded)).toBeGreaterThan(1);
    rerender(<Host expanded={true} setOpen={setOpen} width={CLAMP_MAX} setWidth={setWidth} />);

    // Drag below collapse threshold while guard is still armed — morph blocked.
    setOpen.mockClear();
    const collapseAt = SNAP_AT - HYSTERESIS; // 332
    rerender(
      <Host expanded={true} setOpen={setOpen} width={collapseAt - 10} setWidth={setWidth} />,
    );
    expect(setOpen).not.toHaveBeenCalled();

    // Just under the belt: still armed.
    act(() => {
      vi.advanceTimersByTime(PENDING_PROGRAMMATIC_WIDTH_CLEAR_MS - 1);
    });
    setOpen.mockClear();
    rerender(
      <Host expanded={true} setOpen={setOpen} width={collapseAt - 11} setWidth={setWidth} />,
    );
    expect(setOpen).not.toHaveBeenCalled();

    // Cross the bound → guard clears within PENDING_PROGRAMMATIC_WIDTH_CLEAR_MS.
    act(() => {
      vi.advanceTimersByTime(1);
    });
    // Subsequent drag still morphs.
    setOpen.mockClear();
    rerender(
      <Host expanded={true} setOpen={setOpen} width={collapseAt - 12} setWidth={setWidth} />,
    );
    expect(setOpen).toHaveBeenCalledWith(false);

    unmount();
  });

  it('clears the anti-strand timer on unmount (no stray fire)', () => {
    const setOpen = vi.fn();
    const setWidth = vi.fn();
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');

    const { rerender, unmount } = render(
      <Host expanded={false} setOpen={setOpen} width={292} setWidth={setWidth} />,
    );
    rerender(<Host expanded={true} setOpen={setOpen} width={292} setWidth={setWidth} />);
    expect(setWidth).toHaveBeenCalledWith(NATURAL.expanded);

    const clearCallsBefore = clearSpy.mock.calls.length;
    unmount();
    expect(clearSpy.mock.calls.length).toBeGreaterThan(clearCallsBefore);

    // Advancing past the bound after unmount must not throw / re-arm morph.
    setOpen.mockClear();
    act(() => {
      vi.advanceTimersByTime(PENDING_PROGRAMMATIC_WIDTH_CLEAR_MS + 50);
    });
    expect(setOpen).not.toHaveBeenCalled();

    clearSpy.mockRestore();
  });

  it('settle-only clear still wins when width reaches natural within the bound', () => {
    const setOpen = vi.fn();
    const setWidth = vi.fn();

    const { rerender } = render(
      <Host expanded={false} setOpen={setOpen} width={292} setWidth={setWidth} />,
    );
    rerender(<Host expanded={true} setOpen={setOpen} width={292} setWidth={setWidth} />);

    // Width settles to natural immediately — pending clears via abs<=1 path.
    rerender(
      <Host expanded={true} setOpen={setOpen} width={NATURAL.expanded} setWidth={setWidth} />,
    );

    // Drag below collapse threshold well before the belt fires → morph live.
    setOpen.mockClear();
    const collapseAt = SNAP_AT - HYSTERESIS;
    rerender(
      <Host expanded={true} setOpen={setOpen} width={collapseAt - 5} setWidth={setWidth} />,
    );
    expect(setOpen).toHaveBeenCalledWith(false);
  });
});

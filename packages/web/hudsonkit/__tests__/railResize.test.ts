import { describe, expect, it } from 'vitest';
import {
  HUD_RAIL_DRAG_COLLAPSE_MARGIN,
  HUD_RAIL_DRAG_EXPAND_TRAVEL,
  resolveHudRailResizeCommit,
} from '../src/components/nav/HudRailResizeHandle';

const geometry = {
  rememberedExpandedWidth: 260,
  collapsedWidth: 48,
  minExpandedWidth: 200,
  maxExpandedWidth: 360,
};

describe('resolveHudRailResizeCommit', () => {
  it('collapses only after dragging through the expanded minimum margin', () => {
    expect(
      resolveHudRailResizeCommit({
        ...geometry,
        startedCollapsed: false,
        rawWidth: geometry.minExpandedWidth - HUD_RAIL_DRAG_COLLAPSE_MARGIN,
      }),
    ).toEqual({ kind: 'collapse' });

    expect(
      resolveHudRailResizeCommit({
        ...geometry,
        startedCollapsed: false,
        rawWidth: geometry.minExpandedWidth - HUD_RAIL_DRAG_COLLAPSE_MARGIN + 1,
      }),
    ).toEqual({ kind: 'resize', width: geometry.minExpandedWidth });
  });

  it('requires deliberate outward travel before reviving a compact rail', () => {
    expect(
      resolveHudRailResizeCommit({
        ...geometry,
        startedCollapsed: true,
        rawWidth: geometry.collapsedWidth + HUD_RAIL_DRAG_EXPAND_TRAVEL - 1,
      }),
    ).toEqual({ kind: 'none' });

    expect(
      resolveHudRailResizeCommit({
        ...geometry,
        startedCollapsed: true,
        rawWidth: geometry.collapsedWidth + HUD_RAIL_DRAG_EXPAND_TRAVEL,
      }),
    ).toEqual({ kind: 'expand', width: geometry.rememberedExpandedWidth });
  });

  it('commits the dragged width when a compact rail reaches the resize band', () => {
    expect(
      resolveHudRailResizeCommit({
        ...geometry,
        startedCollapsed: true,
        rawWidth: 312,
      }),
    ).toEqual({ kind: 'expand', width: 312 });

    expect(
      resolveHudRailResizeCommit({
        ...geometry,
        startedCollapsed: true,
        rawWidth: 480,
      }),
    ).toEqual({ kind: 'expand', width: geometry.maxExpandedWidth });
  });
});

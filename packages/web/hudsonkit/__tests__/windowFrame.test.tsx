import { useState, type ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Home, Settings } from '../src/icons';
import {
  HudRailResizeHandle,
  HudSideNav,
  HudWindowFrame,
  HUD_WINDOW_TITLE_BAR_HEIGHT,
  type HudNavNode,
} from '../src/components/nav';
import { hasCallerPosition } from '../src/components/nav/HudRailResizeHandle';

vi.mock('../src/components/behaviors/HudTooltip', () => ({
  HudTooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

afterEach(cleanup);

const items: HudNavNode[] = [
  { id: 'general', label: 'General', icon: Home },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function Frame({ startCollapsed = false }: { startCollapsed?: boolean }) {
  const [collapsed, setCollapsed] = useState(startCollapsed);
  const [width, setWidth] = useState(196);
  return (
    <>
      <button type="button" onClick={() => setCollapsed((c) => !c)}>
        fold
      </button>
      <HudWindowFrame
        open={!collapsed}
        onOpenChange={(open) => setCollapsed(!open)}
        expandedWidth={width}
        onExpandedWidthChange={setWidth}
        defaultExpandedWidth={196}
        minExpandedWidth={132}
        maxExpandedWidth={300}
        collapsedWidth={52}
        keyboardShortcut={false}
        brand={<span>fab</span>}
        trafficLights={{ preview: true }}
        resizable
        contentAriaLabel="Page"
        navigation={
          <HudSideNav
            items={items}
            selectedId="general"
            header={<span>Settings header</span>}
            footer={<span>Footer brand</span>}
            collapsedHeader={false}
            collapsedFooter={false}
          />
        }
      >
        <p>Page body</p>
      </HudWindowFrame>
    </>
  );
}

const slot = (container: HTMLElement, name: string) =>
  container.querySelector<HTMLElement>(`[data-hud-window-frame-slot="${name}"]`)!;

describe('HudWindowFrame', () => {
  it('open: no title bar, the sidebar strip holds the lights, the sheet edge is a straight rule', () => {
    const { container } = render(<Frame />);
    const bar = slot(container, 'title-bar');
    expect(bar.style.height).toBe('0px');
    expect(bar).toHaveAttribute('aria-hidden', 'true');
    expect(slot(container, 'sidebar-inset').style.height).toBe('44px');
    expect(slot(container, 'navigation').style.width).toBe('196px');
    const sheet = screen.getByRole('main', { name: 'Page' });
    expect(sheet.style.borderTopLeftRadius).toBe('0px');
    expect(sheet.style.borderTopColor).toBe('transparent');
    expect(screen.getByText('Settings header')).toBeInTheDocument();
  });

  it('folded: title bar with the brand, rail loses header/footer, sheet gets its corner', () => {
    const { container } = render(<Frame startCollapsed />);
    const bar = slot(container, 'title-bar');
    expect(bar.style.height).toBe(`${HUD_WINDOW_TITLE_BAR_HEIGHT}px`);
    expect(bar).not.toHaveAttribute('aria-hidden', 'true');
    expect(bar).toHaveTextContent('fab');
    // The brand starts past the lights' reserve.
    expect((bar.firstElementChild as HTMLElement).style.paddingLeft).toBe('84px');
    expect(slot(container, 'sidebar-inset').style.height).toBe('0px');
    expect(slot(container, 'navigation').style.width).toBe('52px');
    expect(screen.queryByText('Settings header')).not.toBeInTheDocument();
    expect(screen.queryByText('Footer brand')).not.toBeInTheDocument();
    const sheet = screen.getByRole('main', { name: 'Page' });
    expect(sheet.style.borderTopLeftRadius).toContain('--hud-window-frame-radius');
    expect(slot(container, 'traffic-lights')).toBeInTheDocument();
  });

  it('shares one curve across bar height and rail width, and drops it while resizing', () => {
    const { container } = render(<Frame />);
    const bar = slot(container, 'title-bar');
    const rail = slot(container, 'navigation');
    expect(bar.style.transition).toContain('--hud-window-frame-duration');
    expect(rail.style.transition).toContain('--hud-window-frame-ease');

    const handle = screen.getByRole('separator', { name: 'Resize sidebar' });
    expect(handle).toHaveAttribute('aria-controls', rail.id);
    expect(handle).toHaveAttribute('data-line-visibility', 'hover');
    fireEvent.pointerDown(handle, { button: 0, clientX: 196, pointerId: 1 });
    expect(bar.style.transition).toBe('');
    expect(rail.style.transition).toBe('');
    fireEvent.pointerMove(window, { clientX: 240, pointerId: 1 });
    expect(rail.style.width).toBe('240px');
    fireEvent.pointerUp(window, { clientX: 240, pointerId: 1 });
    expect(rail.style.transition).toContain('--hud-window-frame-duration');
  });

  it('folds from the outside and via the resize handle', () => {
    const { container } = render(<Frame />);
    act(() => screen.getByRole('button', { name: 'fold' }).click());
    expect(slot(container, 'title-bar').style.height).toBe('38px');
    const handle = screen.getByRole('separator', { name: 'Resize sidebar' });
    fireEvent.keyDown(handle, { key: 'Enter' });
    expect(slot(container, 'title-bar').style.height).toBe('0px');
    expect(slot(container, 'navigation').style.width).toBe('196px');
  });

  it('trafficLights={false}: no strip, no stand-ins', () => {
    const { container } = render(
      <HudWindowFrame trafficLights={false} navigation={<HudSideNav items={items} />}>
        <p>x</p>
      </HudWindowFrame>,
    );
    expect(slot(container, 'sidebar-inset')).toBeNull();
    expect(slot(container, 'traffic-lights')).toBeNull();
  });
});

describe('HudRailResizeHandle friction fixes', () => {
  const base = {
    side: 'left' as const,
    collapsed: false,
    expandedWidth: 200,
    collapsedWidth: 48,
    defaultExpandedWidth: 200,
    minExpandedWidth: 160,
    maxExpandedWidth: 300,
    onCollapsedChange: () => {},
    onExpandedWidthChange: () => {},
  };

  it('leaves positioning to the caller', () => {
    expect(hasCallerPosition('absolute inset-y-0 w-2')).toBe(true);
    expect(hasCallerPosition('fixed!')).toBe(true);
    expect(hasCallerPosition('md:absolute w-2')).toBe(false);
    expect(hasCallerPosition('w-2', { position: 'absolute' })).toBe(true);
    expect(hasCallerPosition('w-2')).toBe(false);

    render(<HudRailResizeHandle {...base} className="absolute inset-y-0" label="a" />);
    render(<HudRailResizeHandle {...base} className="w-2" label="b" />);
    expect(screen.getByRole('separator', { name: 'a' }).className).not.toMatch(/(^|\s)relative(\s|$)/);
    expect(screen.getByRole('separator', { name: 'b' }).className).toMatch(/(^|\s)relative(\s|$)/);
  });

  it('lineVisibility controls the hairline', () => {
    const { container } = render(<HudRailResizeHandle {...base} lineVisibility="hover" />);
    const line = container.querySelector<HTMLElement>('[data-hud-rail-resize-line]')!;
    expect(line.className).toContain('bg-transparent');
    expect(line.className).toContain('group-hover/resize:bg-accent/55');
  });

  it('a click without a drag focuses the handle', () => {
    render(<HudRailResizeHandle {...base} />);
    const handle = screen.getByRole('separator');
    fireEvent.pointerDown(handle, { button: 0, clientX: 200, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 200, pointerId: 1 });
    expect(handle).toHaveFocus();
  });
});

describe('HudSideNav collapsed slots', () => {
  it('false hides; undefined falls back to the expanded slot', () => {
    const { rerender } = render(
      <HudSideNav items={items} collapsed header={<span>H</span>} footer={<span>F</span>} />,
    );
    expect(screen.getByText('H')).toBeInTheDocument();
    expect(screen.getByText('F')).toBeInTheDocument();
    rerender(
      <HudSideNav
        items={items}
        collapsed
        header={<span>H</span>}
        footer={<span>F</span>}
        collapsedHeader={false}
        collapsedFooter={false}
      />,
    );
    expect(screen.queryByText('H')).not.toBeInTheDocument();
    expect(screen.queryByText('F')).not.toBeInTheDocument();
  });
});

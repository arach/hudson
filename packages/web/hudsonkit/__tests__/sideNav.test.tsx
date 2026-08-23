import { useState, type ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Boxes, FileText, Home } from '../src/icons';
import {
  HudBreadcrumb,
  HudSideNav,
  HudSideNavProvider,
  HudSideNavLayout,
  HudSideNavContent,
  HudSideNavGroup,
  HudSideNavGroupLabel,
  HudSideNavMenu,
  HudSideNavMenuButton,
  HudSideNavMenuItem,
  HudSideNavTrigger,
  HudRailResizeHandle,
  HudSideRail,
  HUD_RAIL_DRAG_COLLAPSE_MARGIN,
  HUD_RAIL_DRAG_EXPAND_TRAVEL,
  resolveHudRailResizeCommit,
  useHudSideNav,
  type HudNavNode,
} from '../src/components/nav';

vi.mock('../src/components/behaviors/HudTooltip', () => ({
  HudTooltip: ({
    children,
    content,
    delay,
    side,
  }: {
    children: ReactNode;
    content: ReactNode;
    delay?: number;
    side?: string;
  }) => (
    <span
      data-tooltip-content={typeof content === 'string' ? content : 'rich-content'}
      data-tooltip-delay={delay}
      data-tooltip-side={side}
    >
      {children}
    </span>
  ),
}));

afterEach(cleanup);

const tree: HudNavNode[] = [
  { id: 'home', label: 'Home', icon: Home },
  {
    id: 'agents',
    label: 'Agents',
    icon: Boxes,
    count: 3,
    children: [
      {
        id: 'active',
        label: 'Active',
        children: [
          { id: 'atlas', label: 'Atlas', live: true },
          { id: 'echo', label: 'Echo' },
        ],
      },
      { id: 'archived', label: 'Archived' },
    ],
  },
  { id: 'docs', label: 'Docs', icon: FileText, disabled: true },
];

describe('HudSideNav (data-driven)', () => {
  it('renders destinations and reveals the selected node ancestors', () => {
    render(<HudSideNav items={tree} selectedId="atlas" />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Atlas')).toBeInTheDocument();
    const atlas = screen.getByText('Atlas').closest('button');
    expect(atlas).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: /Agents/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Active' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('reveals selected ancestors after uncontrolled selection changes', () => {
    const { rerender } = render(<HudSideNav items={tree} selectedId="home" />);
    expect(screen.queryByText('Atlas')).not.toBeInTheDocument();

    rerender(<HudSideNav items={tree} selectedId="atlas" />);

    expect(screen.getByText('Atlas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Agents/ })).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('button', { name: /Agents/ }));
    expect(screen.getByRole('button', { name: /Agents/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Atlas')).not.toBeInTheDocument();
  });

  it('selects and toggles disclosure in one click', () => {
    const onSelect = vi.fn();
    render(<HudSideNav items={tree} onSelect={onSelect} />);
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Agents'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'agents' }));
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('does not fire onSelect for a disabled node', () => {
    const onSelect = vi.fn();
    render(<HudSideNav items={tree} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Docs'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('keeps the expanded tree mounted behind the accessible compact rail', () => {
    const { container } = render(
      <HudSideNav items={tree} collapsed selectedId="home" ariaLabel="Rail" />,
    );
    const expandedPane = container.querySelector('[data-rail-content="expanded"]');
    expect(expandedPane).toHaveAttribute('aria-hidden', 'true');
    expect(expandedPane).toHaveAttribute('inert');
    const home = screen.getByRole('button', { name: 'Home' });
    expect(home).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Agents' })).toBeVisible();
  });

  it('accepts preconfigured React icon elements from Hudson app metadata', () => {
    render(
      <HudSideNav
        items={[
          {
            id: 'home',
            label: 'Home',
            icon: <Home data-testid="app-nav-icon" />,
          },
        ]}
      />,
    );
    expect(screen.getAllByTestId('app-nav-icon').map(icon => icon.getAttribute('width')).sort()).toEqual([
      '16',
      '18',
    ]);
  });

  it('wires settled-hover labels without an instant browser title', () => {
    render(<HudSideNav items={[{ id: 'home', label: 'Home', icon: Home }]} collapsed />);
    const home = screen.getByRole('button', { name: 'Home' });
    expect(home).not.toHaveAttribute('title');
    expect(home.closest('[data-tooltip-delay]')).toHaveAttribute('data-tooltip-delay', '500');
  });

  it('uses compact header and footer overrides without changing expanded chrome', () => {
    const { rerender } = render(
      <HudSideNav
        items={[{ id: 'home', label: 'Home', icon: Home }]}
        collapsed
        header={<span>Expanded brand</span>}
        collapsedHeader={<span>Compact brand</span>}
        footer={<span>Expanded status</span>}
        collapsedFooter={<span>Compact status</span>}
      />,
    );
    expect(screen.getByText('Compact brand')).toBeInTheDocument();
    expect(screen.getByText('Compact status')).toBeInTheDocument();
    expect(screen.queryByText('Expanded brand')).not.toBeInTheDocument();

    rerender(
      <HudSideNav
        items={[{ id: 'home', label: 'Home', icon: Home }]}
        collapsed={false}
        header={<span>Expanded brand</span>}
        collapsedHeader={<span>Compact brand</span>}
        footer={<span>Expanded status</span>}
        collapsedFooter={<span>Compact status</span>}
      />,
    );
    expect(screen.getByText('Expanded brand')).toBeInTheDocument();
    expect(screen.getByText('Expanded status')).toBeInTheDocument();
    expect(screen.queryByText('Compact brand')).not.toBeInTheDocument();
  });

  it('exposes a nav landmark with data-state', () => {
    render(<HudSideNav items={tree} ariaLabel="Workspace" />);
    const nav = screen.getByRole('navigation', { name: 'Workspace' });
    expect(nav).toHaveAttribute('data-state', 'expanded');
  });

  it('keeps selectionWash and rovingFocus off by default', () => {
    render(<HudSideNav items={tree} selectedId="home" ariaLabel="Defaults" />);
    const nav = screen.getByRole('navigation', { name: 'Defaults' });
    expect(nav).not.toHaveAttribute('data-selection-wash');
    // No roving handler means ArrowDown does not move focus — button still selected.
    const home = screen.getByRole('button', { name: 'Home' });
    home.focus();
    fireEvent.keyDown(nav, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(home);
  });

  it('opts into selectionWash and rovingFocus when requested', () => {
    render(
      <HudSideNav
        items={tree}
        selectedId="home"
        selectionWash
        rovingFocus
        rail
        ariaLabel="Opt-in"
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'Opt-in' });
    expect(nav).toHaveAttribute('data-selection-wash');
    const home = screen.getByRole('button', { name: 'Home' });
    home.focus();
    fireEvent.keyDown(nav, { key: 'ArrowDown' });
    // Next visible enabled button is Agents (Docs is later / disabled skipped).
    expect((document.activeElement as HTMLElement).textContent).toContain('Agents');
    fireEvent.keyDown(nav, { key: 'End' });
    // The mouse-only edge rail is tabIndex=-1 and must not enter roving focus.
    expect((document.activeElement as HTMLElement).textContent).toContain('Agents');
  });

  it('uses an explicit accessible label for rich collapsed labels', () => {
    render(
      <HudSideNav
        items={[
          {
            id: 'canvas',
            label: <span>Canvas</span>,
            accessibilityLabel: 'Canvas workspace',
          },
        ]}
        collapsed
      />,
    );
    expect(screen.getByRole('button', { name: 'Canvas workspace' })).toHaveTextContent('Ca');
  });
});

describe('HudSideNavProvider + primitives', () => {
  it('toggles collapse state and hides eyebrows in icon mode', () => {
    function Probe() {
      const { state } = useHudSideNav();
      return <span data-testid="state">{state}</span>;
    }
    render(
      <HudSideNavProvider collapsible="icon" defaultOpen>
        <Probe />
        <HudSideNavTrigger>Hudson</HudSideNavTrigger>
        <HudSideNav>
          <HudSideNavContent>
            <HudSideNavGroup>
              <HudSideNavGroupLabel>Agents</HudSideNavGroupLabel>
              <HudSideNavMenu>
                <HudSideNavMenuItem>
                  <HudSideNavMenuButton icon={Boxes} isActive live count={2}>
                    Atlas
                  </HudSideNavMenuButton>
                </HudSideNavMenuItem>
              </HudSideNavMenu>
            </HudSideNavGroup>
          </HudSideNavContent>
        </HudSideNav>
      </HudSideNavProvider>,
    );

    expect(screen.getByTestId('state')).toHaveTextContent('expanded');
    expect(screen.getByRole('button', { name: 'Toggle sidebar' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Toggle sidebar' })).toHaveTextContent('Hudson');
    // Group eyebrow visible while expanded.
    expect(screen.getByText('Agents')).toBeInTheDocument();
    const active = screen.getByText('Atlas').closest('button');
    expect(active).toHaveAttribute('data-active', '');

    fireEvent.click(screen.getByRole('button', { name: 'Toggle sidebar' }));
    expect(screen.getByTestId('state')).toHaveTextContent('collapsed');
    expect(screen.getByRole('button', { name: 'Toggle sidebar' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    // Eyebrow folds away in icon-collapsed mode.
    expect(screen.queryByText('Agents')).not.toBeInTheDocument();
  });

  it('honors collapsible="none" (toggle is a no-op)', () => {
    function Probe() {
      const { state } = useHudSideNav();
      return <span data-testid="state">{state}</span>;
    }
    render(
      <HudSideNavProvider collapsible="none">
        <Probe />
        <HudSideNavTrigger />
      </HudSideNavProvider>,
    );
    expect(screen.getByTestId('state')).toHaveTextContent('expanded');
    fireEvent.click(screen.getByRole('button', { name: 'Toggle sidebar' }));
    expect(screen.getByTestId('state')).toHaveTextContent('expanded');
  });

  it('renders composed asChild rows inside the provided element', () => {
    const onClick = vi.fn();
    render(
      <HudSideNavProvider>
        <HudSideNavMenu>
          <HudSideNavMenuItem>
            <HudSideNavMenuButton
              asChild
              isActive
              live
              count={2}
              icon={Boxes}
              expanded
              onClick={onClick}
            >
              <a href="#atlas">Atlas</a>
            </HudSideNavMenuButton>
          </HudSideNavMenuItem>
        </HudSideNavMenu>
      </HudSideNavProvider>,
    );
    const link = screen.getByRole('link', { name: /Atlas/ });
    expect(link).toHaveAttribute('href', '#atlas');
    expect(link).toHaveAttribute('data-active', '');
    expect(link).toHaveAttribute('aria-expanded', 'true');
    expect(link.querySelector('svg')).not.toBeNull();
    expect(link).toHaveTextContent('2');
    expect(link.querySelector('.animate-ping')).toHaveClass('motion-reduce:animate-none');
    fireEvent.click(link);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('folds asChild rows to icon plus accessible label in icon mode', () => {
    render(
      <HudSideNavProvider collapsible="icon" defaultOpen={false}>
        <HudSideNavMenu>
          <HudSideNavMenuItem>
            <HudSideNavMenuButton asChild icon={Boxes} count={2}>
              <a href="/atlas">Atlas</a>
            </HudSideNavMenuButton>
          </HudSideNavMenuItem>
        </HudSideNavMenu>
      </HudSideNavProvider>,
    );
    const link = screen.getByRole('link', { name: 'Atlas' });
    expect(link.querySelector('svg')).not.toBeNull();
    expect(link.querySelector('.sr-only')).toHaveTextContent('Atlas');
    expect(link).not.toHaveTextContent('2');
  });

  it('passes delay and mirrored placement to composed compact labels', () => {
    render(
      <HudSideNavProvider
        side="right"
        collapsible="icon"
        defaultOpen={false}
        keyboardShortcut={false}
        tooltipDelay={725}
      >
        <HudSideNavMenu>
          <HudSideNavMenuItem>
            <HudSideNavMenuButton icon={Boxes} tooltip="Agents">
              Agents
            </HudSideNavMenuButton>
          </HudSideNavMenuItem>
        </HudSideNavMenu>
      </HudSideNavProvider>,
    );

    const agents = screen.getByRole('button', { name: 'Agents' });
    const tooltipBoundary = agents.closest('[data-tooltip-delay]');
    expect(tooltipBoundary).toHaveAttribute('data-tooltip-content', 'Agents');
    expect(tooltipBoundary).toHaveAttribute('data-tooltip-delay', '725');
    expect(tooltipBoundary).toHaveAttribute('data-tooltip-side', 'left');
  });
});

describe('HudSideNavLayout + HudSideRail', () => {
  function LayoutHarness() {
    const [contextCollapsed, setContextCollapsed] = useState(true);
    return (
      <HudSideNavProvider
        collapsible="icon"
        defaultOpen={false}
        defaultExpandedWidth={280}
        collapsedWidth={48}
        keyboardShortcut={false}
        tooltipDelay={0}
      >
        <HudSideNavLayout
          resizable
          navigation={
            <HudSideNav
              items={[{ id: 'home', label: 'Home', icon: Home }]}
              selectedId="home"
            />
          }
          contextRail={
            <HudSideRail
              label="Projects"
              collapsed={contextCollapsed}
              onCollapsedChange={setContextCollapsed}
              resizable
              collapsedContent={<span>Context compact</span>}
              footer={<span>Context footer</span>}
            >
              <span data-testid="context-expanded">Expanded context</span>
            </HudSideRail>
          }
          contextRailAriaLabel="Project context"
          topRow={<div>Workspace header</div>}
          bottomBar={<div>Ready</div>}
          contentAriaLabel="Workspace"
        >
          <div>Canvas</div>
        </HudSideNavLayout>
      </HudSideNavProvider>
    );
  }

  it('anchors full-height navigation beside a separate keep-alive context rail', () => {
    const { container } = render(<LayoutHarness />);
    const layout = container.querySelector('[data-hud-side-nav-layout]');
    const rail = container.querySelector('[data-hud-side-rail]');
    const expandedContext = screen.getByTestId('context-expanded');

    expect(layout).toHaveAttribute('data-state', 'collapsed');
    expect(layout).toHaveStyle({
      gridTemplateColumns: '48px auto minmax(0, 1fr)',
      gridTemplateRows: 'var(--hud-side-nav-header-height) minmax(0, 1fr) 28px',
    });
    expect((layout as HTMLElement).style.getPropertyValue('--hud-side-nav-header-height')).toBe('48px');
    expect(screen.getByRole('complementary', { name: 'Project context' })).toBeInTheDocument();
    expect(screen.getByRole('main', { name: 'Workspace' })).toHaveTextContent('Canvas');
    expect(screen.getByText('Workspace header')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(rail).toHaveAttribute('data-state', 'collapsed');
    expect(rail).toHaveStyle({ width: '48px' });
    expect(expandedContext.closest('[data-rail-content="expanded"]')).toHaveAttribute('inert');

    fireEvent.click(screen.getByRole('button', { name: 'Expand Projects' }));

    expect(rail).toHaveAttribute('data-state', 'expanded');
    expect(rail).toHaveStyle({ width: '240px' });
    expect(screen.getByTestId('context-expanded')).toBe(expandedContext);
    expect(expandedContext.closest('[data-rail-content="expanded"]')).not.toHaveAttribute('inert');
    expect(screen.getByText('Context footer')).toBeVisible();
  });

  it('resizes and revives primary and context rails from the keyboard', () => {
    const { container } = render(<LayoutHarness />);
    const layout = container.querySelector('[data-hud-side-nav-layout]');
    const rail = container.querySelector('[data-hud-side-rail]');
    const primaryResize = screen.getByRole('separator', {
      name: 'Resize primary navigation',
    });
    const contextResize = screen.getByRole('separator', { name: 'Resize Projects' });

    fireEvent.keyDown(primaryResize, { key: 'ArrowRight' });
    expect(layout).toHaveAttribute('data-state', 'expanded');
    expect(layout).toHaveStyle({
      gridTemplateColumns: '280px auto minmax(0, 1fr)',
    });

    fireEvent.keyDown(primaryResize, { key: 'End' });
    expect(layout).toHaveStyle({
      gridTemplateColumns: '360px auto minmax(0, 1fr)',
    });
    fireEvent.doubleClick(primaryResize);
    expect(layout).toHaveStyle({
      gridTemplateColumns: '280px auto minmax(0, 1fr)',
    });

    fireEvent.keyDown(contextResize, { key: 'End' });
    expect(rail).toHaveAttribute('data-state', 'expanded');
    expect(rail).toHaveStyle({ width: '360px' });
    fireEvent.keyDown(contextResize, { key: ' ' });
    expect(rail).toHaveAttribute('data-state', 'collapsed');
    expect(rail).toHaveStyle({ width: '48px' });
  });

  it('resizes, collapses, revives, and cancels through the pointer lifecycle', () => {
    const { container } = render(<LayoutHarness />);
    const layout = container.querySelector('[data-hud-side-nav-layout]');
    const resize = screen.getByRole('separator', { name: 'Resize primary navigation' });

    fireEvent.keyDown(resize, { key: 'ArrowRight' });
    expect(layout).toHaveStyle({
      gridTemplateColumns: '280px auto minmax(0, 1fr)',
    });

    fireEvent.pointerDown(resize, { button: 0, clientX: 280 });
    expect(layout).toHaveAttribute('data-resizing');
    expect(document.body.style.cursor).toBe('ew-resize');
    expect(document.body.style.userSelect).toBe('none');
    fireEvent.pointerMove(window, { clientX: 330 });
    expect(layout).toHaveStyle({
      gridTemplateColumns: '330px auto minmax(0, 1fr)',
    });
    fireEvent.pointerUp(window, { clientX: 330 });
    expect(layout).not.toHaveAttribute('data-resizing');
    expect(document.body.style.cursor).toBe('');
    expect(document.body.style.userSelect).toBe('');

    fireEvent.pointerDown(resize, { button: 0, clientX: 330 });
    fireEvent.pointerMove(window, { clientX: 150 });
    fireEvent.pointerUp(window, { clientX: 150 });
    expect(layout).toHaveAttribute('data-state', 'collapsed');
    expect(layout).toHaveStyle({
      gridTemplateColumns: '48px auto minmax(0, 1fr)',
    });

    fireEvent.pointerDown(resize, { button: 0, clientX: 48 });
    fireEvent.pointerMove(window, { clientX: 72 });
    fireEvent.pointerUp(window, { clientX: 72 });
    expect(layout).toHaveAttribute('data-state', 'expanded');
    expect(layout).toHaveStyle({
      gridTemplateColumns: '330px auto minmax(0, 1fr)',
    });

    fireEvent.pointerDown(resize, { button: 0, clientX: 330 });
    fireEvent.pointerMove(window, { clientX: 300 });
    expect(layout).toHaveStyle({
      gridTemplateColumns: '300px auto minmax(0, 1fr)',
    });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(layout).toHaveStyle({
      gridTemplateColumns: '330px auto minmax(0, 1fr)',
    });
    expect(document.body.style.cursor).toBe('');
    expect(document.body.style.userSelect).toBe('');
  });

  it('derives every header and resize seam from a custom top-row height', () => {
    const { container } = render(
      <HudSideNavProvider collapsible="icon" keyboardShortcut={false}>
        <HudSideNavLayout
          topRowHeight={56}
          resizable
          navigation={<HudSideNav items={[{ id: 'home', label: 'Home', icon: Home }]} />}
          contextRail={
            <HudSideRail
              label="Projects"
              collapsed={false}
              onCollapsedChange={() => {}}
              resizable
            >
              Context
            </HudSideRail>
          }
          topRow="Header"
        >
          Canvas
        </HudSideNavLayout>
      </HudSideNavProvider>,
    );
    const layout = container.querySelector<HTMLElement>('[data-hud-side-nav-layout]')!;
    const contextHeader = container.querySelector<HTMLElement>('[data-hud-side-rail] > div')!;
    const contextResize = screen.getByRole('separator', { name: 'Resize Projects' });
    expect(layout.style.getPropertyValue('--hud-side-nav-header-height')).toBe('56px');
    expect(contextHeader.style.height).toContain('var(--hud-side-nav-header-height');
    expect(contextResize.style.top).toContain('var(--hud-side-nav-header-height');
  });

  it('does not commit a width on plain separator clicks and traps drag Escape', () => {
    const onCollapsedChange = vi.fn();
    const onExpandedWidthChange = vi.fn();
    const onResizingChange = vi.fn();
    const leakedEscape = vi.fn();
    render(
      <div id="rail-under-test">
        <HudRailResizeHandle
          side="left"
          collapsed={false}
          expandedWidth={260}
          collapsedWidth={48}
          defaultExpandedWidth={260}
          minExpandedWidth={200}
          maxExpandedWidth={360}
          onCollapsedChange={onCollapsedChange}
          onExpandedWidthChange={onExpandedWidthChange}
          onResizingChange={onResizingChange}
          controls="rail-under-test"
        />
      </div>,
    );
    const resize = screen.getByRole('separator', { name: 'Resize navigation' });
    expect(resize).toHaveAttribute('aria-controls', 'rail-under-test');
    expect(resize).toHaveAttribute('aria-valuemin', '48');

    fireEvent.pointerDown(resize, { button: 0, clientX: 260, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 260, pointerId: 1 });
    expect(onExpandedWidthChange).not.toHaveBeenCalled();
    expect(onCollapsedChange).not.toHaveBeenCalled();
    expect(onResizingChange.mock.calls.map(([value]) => value)).toEqual([true, false]);

    window.addEventListener('keydown', leakedEscape);
    fireEvent.pointerDown(resize, { button: 0, clientX: 260, pointerId: 2 });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(leakedEscape).not.toHaveBeenCalled();
    window.removeEventListener('keydown', leakedEscape);
  });

  it('mirrors the anchored geometry for a right-side primary rail', () => {
    const { container } = render(
      <HudSideNavProvider
        side="right"
        collapsible="icon"
        defaultOpen={false}
        collapsedWidth={48}
        keyboardShortcut={false}
      >
        <HudSideNavLayout
          navigation={<HudSideNav items={[{ id: 'home', label: 'Home', icon: Home }]} />}
          topRow={<span>Mirrored header</span>}
          bottomBar={<span>Mirrored status</span>}
        >
          <span>Detail</span>
        </HudSideNavLayout>
      </HudSideNavProvider>,
    );
    const layout = container.querySelector('[data-hud-side-nav-layout]');
    const topRow = container.querySelector('[data-hud-side-nav-slot=\"top-row\"]');
    const navigation = container.querySelector('[data-hud-side-nav-slot=\"navigation\"]');

    expect(layout).toHaveAttribute('data-side', 'right');
    expect(layout).toHaveStyle({
      gridTemplateColumns: 'minmax(0, 1fr) auto 48px',
    });
    expect(topRow).toHaveStyle({ gridColumn: '1 / 3' });
    expect(navigation).toHaveStyle({ gridColumn: '3' });
  });
});

describe('rail resize geometry', () => {
  const geometry = {
    rememberedExpandedWidth: 260,
    collapsedWidth: 48,
    minExpandedWidth: 200,
    maxExpandedWidth: 360,
  };

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
    ).toEqual({ kind: 'revert' });
    expect(
      resolveHudRailResizeCommit({
        ...geometry,
        startedCollapsed: true,
        rawWidth: geometry.collapsedWidth + HUD_RAIL_DRAG_EXPAND_TRAVEL,
      }),
    ).toEqual({ kind: 'expand', width: geometry.rememberedExpandedWidth });
  });

  it('commits and clamps compact drag widths inside the resize band', () => {
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

describe('HudBreadcrumb', () => {
  it('renders links and marks the current page', () => {
    render(
      <HudBreadcrumb
        items={[
          { id: 'home', label: 'Home', href: '/' },
          { id: 'settings', label: 'Settings', current: true },
        ]}
      />,
    );
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByText('Settings')).toHaveAttribute('aria-current', 'page');
  });
});

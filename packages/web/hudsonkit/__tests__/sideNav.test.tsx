import { useState } from 'react';
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
  HudSideRail,
  useHudSideNav,
  type HudNavNode,
} from '../src/components/nav';

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

  it('renders an icons-only rail via the legacy `collapsed` prop', () => {
    render(<HudSideNav items={tree} collapsed selectedId="home" ariaLabel="Rail" />);
    // Deeper tiers never render collapsed.
    expect(screen.queryByText('Agents')).not.toBeInTheDocument();
    const home = screen.getByRole('button', { name: 'Home' });
    expect(home).toHaveAttribute('aria-current', 'page');
  });

  it('removes the instant browser title from compact rail labels', () => {
    render(<HudSideNav items={[{ id: 'home', label: 'Home', icon: Home }]} collapsed />);
    expect(screen.getByRole('button', { name: 'Home' })).not.toHaveAttribute('title');
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
      gridTemplateRows: '48px minmax(0, 1fr) 28px',
    });
    expect(screen.getByRole('complementary', { name: 'Project context' })).toBeInTheDocument();
    expect(screen.getByRole('main', { name: 'Workspace' })).toHaveTextContent('Canvas');
    expect(screen.getByText('Workspace header')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(rail).toHaveAttribute('data-state', 'collapsed');
    expect(rail).toHaveStyle({ width: '48px' });
    expect(expandedContext.closest('[hidden]')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Expand Projects' }));

    expect(rail).toHaveAttribute('data-state', 'expanded');
    expect(rail).toHaveStyle({ width: '240px' });
    expect(screen.getByTestId('context-expanded')).toBe(expandedContext);
    expect(expandedContext.closest('[hidden]')).toBeNull();
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

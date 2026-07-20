import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Boxes, FileText, Home } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HudSideNav,
  HudSideNavProvider,
  HudSideNavContent,
  HudSideNavGroup,
  HudSideNavGroupLabel,
  HudSideNavMenu,
  HudSideNavMenuButton,
  HudSideNavMenuItem,
  HudSideNavTrigger,
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

  it('exposes a nav landmark with data-state', () => {
    render(<HudSideNav items={tree} ariaLabel="Workspace" />);
    const nav = screen.getByRole('navigation', { name: 'Workspace' });
    expect(nav).toHaveAttribute('data-state', 'expanded');
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
        <HudSideNavTrigger />
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
    // Group eyebrow visible while expanded.
    expect(screen.getByText('Agents')).toBeInTheDocument();
    const active = screen.getByText('Atlas').closest('button');
    expect(active).toHaveAttribute('data-active', '');

    fireEvent.click(screen.getByRole('button', { name: 'Toggle sidebar' }));
    expect(screen.getByTestId('state')).toHaveTextContent('collapsed');
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

  it('renders asChild menu buttons as the provided element', () => {
    render(
      <HudSideNavProvider>
        <HudSideNavMenu>
          <HudSideNavMenuItem>
            <HudSideNavMenuButton asChild isActive>
              <a href="/atlas">Atlas</a>
            </HudSideNavMenuButton>
          </HudSideNavMenuItem>
        </HudSideNavMenu>
      </HudSideNavProvider>,
    );
    const link = screen.getByRole('link', { name: 'Atlas' });
    expect(link).toHaveAttribute('href', '/atlas');
    expect(link).toHaveAttribute('data-active', '');
  });
});

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Boxes, FileText, Home } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HudSideNav, type HudNavNode } from '../src/components/nav';

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

describe('HudSideNav', () => {
  it('renders destinations and reveals the selected node ancestors', () => {
    render(<HudSideNav items={tree} selectedId="atlas" />);
    // Ancestors of the selected leaf (Agents → Active) are auto-expanded.
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Atlas')).toBeInTheDocument();
    const atlas = screen.getByText('Atlas').closest('button');
    expect(atlas).toHaveAttribute('aria-current', 'page');
  });

  it('selects and toggles disclosure in one click', () => {
    const onSelect = vi.fn();
    render(<HudSideNav items={tree} onSelect={onSelect} />);
    // Collapsed by default: the section's children are hidden.
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

  it('renders an icons-only rail in collapsed mode with tooltips', () => {
    render(<HudSideNav items={tree} collapsed selectedId="home" ariaLabel="Rail" />);
    // Deeper tiers never render collapsed.
    expect(screen.queryByText('Agents')).not.toBeInTheDocument();
    const home = screen.getByRole('button', { name: 'Home' });
    expect(home).toHaveAttribute('aria-current', 'page');
  });

  it('exposes a nav landmark with the supplied label', () => {
    render(<HudSideNav items={tree} ariaLabel="Workspace" />);
    expect(screen.getByRole('navigation', { name: 'Workspace' })).toBeInTheDocument();
  });
});

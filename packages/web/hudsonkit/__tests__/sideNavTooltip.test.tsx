import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Boxes, Home } from '../src/icons';

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

import {
  HudSideNav,
  HudSideNavMenu,
  HudSideNavMenuButton,
  HudSideNavMenuItem,
  HudSideNavProvider,
} from '../src/components/nav';

afterEach(cleanup);

describe('HudSideNav compact tooltip wiring', () => {
  it('passes the provider hover-intent delay to data-driven compact labels', () => {
    render(
      <HudSideNav
        items={[{ id: 'home', label: 'Home', icon: Home }]}
        collapsed
        tooltipDelay={640}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Home' }).closest('[data-tooltip-delay]'),
    ).toHaveAttribute('data-tooltip-delay', '640');
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

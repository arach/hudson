import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HudMenu,
  HudPopover,
  HudSelectBase,
  HudTooltip,
  HudTooltipProvider,
} from '../src/components/behaviors';

afterEach(cleanup);

describe('Hudson behavior wrappers', () => {
  it('runs menu actions from the shared popup register', async () => {
    const action = vi.fn();
    render(
      <HudMenu
        defaultOpen
        items={[
          { id: 'run', label: 'Run agent', shortcut: 'R', action },
          { type: 'separator' },
          {
            type: 'group',
            label: 'State',
            items: [{ id: 'stop', label: 'Stop', action: vi.fn() }],
          },
        ]}
      >
        <button type="button">Actions</button>
      </HudMenu>,
    );

    const item = await screen.findByRole('menuitem', { name: /Run agent/ });
    expect(screen.getByRole('menu', { name: 'Actions' })).toBeInTheDocument();
    expect(item).toHaveTextContent('R');
    fireEvent.click(item);
    expect(action).toHaveBeenCalledOnce();
  });

  it('opens and runs menu actions from the keyboard', async () => {
    const action = vi.fn();
    render(
      <HudMenu items={[{ id: 'run', label: 'Run agent', action }]}>
        <button type="button">Actions</button>
      </HudMenu>,
    );

    const trigger = screen.getByRole('button', { name: 'Actions' });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const item = await screen.findByRole('menuitem', { name: 'Run agent' });
    expect(item).toHaveFocus();
    fireEvent.keyDown(item, { key: 'Enter' });
    expect(action).toHaveBeenCalledOnce();
  });

  it('renders structured popover content without replacing its trigger', async () => {
    render(
      <HudPopover defaultOpen title="Agent" description="Current runtime" content={<p>Fable</p>}>
        <button type="button">Details</button>
      </HudPopover>,
    );

    expect(screen.getByRole('button', { name: 'Details' })).toBeInTheDocument();
    expect(await screen.findByText('Agent')).toBeInTheDocument();
    expect(screen.getByText('Current runtime')).toBeInTheDocument();
    expect(screen.getByText('Fable')).toBeInTheDocument();
  });

  it('bridges Base UI select changes to both Hudson callbacks', async () => {
    const onChange = vi.fn();
    const onValueChange = vi.fn();
    render(
      <HudSelectBase
        aria-label="Density"
        defaultValue="compact"
        options={[
          { value: 'compact', label: 'Compact' },
          { value: 'comfortable', label: 'Comfortable' },
        ]}
        onChange={onChange}
        onValueChange={onValueChange}
      />,
    );

    const trigger = screen.getByRole('combobox', { name: 'Density' });
    expect(trigger).toHaveTextContent('Compact');
    trigger.focus();
    fireEvent.click(trigger);
    const selectedOption = await screen.findByRole('option', { name: 'Compact' });
    const unselectedOption = screen.getByRole('option', { name: 'Comfortable' });
    expect(within(selectedOption).getByText('✓')).toHaveClass('opacity-100');
    expect(within(unselectedOption).getByText('✓')).toHaveClass('opacity-0');
    const option = unselectedOption;
    fireEvent.mouseMove(option);
    fireEvent.click(option);
    expect(onValueChange).toHaveBeenCalledWith('comfortable');
    expect(onChange).toHaveBeenCalledWith({ target: { value: 'comfortable' } });
  });

  it('keeps a disabled tooltip trigger intact and omits popup content', () => {
    render(
      <HudTooltipProvider>
        <HudTooltip disabled content="Inspect agent">
          <button type="button">Agent</button>
        </HudTooltip>
      </HudTooltipProvider>,
    );

    expect(screen.getByRole('button', { name: 'Agent' })).toBeInTheDocument();
    expect(screen.queryByText('Inspect agent')).not.toBeInTheDocument();
  });
});

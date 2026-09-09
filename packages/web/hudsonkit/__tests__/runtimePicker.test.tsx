import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';

import {
  RuntimeChip,
  RuntimePicker,
  type RuntimeEffort,
  type RuntimeHarness,
  type RuntimeSelection,
} from '../src/components/RuntimePicker';

afterEach(cleanup);

const harnesses: RuntimeHarness[] = [
  {
    id: 'claude',
    label: 'Claude Code',
    monogram: '*',
    models: [
      { id: 'opus-5', label: 'Opus', sublabel: '5', isDefault: true },
      { id: 'sonnet-4-6', label: 'Sonnet', sublabel: '4.6' },
    ],
  },
  {
    id: 'codex',
    label: 'Codex',
    monogram: '#',
    models: [
      { id: 'gpt-5.6-sol', label: '5.6', sublabel: 'sol', isDefault: true },
      { id: 'gpt-5.5-mini', label: '5.5', sublabel: 'mini' },
    ],
  },
  {
    id: 'kimi',
    label: 'Kimi',
    models: [{ id: 'auto', label: 'Auto', isDefault: true }],
    isAvailable: false,
  },
];

const efforts: RuntimeEffort[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'low', label: 'Low', harnesses: ['claude', 'codex'] },
  { id: 'medium', label: 'Medium', harnesses: ['claude', 'codex'], isDefault: true },
  { id: 'high', label: 'High', harnesses: ['claude'] },
];

function Harness({
  initial = { harnessId: 'claude', modelId: 'opus-5', effortId: 'auto' },
  efforts: effortList = efforts,
}: {
  initial?: RuntimeSelection;
  efforts?: RuntimeEffort[];
}) {
  const [value, setValue] = useState<RuntimeSelection>(initial);
  return (
    <div>
      <RuntimePicker harnesses={harnesses} efforts={effortList} value={value} onChange={setValue} />
      <output data-testid="selection">{`${value.harnessId}/${value.modelId}/${value.effortId}`}</output>
    </div>
  );
}

describe('RuntimeChip', () => {
  it('renders nothing when the runtime names neither a harness nor a model', () => {
    const { container } = render(<RuntimeChip />);
    expect(container).toBeEmptyDOMElement();
  });

  it('drops the effort segment where effort is not a real choice', () => {
    render(<RuntimeChip harnessId="claude" model="Opus 5" />);
    expect(screen.getByLabelText('Runtime: Opus 5')).toBeTruthy();
    expect(screen.queryByText('AUTO')).toBeNull();
  });

  it('renders as identity, with no button, when no pick is offered', () => {
    render(<RuntimeChip harnessId="claude" model="Opus 5" effort="High" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('HIGH')).toBeTruthy();
  });

  it('becomes a trigger when the host can honour a pick', () => {
    const onPick = vi.fn();
    render(<RuntimeChip harnessId="claude" model="Opus 5" onPick={onPick} />);
    fireEvent.click(screen.getByRole('button', { name: /Change/ }));
    expect(onPick).toHaveBeenCalledOnce();
  });
});

describe('RuntimePicker', () => {
  it('opens the panel out of the chip and closes on the chip again', () => {
    render(<Harness />);
    const chip = screen.getByRole('button', { name: /Runtime/ });
    expect(chip.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(chip);
    expect(chip.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.click(chip);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes on Escape and on a scrim click', () => {
    render(<Harness />);
    const chip = screen.getByRole('button', { name: /Runtime/ });

    fireEvent.click(chip);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(chip);
    fireEvent.click(screen.getByRole('button', { name: 'Close runtime picker' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('commits picks live, with no Done button', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Runtime/ }));

    fireEvent.click(screen.getByRole('option', { name: /Sonnet/ }));
    expect(screen.getByTestId('selection').textContent).toBe('claude/sonnet-4-6/auto');
    // The panel stays open and the chip below is the summary.
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Done/i })).toBeNull();
  });

  it('switching harness moves to that harness default model', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Runtime/ }));

    fireEvent.click(screen.getByRole('radio', { name: 'Codex' }));
    expect(screen.getByTestId('selection').textContent).toBe('codex/gpt-5.6-sol/auto');
  });

  it('moves an unsupported effort onto something the new harness supports', () => {
    render(<Harness initial={{ harnessId: 'claude', modelId: 'opus-5', effortId: 'high' }} />);
    fireEvent.click(screen.getByRole('button', { name: /Runtime/ }));

    // High is Claude-only; Codex has to land somewhere real rather than
    // leaving a dead rung lit.
    fireEvent.click(screen.getByRole('radio', { name: 'Codex' }));
    expect(screen.getByTestId('selection').textContent).toBe('codex/gpt-5.6-sol/medium');
  });

  it('scopes the ladder to the efforts the current harness supports', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Runtime/ }));
    expect(screen.getByRole('radio', { name: 'High effort' })).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: 'Codex' }));
    expect(screen.queryByRole('radio', { name: 'High effort' })).toBeNull();
    expect(screen.getByRole('radio', { name: 'Medium effort' })).toBeTruthy();
  });

  it('falls back to the first supported rung when nothing is marked default', () => {
    const plain: RuntimeEffort[] = [
      { id: 'auto', label: 'Auto' },
      { id: 'high', label: 'High', harnesses: ['claude'] },
    ];
    render(<Harness initial={{ harnessId: 'claude', modelId: 'opus-5', effortId: 'high' }} efforts={plain} />);
    fireEvent.click(screen.getByRole('button', { name: /Runtime/ }));

    fireEvent.click(screen.getByRole('radio', { name: 'Codex' }));
    expect(screen.getByTestId('selection').textContent).toBe('codex/gpt-5.6-sol/auto');
  });

  it('drops the ladder entirely for a host with no effort concept', () => {
    render(<Harness efforts={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /Runtime/ }));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByRole('radio', { name: /effort/ })).toBeNull();
    // ...and the chip carries no effort segment either.
    expect(screen.queryByText('AUTO')).toBeNull();
  });

  it('resolves a stale model id onto the harness default rather than lighting nothing', () => {
    render(<Harness initial={{ harnessId: 'claude', modelId: 'gpt-5.5-mini', effortId: 'auto' }} />);
    fireEvent.click(screen.getByRole('button', { name: /Runtime/ }));

    expect(screen.getByRole('option', { name: /Opus/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('offers no picker when the runtime is read-only', () => {
    render(
      <RuntimePicker
        harnesses={harnesses}
        efforts={efforts}
        value={{ harnessId: 'claude', modelId: 'opus-5', effortId: 'auto' }}
        onChange={vi.fn()}
        readOnly
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByLabelText(/Runtime: Opus 5/)).toBeTruthy();
  });

  it('falls back to the monogram when the host draws no mark for a harness', () => {
    render(
      <RuntimePicker
        harnesses={harnesses}
        value={{ harnessId: 'claude', modelId: 'opus-5', effortId: 'auto' }}
        onChange={vi.fn()}
        mark={(id) => (id === 'codex' ? <svg data-testid="codex-mark" /> : null)}
      />,
    );
    expect(screen.getByText('*')).toBeTruthy();
  });

  it('keeps an unavailable harness on the rail, pickable and announced', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Runtime/ }));

    const kimi = screen.getByRole('radio', { name: 'Kimi' });
    expect(kimi.getAttribute('aria-description')).toBe('Unavailable');
    fireEvent.click(kimi);
    expect(screen.getByTestId('selection').textContent).toBe('kimi/auto/auto');
  });

  it('gives a named harness a monogram even when the host supplies none', () => {
    render(<RuntimeChip harnessId="kimi" model="Auto" />);
    expect(screen.getByText('K')).toBeTruthy();
  });

  it('portals the panel to the body so composer overflow cannot clip it', () => {
    const { container } = render(
      <div style={{ overflow: 'hidden' }}>
        <Harness />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Runtime/ }));

    const dialog = screen.getByRole('dialog');
    expect(container.contains(dialog)).toBe(false);
    expect(document.body.contains(dialog)).toBe(true);
  });

  it('moves focus onto the picked model and back to the chip on close', () => {
    render(<Harness />);
    const chip = screen.getByRole('button', { name: /Runtime/ });
    fireEvent.click(chip);

    expect(document.activeElement).toBe(screen.getByRole('option', { name: /Opus/ }));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(chip);
  });

  it('walks the picks from the keyboard: arrows for model and effort, alt-arrows for harness', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Runtime/ }));
    const dialog = screen.getByRole('dialog');

    fireEvent.keyDown(dialog, { key: 'ArrowDown' });
    expect(screen.getByTestId('selection').textContent).toBe('claude/sonnet-4-6/auto');

    fireEvent.keyDown(dialog, { key: 'ArrowRight' });
    expect(screen.getByTestId('selection').textContent).toBe('claude/sonnet-4-6/low');

    fireEvent.keyDown(dialog, { key: 'ArrowDown', altKey: true });
    expect(screen.getByTestId('selection').textContent).toBe('codex/gpt-5.6-sol/low');
  });
});

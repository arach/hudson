import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  eventMatchesShortcut,
  parseShortcut,
  useCommandShortcuts,
} from '../src/hooks/useCommandShortcuts';
import type { CommandOption } from '../src/components/overlays/CommandPalette';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

function command(id: string, shortcut: string, action: () => void): CommandOption {
  return { id, label: id, shortcut, action };
}

function keydown(init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  window.dispatchEvent(event);
  return event;
}

describe('parseShortcut', () => {
  it('parses the word format used across the codebase', () => {
    expect(parseShortcut('Cmd+Shift+F')).toEqual({ key: 'f', mod: true, ctrl: false, alt: false, shift: true });
    expect(parseShortcut('Ctrl+`')).toEqual({ key: '`', mod: false, ctrl: true, alt: false, shift: false });
    expect(parseShortcut('Cmd+,')).toEqual({ key: ',', mod: true, ctrl: false, alt: false, shift: false });
    expect(parseShortcut('Cmd+\\')).toEqual({ key: '\\', mod: true, ctrl: false, alt: false, shift: false });
    expect(parseShortcut('Cmd+Enter')).toEqual({ key: 'enter', mod: true, ctrl: false, alt: false, shift: false });
    expect(parseShortcut('Cmd+1')).toEqual({ key: '1', mod: true, ctrl: false, alt: false, shift: false });
  });

  it('parses the glyph format used by context menus', () => {
    expect(parseShortcut('⌘⇧F')).toEqual({ key: 'f', mod: true, ctrl: false, alt: false, shift: true });
    expect(parseShortcut('⌘⌥I')).toEqual({ key: 'i', mod: true, ctrl: false, alt: true, shift: false });
  });

  it('rejects bare modifiers and empty strings', () => {
    expect(parseShortcut('Cmd')).toBeNull();
    expect(parseShortcut('')).toBeNull();
    expect(parseShortcut('   ')).toBeNull();
  });
});

describe('eventMatchesShortcut', () => {
  it('maps Cmd to meta on Apple platforms and ctrl elsewhere', () => {
    const parsed = parseShortcut('Cmd+S')!;
    const metaEvent = new KeyboardEvent('keydown', { key: 's', metaKey: true });
    const ctrlEvent = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
    expect(eventMatchesShortcut(metaEvent, parsed, true)).toBe(true);
    expect(eventMatchesShortcut(metaEvent, parsed, false)).toBe(false);
    expect(eventMatchesShortcut(ctrlEvent, parsed, false)).toBe(true);
    expect(eventMatchesShortcut(ctrlEvent, parsed, true)).toBe(false);
  });

  it('requires exact modifiers so wider chords do not leak into narrower ones', () => {
    const parsed = parseShortcut('Cmd+F')!;
    const withShift = new KeyboardEvent('keydown', { key: 'f', metaKey: true, shiftKey: true });
    expect(eventMatchesShortcut(withShift, parsed, true)).toBe(false);
  });
});

describe('useCommandShortcuts', () => {
  it('triggers the command action and prevents default on a matching chord', () => {
    const action = vi.fn();
    renderHook(() =>
      useCommandShortcuts([command('save', 'Cmd+S', action)], { isApplePlatform: true }),
    );

    const event = keydown({ key: 's', metaKey: true });
    expect(action).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('matches Ctrl chords when Cmd is declared on non-Apple platforms', () => {
    const action = vi.fn();
    renderHook(() =>
      useCommandShortcuts([command('save', 'Cmd+S', action)], { isApplePlatform: false }),
    );

    keydown({ key: 's', metaKey: true });
    expect(action).not.toHaveBeenCalled();
    keydown({ key: 's', ctrlKey: true });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('ignores keystrokes targeting inputs, textareas, and contenteditable regions', () => {
    const action = vi.fn();
    renderHook(() =>
      useCommandShortcuts([command('save', 'Cmd+S', action)], { isApplePlatform: true }),
    );

    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    const nested = document.createElement('span');
    editable.appendChild(nested);
    document.body.append(input, textarea, editable);

    for (const el of [input, textarea, nested]) {
      el.dispatchEvent(
        new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true, cancelable: true }),
      );
    }
    expect(action).not.toHaveBeenCalled();

    // Same chord from a non-editable target still fires.
    keydown({ key: 's', metaKey: true });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('fires inside editable targets when allowInEditable is set', () => {
    const action = vi.fn();
    renderHook(() =>
      useCommandShortcuts([command('save', 'Cmd+S', action)], {
        isApplePlatform: true,
        allowInEditable: true,
      }),
    );

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true, cancelable: true }),
    );
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('does nothing when disabled and removes the listener on unmount', () => {
    const action = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useCommandShortcuts([command('save', 'Cmd+S', action)], {
          isApplePlatform: true,
          enabled,
        }),
      { initialProps: { enabled: false } },
    );

    keydown({ key: 's', metaKey: true });
    expect(action).not.toHaveBeenCalled();

    rerender({ enabled: true });
    keydown({ key: 's', metaKey: true });
    expect(action).toHaveBeenCalledTimes(1);

    unmount();
    keydown({ key: 's', metaKey: true });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('uses the latest commands across re-renders without re-registering', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ action }: { action: () => void }) =>
        useCommandShortcuts([command('save', 'Cmd+S', action)], { isApplePlatform: true }),
      { initialProps: { action: first } },
    );

    rerender({ action: second });
    keydown({ key: 's', metaKey: true });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('gives the most recently mounted hook priority when chords collide', () => {
    const older = vi.fn();
    const newer = vi.fn();
    renderHook(() =>
      useCommandShortcuts([command('older', 'Cmd+S', older)], { isApplePlatform: true }),
    );
    const late = renderHook(() =>
      useCommandShortcuts([command('newer', 'Cmd+S', newer)], { isApplePlatform: true }),
    );

    keydown({ key: 's', metaKey: true });
    expect(newer).toHaveBeenCalledTimes(1);
    expect(older).not.toHaveBeenCalled();

    // Once the newer registration unmounts, the older one takes over again.
    late.unmount();
    keydown({ key: 's', metaKey: true });
    expect(older).toHaveBeenCalledTimes(1);
    expect(newer).toHaveBeenCalledTimes(1);
  });

  it('skips events that were already default-prevented elsewhere', () => {
    const action = vi.fn();
    renderHook(() =>
      useCommandShortcuts([command('save', 'Cmd+S', action)], { isApplePlatform: true }),
    );

    const event = new KeyboardEvent('keydown', {
      key: 's',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    event.preventDefault();
    window.dispatchEvent(event);
    expect(action).not.toHaveBeenCalled();
  });
});

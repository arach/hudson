'use client';

import { useEffect, useRef } from 'react';
import type { CommandOption } from '../components/overlays/CommandPalette';

// ---------------------------------------------------------------------------
// useCommandShortcuts — turn declared CommandOption.shortcut strings into real
// key bindings.
//
// Historically `shortcut` was a display hint only (see docs/building-apps.md);
// every app hand-rolled its own `window.addEventListener('keydown', ...)`.
// This hook accepts the same command array an app already returns from
// `useCommands()` and wires the declared chords for real:
//
//   - Supports the codebase's `'Cmd+Shift+F'` word format (`Cmd`, `Ctrl`,
//     `Alt`/`Option`, `Shift`, `Mod`, joined by `+`) as well as the glyph
//     format used by context menus (`'⌘⇧F'`).
//   - `Cmd` (and `Mod`/`Meta`) means ⌘ on Apple platforms and Ctrl everywhere
//     else, matching the shell's own `(e.metaKey || e.ctrlKey)` convention.
//     `Ctrl` always means the Control key.
//   - Keystrokes whose target is an <input>, <textarea>, <select>, or
//     contenteditable region are ignored unless `allowInEditable` is set.
//   - `preventDefault()` is called on the event when a chord matches, and the
//     matched command's `action()` runs.
//
// Multiple mounted apps and the same chord: all instances of this hook share
// one window-level `keydown` listener backed by a module-scoped subscriber
// stack. Subscribers are consulted newest-first and dispatch stops at the
// first subscriber that consumes the event — i.e. **the most recently mounted
// hook wins** and earlier registrations never double-fire for the same
// keystroke. Within a single hook's command list, the first command whose
// chord matches wins.
// ---------------------------------------------------------------------------

export interface UseCommandShortcutsOptions {
  /** When false the hook registers nothing (e.g. app disabled/hidden). Defaults to true. */
  enabled?: boolean;
  /** Fire even when the keystroke targets an input/textarea/contenteditable. Defaults to false. */
  allowInEditable?: boolean;
  /** Override platform detection: true treats `Cmd`/`Mod` as the ⌘ (meta) key,
   *  false treats them as Ctrl. Defaults to sniffing `navigator`. */
  isApplePlatform?: boolean;
}

/** Normalized shortcut chord. `mod` is the cross-platform primary modifier
 *  (⌘ on Apple platforms, Ctrl elsewhere); `ctrl` is the literal Control key. */
export interface ParsedShortcut {
  key: string;
  mod: boolean;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
}

const MODIFIER_TOKENS: Record<string, 'mod' | 'ctrl' | 'alt' | 'shift'> = {
  cmd: 'mod',
  command: 'mod',
  meta: 'mod',
  mod: 'mod',
  super: 'mod',
  win: 'mod',
  '⌘': 'mod',
  ctrl: 'ctrl',
  control: 'ctrl',
  '⌃': 'ctrl',
  alt: 'alt',
  option: 'alt',
  opt: 'alt',
  '⌥': 'alt',
  shift: 'shift',
  '⇧': 'shift',
};

/** Aliases mapped to the corresponding `KeyboardEvent.key` value (lowercased). */
const KEY_ALIASES: Record<string, string> = {
  esc: 'escape',
  return: 'enter',
  space: ' ',
  spacebar: ' ',
  plus: '+',
  del: 'delete',
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
  backtick: '`',
};

const GLYPH_MODIFIERS = /[⌘⌃⌥⇧]/;

function tokenize(shortcut: string): string[] {
  const trimmed = shortcut.trim();
  if (!trimmed) return [];

  // Glyph format without separators: '⌘⇧F', '⌘\\', '⌘⌥I' …
  if (!trimmed.includes('+') && GLYPH_MODIFIERS.test(trimmed)) {
    const tokens: string[] = [];
    let key = '';
    for (const ch of trimmed) {
      if (GLYPH_MODIFIERS.test(ch)) tokens.push(ch);
      else key += ch;
    }
    if (key) tokens.push(key);
    return tokens;
  }

  // Word format: 'Cmd+Shift+F', 'Ctrl+`', 'Cmd+,' … A trailing '+' after the
  // separator split (e.g. 'Cmd++') means the literal '+' key.
  const parts = trimmed.split('+');
  const tokens: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part !== '') tokens.push(part);
    else if (i === parts.length - 1) tokens.push('+');
  }
  return tokens;
}

const parseCache = new Map<string, ParsedShortcut | null>();

/** Parse a shortcut string ('Cmd+Shift+F', 'Ctrl+`', '⌘⇧F', …) into a
 *  normalized chord, or null when the string isn't a bindable chord. */
export function parseShortcut(shortcut: string): ParsedShortcut | null {
  const cached = parseCache.get(shortcut);
  if (cached !== undefined) return cached;

  const parsed = parseShortcutUncached(shortcut);
  parseCache.set(shortcut, parsed);
  return parsed;
}

function parseShortcutUncached(shortcut: string): ParsedShortcut | null {
  const tokens = tokenize(shortcut);
  if (tokens.length === 0) return null;

  const parsed: ParsedShortcut = { key: '', mod: false, ctrl: false, alt: false, shift: false };

  // Every token except the last must be a modifier; the last token is the key.
  for (let i = 0; i < tokens.length - 1; i++) {
    const field = MODIFIER_TOKENS[tokens[i].toLowerCase()];
    if (!field) return null;
    parsed[field] = true;
  }

  const keyToken = tokens[tokens.length - 1].toLowerCase();
  if (MODIFIER_TOKENS[keyToken]) return null; // bare modifier ('Cmd') is not a chord
  parsed.key = KEY_ALIASES[keyToken] ?? keyToken;
  return parsed.key ? parsed : null;
}

/** Strict chord match: required modifiers must be down and no extra modifiers
 *  may be down (so 'Cmd+F' does not also swallow 'Cmd+Shift+F'). */
export function eventMatchesShortcut(
  event: KeyboardEvent,
  parsed: ParsedShortcut,
  isApplePlatform: boolean,
): boolean {
  const expectMeta = parsed.mod && isApplePlatform;
  const expectCtrl = parsed.ctrl || (parsed.mod && !isApplePlatform);
  if (Boolean(event.metaKey) !== expectMeta) return false;
  if (Boolean(event.ctrlKey) !== expectCtrl) return false;
  if (Boolean(event.altKey) !== parsed.alt) return false;
  if (Boolean(event.shiftKey) !== parsed.shift) return false;
  return typeof event.key === 'string' && event.key.toLowerCase() === parsed.key;
}

function detectApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform || nav.platform || nav.userAgent || '';
  return /mac|iphone|ipad|ipod/i.test(platform);
}

function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return (
    typeof el.closest === 'function' &&
    el.closest('[contenteditable]:not([contenteditable="false"])') !== null
  );
}

// --- Shared window listener ------------------------------------------------
// One keydown listener for the whole page; subscribers are consulted
// newest-first and dispatch stops at the first consumer.

interface ShortcutSubscriber {
  handle: (event: KeyboardEvent) => boolean;
}

const subscribers: ShortcutSubscriber[] = [];
let windowListener: ((event: KeyboardEvent) => void) | null = null;

function dispatchToSubscribers(event: KeyboardEvent): void {
  for (let i = subscribers.length - 1; i >= 0; i--) {
    if (subscribers[i].handle(event)) return;
  }
}

function subscribeShortcuts(subscriber: ShortcutSubscriber): () => void {
  subscribers.push(subscriber);
  if (!windowListener) {
    windowListener = dispatchToSubscribers;
    window.addEventListener('keydown', windowListener);
  }
  return () => {
    const index = subscribers.indexOf(subscriber);
    if (index !== -1) subscribers.splice(index, 1);
    if (subscribers.length === 0 && windowListener) {
      window.removeEventListener('keydown', windowListener);
      windowListener = null;
    }
  };
}

/**
 * Bind the `shortcut` strings of a command list to real keydown handling.
 *
 * Pass the same array your app returns from `useCommands()`; commands without
 * a `shortcut` (or with an unparseable one) are ignored. The hook reads the
 * latest `commands` through a ref, so re-renders don't re-register listeners
 * and the freshest `action` closures always run.
 *
 * @example
 * const commands = useMyAppCommands();
 * useCommandShortcuts(commands, { enabled: !disabled });
 */
export function useCommandShortcuts(
  commands: ReadonlyArray<CommandOption>,
  options: UseCommandShortcutsOptions = {},
): void {
  const { enabled = true, allowInEditable = false, isApplePlatform } = options;

  const commandsRef = useRef(commands);
  // eslint-disable-next-line react-hooks/refs -- mirroring the latest commands into a ref during render is intentional so the window keydown listener (registered once) always dispatches against current commands without re-subscribing
  commandsRef.current = commands;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const apple = isApplePlatform ?? detectApplePlatform();

    const handle = (event: KeyboardEvent): boolean => {
      if (event.defaultPrevented) return false;
      if (!allowInEditable && isEditableTarget(event.target)) return false;
      for (const command of commandsRef.current) {
        if (!command.shortcut) continue;
        const parsed = parseShortcut(command.shortcut);
        if (!parsed || !eventMatchesShortcut(event, parsed, apple)) continue;
        event.preventDefault();
        command.action();
        return true;
      }
      return false;
    };

    return subscribeShortcuts({ handle });
  }, [enabled, allowInEditable, isApplePlatform]);
}

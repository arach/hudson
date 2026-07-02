/**
 * Characterization tests — AppShell persistence keys + keyboard commands
 * (plan §4.1, second half; risk R1/R7).
 *
 * Deliberately narrow: another work item is adding opt-in panel overlay modes
 * to AppShell (defaults preserve today's behavior), so these tests pin only
 * the localStorage key contracts and command/keyboard behavior — NOT DOM
 * structure.
 *
 * KEY DISCOVERY PINNED HERE: AppShell mounts an <InstanceProvider
 * instanceId={app.id}> around AppShellInner, and the canonical
 * usePersistentState auto-prefixes keys with `inst:{instanceId}:` unless they
 * start with `inst:` or `hudson.ws.`. So AppShell's `appshell.{id}.*` keys are
 * ACTUALLY stored as `inst:{id}:appshell.{id}.*`. shell-core/keys.ts (PR 4/5)
 * must reproduce this exact spelling or every AppShell user loses layout.
 */
import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppShell } from '@/packages/web/hudsonkit/src/components/AppShell';
import {
  installShellDomPolyfills,
  installWorkspaceFetchMock,
  makeTestApp,
  readStored,
  recordSavedEvents,
  resetShellEnvironment,
  storageKeys,
  type WorkspaceFetchMock,
} from '../helpers/workspaceShellFixture';

installShellDomPolyfills();

const APP_ID = 'solo';
/** The instance-scoped spelling every AppShell persistence key uses today. */
const scoped = (name: string) => `inst:${APP_ID}:appshell.${APP_ID}.${name}`;

let fetchMock: WorkspaceFetchMock;

beforeEach(() => {
  resetShellEnvironment();
  fetchMock = installWorkspaceFetchMock();
});

afterEach(() => {
  cleanup();
  fetchMock.restore();
});

async function mountAppShell() {
  const { app, spy } = makeTestApp({ id: APP_ID });
  const utils = render(<AppShell app={app} managedTheme={false} />);
  await act(async () => {});
  return { app, spy, ...utils };
}

describe('AppShell persistence keys (golden)', () => {
  it('writes only inst-scoped keys on mount — exact set', async () => {
    await mountAppShell();
    expect(storageKeys()).toEqual([
      scoped('codeSheetWidth'),
      scoped('codeWorkbenchChatWidth'),
      scoped('codeWorkbenchEditorWidth'),
      scoped('codeWorkbenchSize'),
      scoped('drawerTab'),
      scoped('left'),
      scoped('leftW'),
      scoped('right'),
      scoped('rightW'),
      scoped('termH'),
      // Assistant drawer state (also instance-scoped):
      `inst:${APP_ID}:assistant.${APP_ID}.mode`,
      `inst:${APP_ID}:assistant.${APP_ID}.voice.speakReplies`,
      // Wart pinned on purpose (risk R1 in the plan): useHudsonAI persists the
      // GLOBAL 'hudson.settings' key, but the inst: auto-prefix only exempts
      // 'inst:' and 'hudson.ws.' prefixes — so under AppShell's
      // InstanceProvider the "global" settings key is silently per-instance.
      `inst:${APP_ID}:hudson.settings`,
    ]);
  });

  it('never writes the unscoped appshell.* spelling', async () => {
    await mountAppShell();
    expect(storageKeys().filter(k => k.startsWith('appshell.'))).toEqual([]);
  });

  it('writes the documented defaults', async () => {
    await mountAppShell();
    expect(readStored(scoped('left'))).toBe(false);
    expect(readStored(scoped('right'))).toBe(false);
    expect(readStored(scoped('leftW'))).toBe(260);
    expect(readStored(scoped('rightW'))).toBe(280);
    expect(readStored(scoped('termH'))).toBe(320);
    expect(readStored(scoped('codeWorkbenchSize'))).toBe('half');
    expect(readStored(scoped('codeWorkbenchEditorWidth'))).toBe(420);
    expect(readStored(scoped('codeWorkbenchChatWidth'))).toBe(320);
    expect(readStored(scoped('codeSheetWidth'))).toBe(720);
    // No Terminal slot on the fixture app → assistant is the default tab.
    expect(readStored(scoped('drawerTab'))).toBe('assistant');
  });

  it('restores a pre-seeded scoped value instead of the default', async () => {
    localStorage.setItem(scoped('leftW'), JSON.stringify(444));
    await mountAppShell();
    expect(readStored(scoped('leftW'))).toBe(444);
  });
});

describe('AppShell keyboard commands', () => {
  it('Cmd+[ toggles the left panel key and fires hudson:saved with the scoped key', async () => {
    await mountAppShell();
    const saved = recordSavedEvents();

    fireEvent.keyDown(window, { key: '[', metaKey: true });
    expect(readStored(scoped('left'))).toBe(true);
    expect(saved.keys).toContain(scoped('left'));

    fireEvent.keyDown(window, { key: '[', metaKey: true });
    expect(readStored(scoped('left'))).toBe(false);
    saved.stop();
  });

  it('Cmd+] toggles the right panel key', async () => {
    await mountAppShell();
    fireEvent.keyDown(window, { key: ']', metaKey: true });
    expect(readStored(scoped('right'))).toBe(true);
  });

  it('Cmd+J switches the drawer to the assistant tab key', async () => {
    await mountAppShell();
    fireEvent.keyDown(window, { key: 'j', metaKey: true });
    expect(readStored(scoped('drawerTab'))).toBe('assistant');
  });

  it('Cmd+K opens the palette (adds one input); executing a shell command persists', async () => {
    await mountAppShell();
    const inputsBefore = document.querySelectorAll('input').length;

    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(document.querySelectorAll('input').length).toBe(inputsBefore + 1);

    const inputs = Array.from(document.querySelectorAll('input'));
    const paletteInput = inputs[inputs.length - 1];
    fireEvent.change(paletteInput, { target: { value: 'Toggle Left Panel' } });
    fireEvent.keyDown(paletteInput, { key: 'Enter' });

    // Command executed (key flipped) and palette closed (input removed).
    expect(readStored(scoped('left'))).toBe(true);
    expect(document.querySelectorAll('input').length).toBe(inputsBefore);
  });

  it('Escape in the palette input closes the palette without executing', async () => {
    await mountAppShell();
    const inputsBefore = document.querySelectorAll('input').length;

    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    const inputs = Array.from(document.querySelectorAll('input'));
    const paletteInput = inputs[inputs.length - 1];
    fireEvent.keyDown(paletteInput, { key: 'Escape' });

    expect(document.querySelectorAll('input').length).toBe(inputsBefore);
    expect(readStored(scoped('left'))).toBe(false);
  });
});

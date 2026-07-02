import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppShell } from '../src/components/AppShell';
import { defineApp } from '../src/lib/defineApp';
import { useAppShellSidePanels } from '../src/context/AppShellControlsContext';
import type { SidePanelControls } from '../src/context/AppShellControlsContext';
import type { AppShellLayoutConfig } from '../src/types/app';

// ---------------------------------------------------------------------------
// AppShell panel behavior — push (default, characterized as unchanged),
// overlay, auto, the inspector pin toggle, and the responsive panel-max cap.
// ---------------------------------------------------------------------------

const JSDOM_DEFAULT_VIEWPORT = 1024;

function setViewportWidth(px: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: px });
}

function resizeViewport(px: number) {
  setViewportWidth(px);
  fireEvent(window, new Event('resize'));
}

/** AppShell keys are instance-scoped: inst:{app.id}:appshell.{app.id}.{leaf} */
function storageKey(id: string, leaf: string) {
  return `inst:${id}:appshell.${id}.${leaf}`;
}

/** All persisted appshell.* keys (other shell features — Assistant, settings —
 *  write their own namespaces; this suite characterizes the panel key set). */
function storedAppShellKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.includes(':appshell.')) keys.push(key);
  }
  return keys.sort();
}

function makeApp(id: string, layout?: AppShellLayoutConfig) {
  const captured: { panels: { left: SidePanelControls; right: SidePanelControls } | null } = {
    panels: null,
  };
  function Content() {
    captured.panels = useAppShellSidePanels();
    return <div data-testid={`content-${id}`}>content</div>;
  }
  const app = defineApp({
    id,
    name: `Panel ${id}`,
    ...(layout ? { layout } : {}),
    slots: {
      Content,
      LeftPanel: () => <div>left panel</div>,
      Inspector: () => <div>inspector panel</div>,
    },
  });
  return { app, captured };
}

function contentEl(): HTMLElement {
  const el = document.querySelector('.frame-scrollbar.select-text');
  expect(el).not.toBeNull();
  return el as HTMLElement;
}

function leftPanelEl(): HTMLElement | null {
  return document.querySelector('[data-frame-panel="manifest"]');
}

function rightPanelEl(): HTMLElement | null {
  return document.querySelector('[data-frame-panel="inspector"]');
}

beforeEach(() => {
  localStorage.clear();
  setViewportWidth(JSDOM_DEFAULT_VIEWPORT);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  setViewportWidth(JSDOM_DEFAULT_VIEWPORT);
});

describe('AppShell default push mode (characterization — must not change)', () => {
  it('pushes content by the panel widths, floats nothing, and persists exactly the classic key set', () => {
    const id = 'push-default';
    const { app, captured } = makeApp(id);
    render(<AppShell app={app} managedTheme={false} />);

    // Push layout: content is inset by both panel widths.
    expect(contentEl().style.left).toBe('260px');
    expect(contentEl().style.right).toBe('280px');

    // Nothing floats; the attribute is not rendered at all on the default path.
    expect(leftPanelEl()).not.toBeNull();
    expect(rightPanelEl()).not.toBeNull();
    expect(leftPanelEl()!.hasAttribute('data-floating')).toBe(false);
    expect(rightPanelEl()!.hasAttribute('data-floating')).toBe(false);

    // No pin toggle in the inspector header.
    expect(screen.queryByTitle('Float inspector (overlay content)')).toBeNull();
    expect(screen.queryByTitle('Pin inspector (push content)')).toBeNull();

    // Controls context: no pin handle, not floating.
    expect(captured.panels).not.toBeNull();
    expect(captured.panels!.right.pin).toBeUndefined();
    expect(captured.panels!.left.isFloating).toBe(false);
    expect(captured.panels!.right.isFloating).toBe(false);

    // Persisted keys: exact classic spellings, no rightOverlay, nothing new.
    expect(localStorage.getItem(storageKey(id, 'left'))).toBe('false');
    expect(localStorage.getItem(storageKey(id, 'right'))).toBe('false');
    expect(localStorage.getItem(storageKey(id, 'leftW'))).toBe('260');
    expect(localStorage.getItem(storageKey(id, 'rightW'))).toBe('280');
    expect(localStorage.getItem(storageKey(id, 'rightOverlay'))).toBeNull();
    expect(storedAppShellKeys()).toEqual(
      [
        storageKey(id, 'codeSheetWidth'),
        storageKey(id, 'codeWorkbenchChatWidth'),
        storageKey(id, 'codeWorkbenchEditorWidth'),
        storageKey(id, 'codeWorkbenchSize'),
        storageKey(id, 'drawerTab'),
        storageKey(id, 'left'),
        storageKey(id, 'leftW'),
        storageKey(id, 'right'),
        storageKey(id, 'rightW'),
        storageKey(id, 'termH'),
      ].sort(),
    );
  });

  it('does not re-clamp a stored out-of-bounds width on mount', () => {
    const id = 'push-no-reclamp';
    localStorage.setItem(storageKey(id, 'leftW'), '800');
    const { app } = makeApp(id);
    render(<AppShell app={app} managedTheme={false} />);

    expect(leftPanelEl()!.style.width).toBe('800px');
    expect(localStorage.getItem(storageKey(id, 'leftW'))).toBe('800');
  });

  it('Cmd+Shift+] still toggles right collapse when the pin toggle is not enabled', () => {
    const id = 'push-shift-bracket';
    const { app } = makeApp(id);
    render(<AppShell app={app} managedTheme={false} />);

    fireEvent.keyDown(window, { key: ']', metaKey: true, shiftKey: true });
    expect(rightPanelEl()).toBeNull(); // collapsed to peek button
    expect(localStorage.getItem(storageKey(id, 'right'))).toBe('true');
    expect(localStorage.getItem(storageKey(id, 'rightOverlay'))).toBeNull();
  });
});

describe('AppShell overlay mode', () => {
  const chrome = { panelBehavior: { mode: 'overlay' as const } };

  it('floats both panels over the content area', () => {
    const { app } = makeApp('overlay-basic');
    render(<AppShell app={app} managedTheme={false} chrome={chrome} />);

    expect(leftPanelEl()!.getAttribute('data-floating')).toBe('true');
    expect(rightPanelEl()!.getAttribute('data-floating')).toBe('true');
    expect(contentEl().style.left).toBe('0px');
    expect(contentEl().style.right).toBe('0px');
  });

  it('keeps collapse shortcuts working (Cmd+[ / Cmd+])', () => {
    const id = 'overlay-keys';
    const { app } = makeApp(id);
    render(<AppShell app={app} managedTheme={false} chrome={chrome} />);

    fireEvent.keyDown(window, { key: '[', metaKey: true });
    expect(leftPanelEl()).toBeNull();
    expect(localStorage.getItem(storageKey(id, 'left'))).toBe('true');

    fireEvent.keyDown(window, { key: ']', metaKey: true });
    expect(rightPanelEl()).toBeNull();
    expect(localStorage.getItem(storageKey(id, 'right'))).toBe('true');

    // Toggle back open — still floating.
    fireEvent.keyDown(window, { key: ']', metaKey: true });
    expect(rightPanelEl()!.getAttribute('data-floating')).toBe('true');
  });

  it('keeps resize drag working while floating', () => {
    const { app } = makeApp('overlay-resize');
    render(<AppShell app={app} managedTheme={false} chrome={chrome} />);

    const handle = rightPanelEl()!.querySelector('.cursor-ew-resize');
    expect(handle).not.toBeNull();
    fireEvent.mouseDown(handle!, { clientX: 500 });
    fireEvent.mouseMove(document, { clientX: 450 }); // drag left = wider right panel
    fireEvent.mouseUp(document);

    expect(rightPanelEl()!.style.width).toBe('330px');
  });
});

describe('AppShell auto mode', () => {
  const chrome = { panelBehavior: { mode: 'auto' as const } };

  it('floats the right panel first when pushing would squeeze the center below 560px', () => {
    setViewportWidth(900); // 900 - 260 - 280 = 360 < 560, but 900 - 260 = 640 >= 560
    const { app } = makeApp('auto-right-first');
    render(<AppShell app={app} managedTheme={false} chrome={chrome} />);

    expect(rightPanelEl()!.getAttribute('data-floating')).toBe('true');
    expect(leftPanelEl()!.hasAttribute('data-floating')).toBe(false);
    expect(contentEl().style.left).toBe('260px');
    expect(contentEl().style.right).toBe('0px');
  });

  it('floats both panels when the left panel alone would still starve the center', () => {
    setViewportWidth(700); // 700 - 260 = 440 < 560
    const { app } = makeApp('auto-both');
    render(<AppShell app={app} managedTheme={false} chrome={chrome} />);

    expect(leftPanelEl()!.getAttribute('data-floating')).toBe('true');
    expect(rightPanelEl()!.getAttribute('data-floating')).toBe('true');
    expect(contentEl().style.left).toBe('0px');
    expect(contentEl().style.right).toBe('0px');
  });

  it('switches between push and overlay as the viewport resizes', () => {
    setViewportWidth(1400);
    const { app } = makeApp('auto-resize');
    render(<AppShell app={app} managedTheme={false} chrome={chrome} />);

    // Wide: plain push.
    expect(rightPanelEl()!.hasAttribute('data-floating')).toBe(false);
    expect(contentEl().style.left).toBe('260px');
    expect(contentEl().style.right).toBe('280px');

    // Narrow: right floats.
    act(() => resizeViewport(900));
    expect(rightPanelEl()!.getAttribute('data-floating')).toBe('true');
    expect(contentEl().style.right).toBe('0px');

    // Wide again: back to push.
    act(() => resizeViewport(1400));
    expect(rightPanelEl()!.hasAttribute('data-floating')).toBe(false);
    expect(contentEl().style.right).toBe('280px');
  });

  it('honors a custom centerMinWidth threshold', () => {
    setViewportWidth(900); // center would be 360, which is fine for a 300px threshold
    const { app } = makeApp('auto-threshold');
    render(
      <AppShell
        app={app}
        managedTheme={false}
        chrome={{ panelBehavior: { mode: 'auto', centerMinWidth: 300 } }}
      />,
    );

    expect(leftPanelEl()!.hasAttribute('data-floating')).toBe(false);
    expect(rightPanelEl()!.hasAttribute('data-floating')).toBe(false);
    expect(contentEl().style.left).toBe('260px');
    expect(contentEl().style.right).toBe('280px');
  });
});

describe('AppShell inspector pin toggle', () => {
  const chrome = { panelBehavior: { inspectorPin: true } };

  it('floats the inspector on toggle, persists the preference, and exposes pin controls', () => {
    const id = 'pin-basic';
    const { app, captured } = makeApp(id);
    const { unmount } = render(<AppShell app={app} managedTheme={false} chrome={chrome} />);

    // Pinned (push) by default.
    const button = screen.getByTitle('Float inspector (overlay content)');
    expect(rightPanelEl()!.hasAttribute('data-floating')).toBe(false);
    expect(contentEl().style.right).toBe('280px');
    expect(captured.panels!.right.pin).toBeDefined();
    expect(captured.panels!.right.pin!.isPinned).toBe(true);

    fireEvent.click(button);

    // Floating: content flows under the inspector, preference persisted.
    expect(rightPanelEl()!.getAttribute('data-floating')).toBe('true');
    expect(contentEl().style.right).toBe('0px');
    expect(screen.getByTitle('Pin inspector (push content)')).toBeInTheDocument();
    expect(localStorage.getItem(storageKey(id, 'rightOverlay'))).toBe('true');
    expect(captured.panels!.right.pin!.isPinned).toBe(false);
    expect(captured.panels!.right.isFloating).toBe(true);

    // Remount: the persisted preference is restored.
    unmount();
    render(<AppShell app={app} managedTheme={false} chrome={chrome} />);
    expect(rightPanelEl()!.getAttribute('data-floating')).toBe('true');
    expect(screen.getByTitle('Pin inspector (push content)')).toBeInTheDocument();
  });

  it('toggles the preference with Cmd+Shift+] when enabled', () => {
    const id = 'pin-shortcut';
    const { app } = makeApp(id);
    render(<AppShell app={app} managedTheme={false} chrome={chrome} />);

    fireEvent.keyDown(window, { key: ']', metaKey: true, shiftKey: true });
    expect(rightPanelEl()!.getAttribute('data-floating')).toBe('true');
    expect(localStorage.getItem(storageKey(id, 'rightOverlay'))).toBe('true');
    // Plain Cmd+] still collapses.
    fireEvent.keyDown(window, { key: ']', metaKey: true });
    expect(rightPanelEl()).toBeNull();
  });

  it('pin controls drive the same persisted preference', () => {
    const id = 'pin-controls';
    const { app, captured } = makeApp(id);
    render(<AppShell app={app} managedTheme={false} chrome={chrome} />);

    act(() => captured.panels!.right.pin!.setPinned(false));
    expect(rightPanelEl()!.getAttribute('data-floating')).toBe('true');
    expect(localStorage.getItem(storageKey(id, 'rightOverlay'))).toBe('true');

    act(() => captured.panels!.right.pin!.toggle());
    expect(rightPanelEl()!.hasAttribute('data-floating')).toBe(false);
    expect(localStorage.getItem(storageKey(id, 'rightOverlay'))).toBe('false');
  });
});

describe('AppShell responsive panel max width', () => {
  it('caps stored widths at 45% of the viewport, floored at 500px', () => {
    const id = 'resp-basic';
    setViewportWidth(1000); // floor(450) -> floored at 500
    localStorage.setItem(storageKey(id, 'leftW'), '800');
    const { app } = makeApp(id, { responsivePanelMax: true });
    render(<AppShell app={app} managedTheme={false} />);

    expect(leftPanelEl()!.style.width).toBe('500px');
    expect(localStorage.getItem(storageKey(id, 'leftW'))).toBe('500');
  });

  it('lets an explicit app.layout max win over the ratio cap', () => {
    const id = 'resp-explicit-max';
    setViewportWidth(1000); // ratio cap would be 500
    localStorage.setItem(storageKey(id, 'rightW'), '800');
    const { app } = makeApp(id, { responsivePanelMax: true, right: { max: 700 } });
    render(<AppShell app={app} managedTheme={false} />);

    expect(rightPanelEl()!.style.width).toBe('700px');
  });

  it('caps at the 900px ceiling on very wide viewports', () => {
    const id = 'resp-ceiling';
    setViewportWidth(2400); // floor(1080) -> ceiling 900
    localStorage.setItem(storageKey(id, 'leftW'), '1000');
    const { app } = makeApp(id, { responsivePanelMax: true });
    render(<AppShell app={app} managedTheme={false} />);

    expect(leftPanelEl()!.style.width).toBe('900px');
  });

  it('honors custom ratio/min/max', () => {
    const id = 'resp-custom';
    setViewportWidth(700); // floor(700 * 0.5) = 350, within [300, 800]
    localStorage.setItem(storageKey(id, 'leftW'), '600');
    const { app } = makeApp(id, { responsivePanelMax: { ratio: 0.5, min: 300, max: 800 } });
    render(<AppShell app={app} managedTheme={false} />);

    expect(leftPanelEl()!.style.width).toBe('350px');
  });

  it('re-clamps as the viewport shrinks', () => {
    const id = 'resp-shrink';
    setViewportWidth(2000); // cap 900
    localStorage.setItem(storageKey(id, 'leftW'), '850');
    const { app } = makeApp(id, { responsivePanelMax: true });
    render(<AppShell app={app} managedTheme={false} />);
    expect(leftPanelEl()!.style.width).toBe('850px');

    act(() => resizeViewport(1200)); // cap floor(540) = 540
    expect(leftPanelEl()!.style.width).toBe('540px');
    expect(localStorage.getItem(storageKey(id, 'leftW'))).toBe('540');
  });

  it('applies the cap to resize drags', () => {
    const id = 'resp-drag';
    setViewportWidth(1000); // cap 500
    const { app } = makeApp(id, { responsivePanelMax: true });
    render(<AppShell app={app} managedTheme={false} />);

    const handle = leftPanelEl()!.querySelector('.cursor-ew-resize');
    expect(handle).not.toBeNull();
    fireEvent.mouseDown(handle!, { clientX: 300 });
    fireEvent.mouseMove(document, { clientX: 700 }); // 260 + 400 = 660 -> clamped to 500
    fireEvent.mouseUp(document);

    expect(leftPanelEl()!.style.width).toBe('500px');
  });
});

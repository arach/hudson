'use client';

interface HudsonDevtoolsAppInfo {
  id: string;
  name: string;
  mode: string;
  canvasMode: string;
}

export interface HudsonDevtoolsWelcomeInfo {
  workspaceId: string;
  workspaceName: string;
  mode: string;
  contextMenuMode: 'hudson-first' | 'chrome-first';
  focusedAppId: string | null;
  focusedAppName: string | null;
  apps: HudsonDevtoolsAppInfo[];
}

interface HudsonDevtoolsApi {
  info: HudsonDevtoolsWelcomeInfo;
  help: () => void;
  apps: () => void;
  resources: () => void;
  shortcuts: () => void;
}

declare global {
  interface Window {
    HudsonDevtools?: HudsonDevtoolsApi;
    __HUDSON_DEVTOOLS_WELCOME_SHOWN__?: boolean;
  }
}

const cyan = 'color:#67e8f9;font-weight:700';
const teal = 'color:#2dd4bf;font-weight:700';
const muted = 'color:#94a3b8';
const code = 'color:#a7f3d0;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace';

function printShortcuts(info: HudsonDevtoolsWelcomeInfo) {
  const hudsonFirst = info.contextMenuMode === 'hudson-first';
  console.table([
    { gesture: hudsonFirst ? 'Right-click' : 'Option + right-click', action: 'Open the Hudson context menu' },
    { gesture: hudsonFirst ? 'Option + right-click' : 'Right-click', action: 'Open the browser native context menu for Inspect Element' },
    { gesture: 'Cmd + Option + I', action: 'Open Chrome DevTools' },
    { gesture: 'Cmd + K', action: 'Open Hudson command palette' },
    { gesture: 'Cmd + ]', action: 'Toggle the Hudson app inspector' },
    { gesture: 'Cmd + 0', action: 'Reset canvas view' },
  ]);
}

function printResources() {
  console.table([
    {
      name: 'Chrome DevTools Protocol API',
      use: 'Browse CDP domains, methods, and events',
      url: 'https://chromedevtools.github.io/devtools-protocol/',
    },
    {
      name: 'ChromeDevTools/devtools-protocol',
      use: 'Canonical protocol JSON and TypeScript types',
      url: 'https://github.com/ChromeDevTools/devtools-protocol',
    },
    {
      name: 'chrome-remote-interface',
      use: 'Node client and recipes for CDP automation',
      url: 'https://github.com/cyrus-and/chrome-remote-interface',
    },
    {
      name: 'DevTools Snippets',
      use: 'Reusable console snippets for debugging page state',
      url: 'https://bgrins.github.io/devtools-snippets/',
    },
    {
      name: 'Extending DevTools',
      use: 'Chrome extension path for a real custom DevTools panel',
      url: 'https://developer.chrome.com/docs/extensions/how-to/devtools/extend-devtools',
    },
    {
      name: 'Awesome Chrome DevTools',
      use: 'Curated ecosystem list',
      url: 'https://github.com/paulirish/awesome-chrome-devtools',
    },
  ]);
}

export function showHudsonDevtoolsWelcome(info: HudsonDevtoolsWelcomeInfo) {
  console.groupCollapsed(
    '%cHUDSON DEVTOOLS%c  CDP welcome for %s',
    cyan,
    muted,
    info.workspaceName,
  );
  console.log('%cWorkspace%c %s (%s)', teal, muted, info.workspaceId, info.mode);
  console.log(
    '%cFocused app%c %s',
    teal,
    muted,
    info.focusedAppName ? `${info.focusedAppName} (${info.focusedAppId})` : 'none',
  );
  console.log(
    '%cInspect path%c Browser pages cannot open Chrome DevTools directly. Current setting: %s. Use %s for the native Inspect Element menu, or Cmd + Option + I to open DevTools.',
    teal,
    muted,
    info.contextMenuMode === 'hudson-first' ? 'Hudson right click first' : 'Chrome right click first',
    info.contextMenuMode === 'hudson-first' ? 'Option + right-click' : 'right-click',
  );
  console.log('%cHelpers%c window.HudsonDevtools.help(), .apps(), .shortcuts(), .resources()', teal, muted);
  console.log('%cCDP note%c Automation can attach to this tab over the Chrome DevTools Protocol; the page itself only exposes this console helper surface.', teal, muted);
  console.log('%cExtension note%c A real custom Chrome DevTools panel requires a Chrome extension with a devtools_page manifest entry.', teal, muted);
  console.log('%cwindow.HudsonDevtools.info%c contains the current workspace/app snapshot.', code, muted);
  console.groupEnd();
}

export function installHudsonDevtoolsWelcome(info: HudsonDevtoolsWelcomeInfo) {
  if (typeof window === 'undefined') return;

  window.HudsonDevtools = {
    info,
    help: () => showHudsonDevtoolsWelcome(info),
    apps: () => console.table(info.apps),
    resources: printResources,
    shortcuts: () => printShortcuts(info),
  };

  if (window.__HUDSON_DEVTOOLS_WELCOME_SHOWN__) return;
  window.__HUDSON_DEVTOOLS_WELCOME_SHOWN__ = true;
  showHudsonDevtoolsWelcome(info);
}

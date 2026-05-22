'use client';

import { useRef, useEffect, useState, useCallback, type CSSProperties } from 'react';
import type { TerminalRelayHandle } from '../hooks/useTerminalRelay';
import { usePlatform } from '../platform/PlatformContext';
import { useOptionalTheme } from '../theme/ThemeProvider';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TerminalRelayConfigItem {
  label: string;
  value: string;
}

type TerminalColorScheme = 'dark' | 'light' | 'auto';

interface TerminalRelayProps {
  relay: TerminalRelayHandle;
  fontSize?: number;
  fontFamily?: string;
  /** Follow the Hudson theme by default, using terminal-specific ANSI palettes. */
  colorScheme?: TerminalColorScheme;
  /** Key/value pairs shown in the disconnected state so users can see current config at a glance */
  configItems?: TerminalRelayConfigItem[];
  /** Called when the user clicks "Settings" in the disconnected overlay */
  onOpenSettings?: () => void;
  /** Called when the relay service is not running and the user clicks "Start Service". If provided, shows the button. */
  onStartService?: () => Promise<boolean>;
  /** Suppress disconnected/connecting overlays — just show the terminal canvas immediately. Error overlays are still shown. */
  quiet?: boolean;
}

export const HUDSON_TERMINAL_VOICE_TRANSCRIPT_EVENT = 'hudson:terminal:voice-transcript';
export const HUDSON_TERMINAL_VOICE_SUBMIT_EVENT = 'hudson:terminal:voice-submit';

export interface HudsonTerminalVoiceTranscriptDetail {
  transcript: string;
  submit?: boolean;
}

// ---------------------------------------------------------------------------
// Workspace screenshot capture (shared utility)
// ---------------------------------------------------------------------------

export async function captureWorkspace(): Promise<Blob | null> {
  try {
    const target = document.getElementById('__next') ?? document.body;
    const mod = await import('html2canvas-pro');
    const html2canvas = mod.default ?? mod;
    const canvas = await (html2canvas as (el: HTMLElement, opts: Record<string, unknown>) => Promise<HTMLCanvasElement>)(target, {
      backgroundColor: '#0a0a0a',
      scale: 0.5,
      useCORS: true,
      logging: false,
      allowTaint: true,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
    });
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob || blob.size < 200) return null;
    return blob;
  } catch (e) {
    console.error('[TerminalRelay] screenshot failed:', e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Terminal-specific xterm palettes. These intentionally do not mirror the
// workspace card theme: CLI ANSI output needs a stable contrast context.
// ---------------------------------------------------------------------------

const XTERM_CONSOLE_DARK_THEME = {
  background: '#091112',
  foreground: '#d7e5e2',
  cursor: '#35d7d0',
  cursorAccent: '#091112',
  selectionBackground: '#173739',
  selectionForeground: '#f3fbf9',
  black: '#091112',
  red: '#ff6b6b',
  green: '#35d07f',
  yellow: '#f5c451',
  blue: '#62b4ff',
  magenta: '#ff7ab6',
  cyan: '#32d5ca',
  white: '#d7e5e2',
  brightBlack: '#667777',
  brightRed: '#ff8f8f',
  brightGreen: '#5ee79f',
  brightYellow: '#ffd36e',
  brightBlue: '#8dccff',
  brightMagenta: '#ff9fca',
  brightCyan: '#67eee3',
  brightWhite: '#ffffff',
};

const XTERM_CONSOLE_LIGHT_THEME = {
  background: '#f7faf9',
  foreground: '#111a19',
  cursor: '#006f6a',
  cursorAccent: '#f7faf9',
  selectionBackground: '#c0e7e2',
  selectionForeground: '#0d1716',
  black: '#111a19',
  red: '#9f1f18',
  green: '#006c46',
  yellow: '#704600',
  blue: '#075985',
  magenta: '#9d174d',
  cyan: '#006f6a',
  white: '#dbe5e2',
  brightBlack: '#52635f',
  brightRed: '#c2271f',
  brightGreen: '#007f55',
  brightYellow: '#865b00',
  brightBlue: '#0369a1',
  brightMagenta: '#be185d',
  brightCyan: '#007f89',
  brightWhite: '#ffffff',
};

// ---------------------------------------------------------------------------
// xterm.css inlined to avoid static/dynamic CSS import issues with Turbopack.
// Source: @xterm/xterm v6 (MIT license)
// ---------------------------------------------------------------------------

const XTERM_CSS = `
.xterm { cursor: text; position: relative; user-select: none; -ms-user-select: none; -webkit-user-select: none; }
.xterm.focus, .xterm:focus { outline: none; }
.xterm .xterm-helpers { position: absolute; top: 0; z-index: 5; }
.xterm .xterm-helper-textarea { padding: 0; border: 0; margin: 0; position: absolute; opacity: 0; left: -9999em; top: 0; width: 0; height: 0; z-index: -5; white-space: nowrap; overflow: hidden; resize: none; }
.xterm .composition-view { background: var(--hud-terminal-bg, #091112); color: var(--hud-terminal-fg, #d7e5e2); display: none; position: absolute; white-space: nowrap; z-index: 1; }
.xterm .composition-view.active { display: block; }
.xterm .xterm-viewport { background-color: var(--hud-terminal-bg, transparent); overflow-y: scroll; cursor: default; position: absolute; right: 0; left: 0; top: 0; bottom: 0; }
.xterm .xterm-screen { position: relative; }
.xterm .xterm-screen canvas { position: absolute; left: 0; top: 0; }
.xterm-char-measure-element { display: inline-block; visibility: hidden; position: absolute; top: 0; left: -9999em; line-height: normal; }
.xterm.enable-mouse-events { cursor: default; }
.xterm.xterm-cursor-pointer, .xterm .xterm-cursor-pointer { cursor: pointer; }
.xterm.column-select.focus { cursor: crosshair; }
.xterm .xterm-accessibility:not(.debug), .xterm .xterm-message { position: absolute; left: 0; top: 0; bottom: 0; right: 0; z-index: 10; color: transparent; pointer-events: none; }
.xterm .xterm-accessibility-tree:not(.debug) *::selection { color: transparent; }
.xterm .xterm-accessibility-tree { font-family: monospace; user-select: text; white-space: pre; }
.xterm .xterm-accessibility-tree > div { transform-origin: left; width: fit-content; }
.xterm .live-region { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
.xterm-dim { opacity: 1 !important; }
.xterm-underline-1 { text-decoration: underline; }
.xterm-underline-2 { text-decoration: double underline; }
.xterm-underline-3 { text-decoration: wavy underline; }
.xterm-underline-4 { text-decoration: dotted underline; }
.xterm-underline-5 { text-decoration: dashed underline; }
.xterm-overline { text-decoration: overline; }
.xterm-overline.xterm-underline-1 { text-decoration: overline underline; }
.xterm-overline.xterm-underline-2 { text-decoration: overline double underline; }
.xterm-overline.xterm-underline-3 { text-decoration: overline wavy underline; }
.xterm-overline.xterm-underline-4 { text-decoration: overline dotted underline; }
.xterm-overline.xterm-underline-5 { text-decoration: overline dashed underline; }
.xterm-strikethrough { text-decoration: line-through; }
.xterm-screen .xterm-decoration-container .xterm-decoration { z-index: 6; position: absolute; }
.xterm-screen .xterm-decoration-container .xterm-decoration.xterm-decoration-top-layer { z-index: 7; }
.xterm-decoration-overview-ruler { z-index: 8; position: absolute; top: 0; right: 0; pointer-events: none; }
.xterm-decoration-top { z-index: 2; position: relative; }
.xterm .xterm-scrollable-element > .scrollbar { cursor: default; }
.xterm .xterm-scrollable-element > .scrollbar > .scra { cursor: pointer; font-size: 11px !important; }
.xterm .xterm-scrollable-element > .visible { opacity: 1; background: rgba(0,0,0,0); transition: opacity 100ms linear; z-index: 11; }
.xterm .xterm-scrollable-element > .invisible { opacity: 0; pointer-events: none; }
.xterm .xterm-scrollable-element > .invisible.fade { transition: opacity 800ms linear; }
.xterm .xterm-scrollable-element > .shadow { position: absolute; display: none; }
.xterm .xterm-scrollable-element > .shadow.top { display: block; top: 0; left: 3px; height: 3px; width: 100%; }
.xterm .xterm-scrollable-element > .shadow.left { display: block; top: 3px; left: 0; height: 100%; width: 3px; }
`;

function injectXtermCss() {
  if (typeof document === 'undefined') return;
  if (document.querySelector('[data-xterm-css]')) return;
  const style = document.createElement('style');
  style.setAttribute('data-xterm-css', '');
  style.textContent = XTERM_CSS;
  document.head.appendChild(style);
}

function isElementVisible(el: HTMLElement | null): boolean {
  if (!el) return false;
  if (!el.closest('[data-hudson-terminal-drawer-content="true"]')) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// CSI-u modified Enter: key code 13 with Shift modifier 2.
const SHIFT_ENTER_INPUT = '\x1b[13;2u';
const ENTER_INPUT = '\x0d';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data:...;base64, prefix
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TerminalRelay({
  relay,
  fontSize = 12,
  fontFamily = "'JetBrains Mono', 'Hack Nerd Font', monospace",
  colorScheme = 'auto',
  configItems,
  onOpenSettings,
  onStartService,
  quiet = false,
}: TerminalRelayProps) {
  const { status, error, exitCode, cwd, setCwd, sendInput, resize, onData, connect, disconnect } = relay;
  const [starting, setStarting] = useState(false);
  const { apiBaseUrl } = usePlatform();
  const themeContext = useOptionalTheme();
  const resolvedColorScheme = colorScheme === 'auto'
    ? (themeContext?.resolvedTheme === 'light' ? 'light' : 'dark')
    : colorScheme;
  const xtermTheme = resolvedColorScheme === 'light'
    ? XTERM_CONSOLE_LIGHT_THEME
    : XTERM_CONSOLE_DARK_THEME;
  const minimumContrastRatio = resolvedColorScheme === 'light' ? 4.5 : 3;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<import('@xterm/xterm').Terminal | null>(null);
  const fitRef = useRef<import('@xterm/addon-fit').FitAddon | null>(null);
  const pendingVoiceInputRef = useRef<HudsonTerminalVoiceTranscriptDetail | null>(null);
  const pendingVoiceSubmitRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);

  // ---- Prevent unmodified Space from propagating to Frame's space+pan handler ----
  // This is more robust than Frame trying to detect .xterm — the terminal
  // guards its own events so the space key always works reliably.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const stopSpace = (e: KeyboardEvent) => {
      if (e.key === ' ' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.stopPropagation();
      }
    };
    el.addEventListener('keydown', stopSpace);
    return () => el.removeEventListener('keydown', stopSpace);
  }, []);

  // ---- Upload helper ----
  const uploadUrl = `${apiBaseUrl}/api/relay/upload`;

  const sendVoiceTranscript = useCallback((detail: HudsonTerminalVoiceTranscriptDetail) => {
    const transcript = detail.transcript.replace(/\s+/g, ' ').trim();
    if (!transcript) return;
    sendInput(detail.submit ? `${transcript}${ENTER_INPUT}` : transcript);
  }, [sendInput]);

  const sendVoiceSubmit = useCallback(() => {
    sendInput(ENTER_INPUT);
  }, [sendInput]);

  useEffect(() => {
    const handleVoiceTranscript = (event: Event) => {
      if (!isElementVisible(wrapperRef.current)) return;

      const detail = (event as CustomEvent<HudsonTerminalVoiceTranscriptDetail>).detail;
      if (!detail || typeof detail.transcript !== 'string') return;

      if (status === 'connected') {
        sendVoiceTranscript(detail);
        return;
      }

      pendingVoiceInputRef.current = detail;
      if (status !== 'connecting') {
        connect();
      }
    };

    window.addEventListener(HUDSON_TERMINAL_VOICE_TRANSCRIPT_EVENT, handleVoiceTranscript);
    return () => window.removeEventListener(HUDSON_TERMINAL_VOICE_TRANSCRIPT_EVENT, handleVoiceTranscript);
  }, [connect, sendVoiceTranscript, status]);

  useEffect(() => {
    if (status !== 'connected' || !pendingVoiceInputRef.current) return;
    const detail = pendingVoiceInputRef.current;
    pendingVoiceInputRef.current = null;
    sendVoiceTranscript(detail);
  }, [sendVoiceTranscript, status]);

  useEffect(() => {
    const handleVoiceSubmit = () => {
      if (!isElementVisible(wrapperRef.current)) return;

      if (status === 'connected') {
        sendVoiceSubmit();
        return;
      }

      pendingVoiceSubmitRef.current = true;
      if (status !== 'connecting') {
        connect();
      }
    };

    window.addEventListener(HUDSON_TERMINAL_VOICE_SUBMIT_EVENT, handleVoiceSubmit);
    return () => window.removeEventListener(HUDSON_TERMINAL_VOICE_SUBMIT_EVENT, handleVoiceSubmit);
  }, [connect, sendVoiceSubmit, status]);

  useEffect(() => {
    if (status !== 'connected' || !pendingVoiceSubmitRef.current) return;
    pendingVoiceSubmitRef.current = false;
    sendVoiceSubmit();
  }, [sendVoiceSubmit, status]);

  const uploadFile = useCallback(async (file: File): Promise<string | null> => {
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, data: base64 }),
      });
      const { path } = (await res.json()) as { path: string };
      return path || null;
    } catch (err) {
      console.error('File upload failed:', err);
      return null;
    }
  }, [uploadUrl]);

  // ---- Clipboard paste handler (images) ----
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const handlePaste = async (e: ClipboardEvent) => {
      if (!e.clipboardData) return;

      const imageItems = Array.from(e.clipboardData.items).filter(
        (item) => item.type.startsWith('image/'),
      );
      if (imageItems.length === 0) return; // text paste — let xterm handle it

      e.preventDefault();
      e.stopPropagation();

      for (const item of imageItems) {
        const file = item.getAsFile();
        if (!file) continue;
        const path = await uploadFile(file);
        if (path) sendInput(path);
      }
    };

    el.addEventListener('paste', handlePaste);
    return () => el.removeEventListener('paste', handlePaste);
  }, [sendInput, uploadFile]);

  // ---- Image drop handlers ----
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragging(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);

    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('image/'),
    );
    if (files.length === 0) return;

    for (const file of files) {
      const path = await uploadFile(file);
      if (path) sendInput(path);
    }
  }, [sendInput, uploadFile]);

  // ---- Load xterm.js dynamically (SSR-safe) and create terminal ----
  useEffect(() => {
    let disposed = false;
    let terminal: import('@xterm/xterm').Terminal | null = null;

    async function init() {
      const [{ Terminal }, { FitAddon }, webglMod] = await Promise.all([
        import('@xterm/xterm'),
        import('@xterm/addon-fit'),
        import('@xterm/addon-webgl').catch(() => null),
      ]);

      injectXtermCss();

      if (disposed || !containerRef.current) return;

      terminal = new Terminal({
        fontSize,
        fontFamily,
        theme: xtermTheme,
        minimumContrastRatio,
        cursorBlink: true,
        cursorStyle: 'bar',
        allowTransparency: true,
        scrollback: 5000,
        convertEol: false,
        allowProposedApi: true,
      });

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(containerRef.current);

      // GPU-accelerated rendering (graceful fallback to DOM renderer)
      if (webglMod) {
        try {
          const webglAddon = new webglMod.WebglAddon();
          webglAddon.onContextLoss(() => { webglAddon.dispose(); });
          terminal.loadAddon(webglAddon);
        } catch {}
      }

      // Initial fit
      try { fitAddon.fit(); } catch {}

      termRef.current = terminal;
      fitRef.current = fitAddon;

      // Send initial dimensions to relay
      resize(terminal.cols, terminal.rows);

      terminal.attachCustomKeyEventHandler((event) => {
        if (
          event.type === 'keydown' &&
          event.key === 'Enter' &&
          event.shiftKey &&
          !event.ctrlKey &&
          !event.altKey &&
          !event.metaKey
        ) {
          event.preventDefault();
          event.stopPropagation();
          sendInput(SHIFT_ENTER_INPUT);
          return false;
        }
        return true;
      });

      // Forward keystrokes from xterm → relay
      terminal.onData((data) => {
        sendInput(data);
      });

      setReady(true);
    }

    init();

    return () => {
      disposed = true;
      if (terminal) {
        terminal.dispose();
        termRef.current = null;
        fitRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Update font options without recreating terminal ----
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.fontSize = fontSize;
    term.options.fontFamily = fontFamily;
    try { fitRef.current?.fit(); } catch {}
  }, [fontSize, fontFamily]);

  // ---- Keep xterm colors aligned with the terminal color scheme ----
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.theme = xtermTheme;
    term.options.minimumContrastRatio = minimumContrastRatio;
  }, [minimumContrastRatio, xtermTheme]);

  // ---- Wire relay.onData → terminal.write ----
  useEffect(() => {
    if (!ready) return;

    onData((data: string) => {
      termRef.current?.write(data);
    });

    return () => {
      onData(null);
    };
  }, [ready, onData]);

  // ---- ResizeObserver → fit → send resize to relay ----
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !ready) return;

    const observer = new ResizeObserver(() => {
      const fit = fitRef.current;
      const term = termRef.current;
      if (!fit || !term) return;
      try {
        fit.fit();
        resize(term.cols, term.rows);
      } catch {}
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [ready, resize]);

  // ---- Focus terminal when connected ----
  useEffect(() => {
    if (status === 'connected' && termRef.current) {
      termRef.current.focus();
    }
  }, [status]);

  // ---- Click anywhere on wrapper → focus xterm ----
  const handleWrapperClick = useCallback(() => {
    if (status === 'connected' && termRef.current) {
      termRef.current.focus();
    }
  }, [status]);

  // ---- Overlay for non-active states ----
  const isServiceDown = status === 'error' && error === 'Relay service is not running';

  const handleStartAndConnect = useCallback(async () => {
    if (!onStartService) return;
    setStarting(true);
    try {
      const ok = await onStartService();
      if (ok) {
        // Give service a moment to be ready, then connect
        setTimeout(() => connect(), 500);
      }
    } finally {
      setStarting(false);
    }
  }, [onStartService, connect]);

  let overlay: React.ReactNode = null;
  if (isServiceDown) {
    // Service not running — show helpful CTA
    overlay = (
      <div className="flex flex-col items-center gap-4 max-w-xs text-center px-4">
        <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <span className="text-amber-400 text-[14px]">!</span>
        </div>
        <div>
          <div className="text-[12px] text-foreground font-medium mb-1">Relay service not running</div>
          <div className="text-[11px] text-muted-foreground/80 leading-relaxed">
            {onStartService
              ? 'Start the relay service to open a terminal session.'
              : 'Start the relay service from the Workspace Manager.'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onStartService && (
            <button
              type="button"
              onClick={handleStartAndConnect}
              disabled={starting}
              className="text-[11px] px-4 py-1.5 rounded-full border border-accent/30 text-accent hover:bg-accent/10 transition-colors font-medium disabled:opacity-50"
            >
              {starting ? 'Starting...' : 'Start Service'}
            </button>
          )}
          <button
            type="button"
            onClick={() => connect()}
            className="text-[11px] px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Retry
          </button>
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="text-[11px] px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Settings
            </button>
          )}
        </div>
      </div>
    );
  } else if (status === 'error' && error) {
    overlay = (
      <div className="flex flex-col items-center gap-3 max-w-md text-center px-4">
        <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
          <span className="text-red-400 text-sm">!</span>
        </div>
        <span className="text-red-400 text-[12px] font-medium">Session failed</span>
        <code className="text-[11px] text-muted-foreground bg-muted/80 px-3 py-2 rounded-md whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto w-full text-left">
          {error}
        </code>
        {exitCode !== null && exitCode !== 0 && (
          <span className="text-[10px] text-muted-foreground/60">Exit code {exitCode}</span>
        )}
        <button
          type="button"
          onClick={() => connect()}
          className="text-[11px] px-3 py-1 rounded-full border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  } else if (status === 'disconnected' && !quiet) {
    overlay = (
      <div className="flex flex-col items-center gap-4 max-w-xs text-center px-4">
        <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center">
          <span className="text-muted-foreground/80 text-[14px]">&#9655;</span>
        </div>
        <div>
          <div className="text-[12px] text-foreground font-medium mb-1">Terminal relay disconnected</div>
          <div className="text-[11px] text-muted-foreground/80 leading-relaxed">Set working directory and connect.</div>
        </div>
        {/* Editable CWD */}
        <form className="w-full" onSubmit={(e) => { e.preventDefault(); connect(); }}>
          <label className="text-[10px] font-mono text-muted-foreground/80 uppercase tracking-wider mb-1 block text-left">
            Working Directory
          </label>
          <input
            type="text"
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
            placeholder="~/dev/my-project"
            className="w-full bg-muted/80 border border-border/50 rounded px-3 py-1.5 text-[11px] font-mono text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-accent/40 transition-colors"
            spellCheck={false}
            autoComplete="off"
          />
        </form>
        {configItems && configItems.length > 0 && (
          <div className="w-full grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[10px] font-mono bg-muted/60 border border-border/40 rounded-md px-3 py-2">
            {configItems.map(item => (
              <div key={item.label} className="contents">
                <span className="text-muted-foreground/80">{item.label}</span>
                <span className="text-muted-foreground truncate text-left">{item.value}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => connect()}
            className="text-[11px] px-4 py-1.5 rounded-full border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 transition-colors font-medium"
          >
            Connect
          </button>
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="text-[11px] px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Settings
            </button>
          )}
        </div>
      </div>
    );
  } else if (status === 'connecting' && !quiet) {
    overlay = (
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-6 h-6 border-2 border-muted-foreground/30 border-t-cyan-500 rounded-full animate-spin" />
        <span className="text-[12px] text-muted-foreground">Connecting to relay...</span>
        <button
          type="button"
          onClick={() => { disconnect(); }}
          className="text-[10px] px-3 py-1 rounded-full border border-border text-muted-foreground/80 hover:text-foreground hover:bg-muted transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className="relative flex flex-col h-full overflow-hidden"
      onClick={handleWrapperClick}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {overlay && (
        <div className="flex items-center justify-center h-full font-mono text-[12px] absolute inset-0 z-10 bg-background/95">
          {overlay}
        </div>
      )}
      {dragging && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-cyan-500/10 border-2 border-dashed border-cyan-500/50 rounded pointer-events-none">
          <span className="text-cyan-400 font-mono text-sm">Drop image to get path</span>
        </div>
      )}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 min-w-0 overflow-hidden"
        style={{
          visibility: overlay ? 'hidden' : 'visible',
          padding: '4px 8px',
          backgroundColor: xtermTheme.background,
          '--hud-terminal-bg': xtermTheme.background,
          '--hud-terminal-fg': xtermTheme.foreground,
        } as CSSProperties}
      />
    </div>
  );
}

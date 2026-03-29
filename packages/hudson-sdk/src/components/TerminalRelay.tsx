'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import type { TerminalRelayHandle } from '../hooks/useTerminalRelay';
import { usePlatform } from '../platform/PlatformContext';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TerminalRelayConfigItem {
  label: string;
  value: string;
}

interface TerminalRelayProps {
  relay: TerminalRelayHandle;
  fontSize?: number;
  fontFamily?: string;
  /** Key/value pairs shown in the disconnected state so users can see current config at a glance */
  configItems?: TerminalRelayConfigItem[];
  /** Called when the user clicks "Settings" in the disconnected overlay */
  onOpenSettings?: () => void;
  /** Called when the relay service is not running and the user clicks "Start Service". If provided, shows the button. */
  onStartService?: () => Promise<boolean>;
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
// One Dark theme for xterm.js
// ---------------------------------------------------------------------------

const XTERM_THEME = {
  background: '#1a1a1a',
  foreground: '#abb2bf',
  cursor: '#528bff',
  cursorAccent: '#1a1a1a',
  selectionBackground: '#3e4451',
  selectionForeground: '#abb2bf',
  black: '#1a1a1a',
  red: '#e06c75',
  green: '#98c379',
  yellow: '#e5c07b',
  blue: '#61afef',
  magenta: '#c678dd',
  cyan: '#56b6c2',
  white: '#abb2bf',
  brightBlack: '#5c6370',
  brightRed: '#e06c75',
  brightGreen: '#98c379',
  brightYellow: '#e5c07b',
  brightBlue: '#61afef',
  brightMagenta: '#c678dd',
  brightCyan: '#56b6c2',
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
.xterm .composition-view { background: #000; color: #FFF; display: none; position: absolute; white-space: nowrap; z-index: 1; }
.xterm .composition-view.active { display: block; }
.xterm .xterm-viewport { background-color: #000; overflow-y: scroll; cursor: default; position: absolute; right: 0; left: 0; top: 0; bottom: 0; }
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  configItems,
  onOpenSettings,
  onStartService,
}: TerminalRelayProps) {
  const { status, error, exitCode, cwd, setCwd, sendInput, resize, onData, connect, disconnect } = relay;
  const [starting, setStarting] = useState(false);
  const { apiBaseUrl } = usePlatform();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<import('@xterm/xterm').Terminal | null>(null);
  const fitRef = useRef<import('@xterm/addon-fit').FitAddon | null>(null);
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
        theme: XTERM_THEME,
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

  // ---- Wire relay.onData → terminal.write ----
  useEffect(() => {
    if (!ready) return;

    onData((data: string) => {
      termRef.current?.write(data);
    });

    return () => {
      onData(() => {});
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
          <div className="text-[12px] text-neutral-300 font-medium mb-1">Relay service not running</div>
          <div className="text-[11px] text-neutral-500 leading-relaxed">
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
              className="text-[11px] px-4 py-1.5 rounded-full border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors font-medium disabled:opacity-50"
            >
              {starting ? 'Starting...' : 'Start Service'}
            </button>
          )}
          <button
            type="button"
            onClick={() => connect()}
            className="text-[11px] px-3 py-1.5 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-300 hover:bg-white/5 transition-colors"
          >
            Retry
          </button>
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="text-[11px] px-3 py-1.5 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-300 hover:bg-white/5 transition-colors"
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
        <code className="text-[11px] text-neutral-400 bg-neutral-800/80 px-3 py-2 rounded-md whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto w-full text-left">
          {error}
        </code>
        {exitCode !== null && exitCode !== 0 && (
          <span className="text-[10px] text-neutral-600">Exit code {exitCode}</span>
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
  } else if (status === 'disconnected') {
    overlay = (
      <div className="flex flex-col items-center gap-4 max-w-xs text-center px-4">
        <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center">
          <span className="text-neutral-500 text-[14px]">&#9655;</span>
        </div>
        <div>
          <div className="text-[12px] text-neutral-300 font-medium mb-1">Terminal relay disconnected</div>
          <div className="text-[11px] text-neutral-500 leading-relaxed">Set working directory and connect.</div>
        </div>
        {/* Editable CWD */}
        <form className="w-full" onSubmit={(e) => { e.preventDefault(); connect(); }}>
          <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-1 block text-left">
            Working Directory
          </label>
          <input
            type="text"
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
            placeholder="~/dev/my-project"
            className="w-full bg-neutral-800/80 border border-neutral-700/50 rounded px-3 py-1.5 text-[11px] font-mono text-neutral-200 placeholder:text-neutral-600 outline-none focus:border-cyan-500/40 transition-colors"
            spellCheck={false}
            autoComplete="off"
          />
        </form>
        {configItems && configItems.length > 0 && (
          <div className="w-full grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[10px] font-mono bg-neutral-800/60 border border-neutral-700/40 rounded-md px-3 py-2">
            {configItems.map(item => (
              <div key={item.label} className="contents">
                <span className="text-neutral-500">{item.label}</span>
                <span className="text-neutral-400 truncate text-left">{item.value}</span>
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
              className="text-[11px] px-3 py-1.5 rounded-full border border-neutral-700 text-neutral-400 hover:text-neutral-300 hover:bg-white/5 transition-colors"
            >
              Settings
            </button>
          )}
        </div>
      </div>
    );
  } else if (status === 'connecting') {
    overlay = (
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-6 h-6 border-2 border-neutral-600 border-t-cyan-400 rounded-full animate-spin" />
        <span className="text-[12px] text-neutral-400">Connecting to relay...</span>
        <button
          type="button"
          onClick={() => { disconnect(); }}
          className="text-[10px] px-3 py-1 rounded-full border border-neutral-700 text-neutral-500 hover:text-neutral-300 hover:bg-white/5 transition-colors"
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
        <div className="flex items-center justify-center h-full font-mono text-[12px] absolute inset-0 z-10 bg-neutral-900/90">
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
        }}
      />
    </div>
  );
}

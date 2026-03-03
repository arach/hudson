'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import type { TerminalRelayHandle } from '../hooks/useTerminalRelay';
import { usePlatform } from '../platform/PlatformContext';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TerminalRelayProps {
  relay: TerminalRelayHandle;
  fontSize?: number;
  fontFamily?: string;
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
}: TerminalRelayProps) {
  const { status, error, exitCode, sendInput, resize, onData, connect } = relay;
  const { apiBaseUrl } = usePlatform();
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<import('@xterm/xterm').Terminal | null>(null);
  const fitRef = useRef<import('@xterm/addon-fit').FitAddon | null>(null);
  const [ready, setReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);

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
      try {
        const base64 = await fileToBase64(file);
        const res = await fetch(`${apiBaseUrl}/api/relay/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: file.name, data: base64 }),
        });
        const { path } = (await res.json()) as { path: string };
        if (path) {
          sendInput(path);
        }
      } catch (err) {
        console.error('Image upload failed:', err);
      }
    }
  }, [sendInput, apiBaseUrl]);

  // ---- Load xterm.js dynamically (SSR-safe) and create terminal ----
  useEffect(() => {
    let disposed = false;
    let terminal: import('@xterm/xterm').Terminal | null = null;

    async function init() {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import('@xterm/xterm'),
        import('@xterm/addon-fit'),
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

  // ---- Overlay for non-active states ----
  let overlay: React.ReactNode = null;
  if (status === 'error' && error) {
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
    overlay = <span className="text-neutral-500">Terminal relay disconnected</span>;
  } else if (status === 'connecting') {
    overlay = <span className="text-neutral-500 animate-pulse">Connecting to relay...</span>;
  }

  return (
    <div
      className="relative flex flex-col h-full overflow-hidden"
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
        className="flex-1 min-h-0"
        style={{
          visibility: overlay ? 'hidden' : 'visible',
          padding: '4px 8px',
        }}
      />
    </div>
  );
}

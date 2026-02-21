'use client';

import { useShaper } from '../ShaperProvider';
import { useShellLayout } from '../../../shell/ShellLayoutContext';
import { sounds } from 'frame-ui';
import type { Tool } from '../types';

export function ToolPalette() {
  const { tool, switchTool, undo, redo, animationModeEnabled, setAnimationModeEnabled } = useShaper();
  const { rightWidth } = useShellLayout();

  const tools: { id: Tool; icon: string; label: string }[] = [
    { id: 'select', icon: '\u2196', label: 'Select (V)' },
    { id: 'pen', icon: '\u2712', label: 'Pen (P)' },
    { id: 'hand', icon: '\u270B', label: 'Hand (H)' },
  ];

  return (
    <div
      className="absolute top-16 z-[45] flex items-center gap-1 rounded-lg border border-neutral-800 bg-black/90 p-1 backdrop-blur-xl shadow-lg pointer-events-auto transition-all duration-300"
      style={{ right: rightWidth ? `${rightWidth + 16}px` : '16px' }}
    >
      {tools.map((t) => (
        <button
          key={t.id}
          onClick={() => { switchTool(t.id); sounds.click(); }}
          title={t.label}
          className={`flex h-7 w-7 items-center justify-center rounded text-sm transition-colors ${
            tool === t.id ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:bg-white/10 hover:text-white'
          }`}
        >
          {t.icon}
        </button>
      ))}
      <div className="w-px h-5 bg-neutral-700 mx-0.5" />
      <button onClick={undo} title="Undo (Cmd+Z)" className="flex h-7 w-7 items-center justify-center rounded text-sm text-neutral-400 hover:bg-white/10 hover:text-white transition-colors">{'\u21A9'}</button>
      <button onClick={redo} title="Redo (Cmd+Shift+Z)" className="flex h-7 w-7 items-center justify-center rounded text-sm text-neutral-400 hover:bg-white/10 hover:text-white transition-colors">{'\u21AA'}</button>
      <div className="w-px h-5 bg-neutral-700 mx-0.5" />
      <button
        onClick={() => { setAnimationModeEnabled(!animationModeEnabled); sounds.click(); }}
        title={animationModeEnabled ? 'Disable Animation Mode (T)' : 'Enable Animation Mode (T)'}
        className={`flex h-7 items-center justify-center rounded px-2 gap-1 text-[10px] font-bold font-mono transition-all ${
          animationModeEnabled
            ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30'
            : 'bg-neutral-800/50 text-neutral-500 hover:bg-neutral-700/50 hover:text-neutral-300'
        }`}
      >
        <span className="text-[11px]">{animationModeEnabled ? '\u25FC' : '\u25B6'}</span>
        <span className="tracking-wider">ANIM</span>
      </button>
    </div>
  );
}

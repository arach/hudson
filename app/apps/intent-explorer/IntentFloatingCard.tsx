'use client';

import { useState } from 'react';
import { GripHorizontal, X } from 'lucide-react';
import type { AppIntent } from 'frame-ui';
import { CATEGORY_COLORS } from './types';

interface IntentFloatingCardProps {
  intent: AppIntent;
  appId: string;
  zIndex: number;
  position: { x: number; y: number };
  onDragStart: (e: React.MouseEvent) => void;
  onClose: () => void;
  onFocus: () => void;
}

export function IntentFloatingCard({
  intent,
  appId,
  zIndex,
  position,
  onDragStart,
  onClose,
  onFocus,
}: IntentFloatingCardProps) {
  const [isFocused, setIsFocused] = useState(false);
  const categoryColors = CATEGORY_COLORS[intent.category];

  return (
    <div
      className={`absolute w-[320px] rounded-lg border backdrop-blur-md shadow-lg select-none transition-shadow duration-150 ${
        isFocused
          ? 'border-emerald-500/40 shadow-emerald-500/10'
          : 'border-neutral-700/60 shadow-black/30'
      }`}
      style={{
        left: position.x,
        top: position.y,
        zIndex,
        background: 'rgba(10, 10, 10, 0.95)',
      }}
      onMouseDown={(e) => {
        onFocus();
        setIsFocused(true);
      }}
      onBlur={() => setIsFocused(false)}
      tabIndex={-1}
    >
      {/* Header — drag handle */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 border-b border-neutral-700/50 cursor-grab active:cursor-grabbing"
        onMouseDown={onDragStart}
      >
        <GripHorizontal size={12} className="text-neutral-500 shrink-0" />
        <span className="flex-1 text-[12px] font-mono font-bold text-white truncate">
          {intent.title}
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-white/10 transition-colors text-neutral-400 hover:text-neutral-200"
        >
          <X size={11} />
        </button>
      </div>

      {/* Body */}
      <div className="p-3 space-y-3">
        {/* commandId */}
        <div className="text-[10px] font-mono text-emerald-400 truncate">
          {intent.commandId}
        </div>

        {/* Category + app */}
        <div className="flex items-center gap-2">
          <span
            className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${categoryColors}`}
          >
            {intent.category}
          </span>
          <span className="text-[10px] font-mono text-neutral-500">{appId}</span>
        </div>

        {/* Shortcut */}
        {intent.shortcut && (
          <div>
            <kbd className="bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded text-[10px] font-mono">
              {intent.shortcut}
            </kbd>
          </div>
        )}

        {/* Description */}
        <div className="text-[10px] font-mono text-neutral-400 leading-relaxed">
          {intent.description}
        </div>

        {/* Keywords */}
        {intent.keywords.length > 0 && (
          <div className="text-[10px] font-mono text-neutral-500">
            {intent.keywords.join(' \u00b7 ')}
          </div>
        )}
      </div>
    </div>
  );
}

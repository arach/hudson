'use client';

import React from 'react';
import { Hand, RotateCcw } from 'lucide-react';
import ZoomControls from '../chrome/ZoomControls';

interface CanvasToolDockProps {
  scale: number;
  onScaleChange: (scale: number) => void;
  handMode: boolean;
  onHandModeChange: (enabled: boolean) => void;
  onResetView: () => void;
  minScale?: number;
  maxScale?: number;
  zoomStep?: number;
  right?: number;
  bottom?: number;
  className?: string;
}

const CanvasToolDock: React.FC<CanvasToolDockProps> = ({
  scale,
  onScaleChange,
  handMode,
  onHandModeChange,
  onResetView,
  minScale = 0.2,
  maxScale = 3,
  zoomStep = 0.1,
  right = 16,
  bottom = 44,
  className = '',
}) => (
  <div
    className={`absolute z-20 flex flex-col items-center gap-2 ${className}`}
    style={{
      right,
      bottom,
      transition: 'right 200ms ease, bottom 200ms ease',
    }}
  >
    <div className="pointer-events-auto flex flex-col overflow-hidden rounded-md border border-border bg-card/95 shadow-[0_0_18px_rgba(0,0,0,0.16)] backdrop-blur-xl">
      <button
        onClick={() => onHandModeChange(!handMode)}
        className={`flex h-8 w-9 items-center justify-center transition-colors ${
          handMode
            ? 'bg-emerald-700/12 text-emerald-800 dark:text-emerald-200'
            : 'text-muted-foreground hover:bg-accent/10 hover:text-foreground'
        }`}
        title={handMode ? 'Hand mode on' : 'Hand mode'}
      >
        <Hand size={14} />
      </button>
      <button
        onClick={onResetView}
        className="flex h-8 w-9 items-center justify-center border-t border-border text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
        title="Reset preview view"
      >
        <RotateCcw size={13} />
      </button>
    </div>
    <ZoomControls
      scale={scale}
      onZoom={onScaleChange}
      min={minScale}
      max={maxScale}
      step={zoomStep}
    />
  </div>
);

export default CanvasToolDock;

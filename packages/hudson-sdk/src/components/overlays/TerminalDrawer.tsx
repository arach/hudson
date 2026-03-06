import React, { useCallback, useRef } from 'react';
import { X, Maximize2, Minimize2, Terminal } from 'lucide-react';
import { SHELL_THEME } from '../../lib/theme';

const { statusBarHeight } = SHELL_THEME.layout;

interface TerminalDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onToggleMaximize?: () => void;
  isMaximized?: boolean;
  /** Controlled height in px (default 320) */
  height?: number;
  /** Called while dragging the grip to resize */
  onHeightChange?: (h: number) => void;
  /** Custom title content */
  title?: React.ReactNode;
  children: React.ReactNode;
}

const MIN_HEIGHT = 120;

const TerminalDrawer: React.FC<TerminalDrawerProps> = ({
  isOpen, onClose, onToggleMaximize, isMaximized = false,
  height = 320, onHeightChange,
  title, children
}) => {
  const draggingRef = useRef(false);

  const handleGripMouseDown = useCallback((e: React.MouseEvent) => {
    if (!onHeightChange) return;
    e.preventDefault();
    draggingRef.current = true;
    const startY = e.clientY;
    const startHeight = height;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = startY - ev.clientY;
      // Max height: full viewport minus status bar and some padding
      const maxH = window.innerHeight - statusBarHeight;
      onHeightChange(Math.max(MIN_HEIGHT, Math.min(maxH, startHeight + delta)));
    };

    const onMouseUp = () => {
      draggingRef.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [height, onHeightChange]);

  // Drawer sits directly above the status bar, using the shared layout token.
  const computedHeight = isMaximized
    ? `calc(100vh - ${statusBarHeight}px)`
    : `${height}px`;

  return (
    <div
      className={`
        fixed left-0 right-0 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] flex flex-col border-t border-neutral-700
        bg-neutral-950/95 backdrop-blur-xl
        ${isOpen ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-full opacity-0 pointer-events-none'}
        ${draggingRef.current ? '' : 'transition-all duration-300 ease-in-out'}
      `}
      style={{
        bottom: statusBarHeight,
        height: computedHeight,
        zIndex: SHELL_THEME.zIndex.drawer,
      }}
    >
      {/* Header */}
      <div className="h-9 bg-neutral-900/70 border-b border-neutral-700 flex items-center justify-between px-3 shrink-0 select-none backdrop-blur-sm">
        <div className="flex items-center gap-4">
          {title || (
            <div className="flex items-center gap-2 text-emerald-400">
              <Terminal size={14} />
              <span className="text-xs font-bold tracking-widest font-mono">TERMINAL</span>
            </div>
          )}
        </div>

        {/* Center grip — drag to resize */}
        <div
          className="flex-1 flex items-center justify-center h-full cursor-ns-resize text-neutral-500 hover:text-neutral-300 transition-colors group"
          title="Drag to Resize"
          onMouseDown={handleGripMouseDown}
        >
          <div className="w-16 h-1 rounded-full bg-neutral-700 group-hover:bg-neutral-500 transition-colors" />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button onClick={onToggleMaximize} className="p-1.5 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors" title={isMaximized ? "Restore" : "Maximize"}>
            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-red-900/20 text-neutral-400 hover:text-red-400 transition-colors" title="Close">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative overflow-hidden flex flex-col bg-transparent">
        {children}
      </div>
    </div>
  );
};

export default TerminalDrawer;

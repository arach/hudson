import React from 'react';
import { X, Maximize2, Minimize2, Terminal } from 'lucide-react';

interface TerminalDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onToggleMaximize?: () => void;
  isMaximized?: boolean;
  /** Custom title content */
  title?: React.ReactNode;
  children: React.ReactNode;
}

const TerminalDrawer: React.FC<TerminalDrawerProps> = ({
  isOpen, onClose, onToggleMaximize, isMaximized = false,
  title, children
}) => {
  return (
    <div
      className={`
        fixed left-0 right-0 bottom-0 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] transition-all duration-300 ease-in-out z-[70] flex flex-col border-t border-neutral-800
        bg-black/90 backdrop-blur-xl
        ${isOpen ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-full opacity-0 pointer-events-none'}
      `}
      style={{ height: isMaximized ? 'calc(100% - 28px)' : '320px' }}
    >
      {/* Header */}
      <div className="h-9 bg-neutral-900/50 border-b border-neutral-800 flex items-center justify-between px-3 shrink-0 select-none backdrop-blur-sm">
        <div className="flex items-center gap-4">
          {title || (
            <div className="flex items-center gap-2 text-emerald-400">
              <Terminal size={14} />
              <span className="text-xs font-bold tracking-widest font-mono">TERMINAL</span>
            </div>
          )}
        </div>

        {/* Center grip */}
        <div className="flex-1 flex items-center justify-center h-full cursor-ns-resize text-neutral-700 hover:text-neutral-500 transition-colors group" title="Drag to Resize">
          <div className="w-16 h-1 rounded-full bg-neutral-800 group-hover:bg-neutral-700 transition-colors" />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button onClick={onToggleMaximize} className="p-1.5 rounded hover:bg-neutral-800 text-neutral-500 hover:text-white transition-colors" title={isMaximized ? "Restore" : "Maximize"}>
            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-red-900/20 text-neutral-500 hover:text-red-400 transition-colors" title="Close">
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

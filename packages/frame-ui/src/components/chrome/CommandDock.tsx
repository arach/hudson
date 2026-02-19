import React from 'react';
import { Search } from 'lucide-react';

interface CommandDockProps {
  onOpenCommandPalette: () => void;
  /** Additional toggle buttons rendered after the CMD+K trigger */
  extraControls?: React.ReactNode;
}

const CommandDock: React.FC<CommandDockProps> = ({
  onOpenCommandPalette, extraControls
}) => {
  return (
    <div className="select-none font-mono text-[10px] border-t border-neutral-800/50">
      <div className="px-3 py-2 flex items-center justify-between">
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-1.5 text-neutral-500 hover:text-white transition-colors"
        >
          <Search size={10} />
          <span className="tracking-widest font-bold uppercase">Search</span>
        </button>

        <div className="flex items-center gap-2">
          {extraControls}
          <kbd className="text-[9px] text-neutral-600 font-mono">⌘K</kbd>
        </div>
      </div>
    </div>
  );
};

export default CommandDock;

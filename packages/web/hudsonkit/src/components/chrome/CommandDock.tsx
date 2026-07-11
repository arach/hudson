import React from 'react';
import { Search } from '../../icons';

interface CommandDockProps {
  onOpenCommandPalette: () => void;
  /** Additional toggle buttons rendered after the CMD+K trigger */
  extraControls?: React.ReactNode;
}

const CommandDock: React.FC<CommandDockProps> = ({
  onOpenCommandPalette, extraControls
}) => {
  return (
    <div
      className="select-none font-mono text-[11px]"
      style={{ borderTop: '1px dashed var(--hud-chrome-border, oklch(var(--border) / 0.6))' }}
    >
      <div className="px-3 py-2 flex items-center justify-between">
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded"
        >
          <Search size={10} />
          <span className="tracking-[0.18em] font-normal uppercase text-[10px]">Command Palette</span>
        </button>

        <div className="flex items-center gap-2">
          {extraControls}
          <kbd className="text-[10px] text-muted-foreground font-mono">⌘K</kbd>
        </div>
      </div>
    </div>
  );
};

export default CommandDock;

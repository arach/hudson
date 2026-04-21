'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, CornerDownLeft } from 'lucide-react';

export interface CommandOption {
  id: string;
  label: string;
  action: () => void;
  shortcut?: string;
  icon?: React.ReactNode;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandOption[];
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, commands }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  const filteredCommands = commands.filter(cmd =>
    cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 10);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => { setSelectedIndex(0); }, [query]);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && filteredCommands.length === 0) {
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(prev => (prev + 1) % filteredCommands.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filteredCommands[selectedIndex]) { filteredCommands[selectedIndex].action(); onClose(); } }
    else if (e.key === 'Escape') { onClose(); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-background/45 backdrop-blur-[2px] pointer-events-auto" onClick={onClose}>
      <div className="w-[640px] max-w-[90vw] bg-popover border border-border shadow-2xl rounded-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100" onClick={e => e.stopPropagation()}>
        {/* Search input */}
        <div className="flex items-center px-4 py-3 border-b border-border gap-3 focus-within:ring-2 focus-within:ring-ring focus-within:outline-none">
          <Search className="text-muted-foreground" size={18} />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent border-none outline-none text-popover-foreground placeholder:text-muted-foreground font-mono text-sm"
            placeholder="Type a command or search..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <div className="px-1.5 py-0.5 rounded bg-muted border border-border text-[12px] text-muted-foreground font-mono">ESC</div>
        </div>

        {/* Results */}
        <div className="max-h-[300px] overflow-y-auto py-2 relative">
          <div className="pb-2">
            {filteredCommands.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted-foreground text-xs font-mono">No matching commands</div>
            ) : (
              filteredCommands.map((cmd, idx) => (
              <div
                key={cmd.id}
                ref={idx === selectedIndex ? selectedRef : null}
                tabIndex={0}
                className={`px-4 py-2.5 flex items-center gap-3 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:bg-muted ${
                  idx === selectedIndex ? 'bg-accent/10 border-l-2 border-accent' : 'border-l-2 border-transparent hover:bg-muted/70'
                }`}
                onClick={() => { cmd.action(); onClose(); }}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                {cmd.icon && <div className={`${idx === selectedIndex ? 'text-accent' : 'text-muted-foreground'}`}>{cmd.icon}</div>}
                <div className="flex-1">
                  <div className={`text-sm ${idx === selectedIndex ? 'text-accent' : 'text-popover-foreground'}`}>{cmd.label}</div>
                </div>
                {cmd.shortcut && (
                  <div className="text-[12px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">{cmd.shortcut}</div>
                )}
                {idx === selectedIndex && <CornerDownLeft size={14} className="text-accent ml-2" />}
              </div>
              ))
            )}
          </div>
          {/* Fade gradient at bottom when scrollable */}
          {filteredCommands.length > 6 && (
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-popover to-transparent pointer-events-none" />
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-1.5 bg-card/90 backdrop-blur-sm border-t border-border flex justify-between items-center text-[12px] text-muted-foreground font-mono relative z-10">
          <span>Command Palette</span>
          <span>{filteredCommands.length} matches</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;

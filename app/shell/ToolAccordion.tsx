'use client';

import { ChevronRight } from 'lucide-react';
import type { AppTool } from '@hudson/sdk';

interface ToolAccordionProps {
  tools: AppTool[];
  expandedToolId: string | null;
  onToggle: (toolId: string) => void;
}

export function ToolAccordion({ tools, expandedToolId, onToggle }: ToolAccordionProps) {
  if (tools.length === 0) return null;

  return (
    <div>
      <div className="px-3 pt-3 pb-1.5 text-[9px] font-mono uppercase tracking-widest text-neutral-600">
        Tools
      </div>
      {tools.map(tool => {
        const isExpanded = expandedToolId === tool.id;
        return (
          <div key={tool.id} className="border-b border-neutral-800/50 last:border-b-0">
            <button
              onClick={() => onToggle(tool.id)}
              className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 hover:text-neutral-300 bg-neutral-900/30 hover:bg-neutral-900/50 transition-colors"
            >
              <ChevronRight
                size={10}
                className={`text-neutral-600 transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
              />
              <span className="text-neutral-600 shrink-0">{tool.icon}</span>
              <span className="flex-1 text-left">{tool.name}</span>
            </button>
            {isExpanded && (
              <div className="animate-in slide-in-from-top-1 duration-150">
                <tool.Component />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

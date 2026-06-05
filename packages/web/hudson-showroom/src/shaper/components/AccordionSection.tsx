'use client';

import type { ReactNode } from 'react';

interface AccordionSectionProps {
  id: string;
  title: string;
  icon: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  badge?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
}

export function AccordionSection({ id, title, icon, isOpen, onToggle, badge, headerActions, children }: AccordionSectionProps) {
  return (
    <div className="border-b border-neutral-800/50">
      <div className="w-full flex items-center gap-2 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 bg-neutral-900/30">
        <button onClick={onToggle} className="flex items-center gap-2 flex-1 hover:text-neutral-300 transition-colors">
          <span className="text-neutral-600 shrink-0">{icon}</span>
          <span className="flex-1 text-left">{title}</span>
          {badge}
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-neutral-600 transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`}><path d="m6 9 6 6 6-6"/></svg>
        </button>
        {headerActions}
      </div>
      {isOpen && children}
    </div>
  );
}

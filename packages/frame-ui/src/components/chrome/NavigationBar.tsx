import React from 'react';
import { Search, X } from 'lucide-react';

interface NavigationBarProps {
  /** App title/branding */
  title: string;
  /** Subtitle (e.g. filename, project name) */
  subtitle?: React.ReactNode;
  /** Center content slot */
  center?: React.ReactNode;
  /** Right-side actions slot (placed before the search field) */
  actions?: React.ReactNode;
  onTitleClick?: () => void;
  /** Search/filter field */
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
}

const NavigationBar: React.FC<NavigationBarProps> = ({
  title, subtitle, center, actions, onTitleClick, search,
}) => {
  const isFiltered = search && search.value && search.value.length > 0;

  return (
    <div
      data-frame-panel="navigation"
      className="fixed top-0 left-0 right-0 z-50 pointer-events-auto"
    >
      <div className="h-12 bg-black/90 backdrop-blur-xl border-b border-neutral-800/80 shadow-[0_4px_30px_rgba(0,0,0,0.5)] flex items-center px-4">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />

        {/* Left: Branding */}
        <div className="absolute left-4 top-0 bottom-0 z-10 flex items-center gap-3 select-none">
          <button
            onClick={onTitleClick}
            className="text-[22px] font-bold text-white tracking-[0.25em] font-mono leading-none bg-transparent border-none cursor-pointer"
          >
            {title}
          </button>
          {subtitle && (
            <span className="text-xs font-mono text-neutral-500">{subtitle}</span>
          )}
        </div>

        {/* Center */}
        {center && (
          <div className="flex-1 flex justify-center">
            {center}
          </div>
        )}

        {/* Right: Actions + Search */}
        <div className="absolute right-4 top-0 bottom-0 z-10 flex items-center gap-3">
          {actions}

          {/* Search / Scope filter */}
          {search && (
            <div className="relative w-[220px] bg-white/[0.03] border border-neutral-700/50 rounded px-2.5 hover:border-neutral-600/60 focus-within:border-neutral-500/50 focus-within:bg-white/[0.05] transition-all duration-200">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                placeholder={search.placeholder ?? 'Search...'}
                className={`
                  w-full h-7 pl-5 pr-6 bg-transparent text-[10px] font-mono tracking-wider
                  placeholder:text-neutral-600 text-neutral-400
                  focus:outline-none transition-all duration-200
                  ${isFiltered ? 'text-emerald-400' : ''}
                `}
              />
              {isFiltered && (
                <button
                  onClick={() => search.onChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NavigationBar;

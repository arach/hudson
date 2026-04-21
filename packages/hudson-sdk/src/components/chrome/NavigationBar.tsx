import React from 'react';
import { Search, X } from 'lucide-react';
import { usePlatform } from '../../platform/PlatformContext';
import { usePlatformLayout } from '../../platform/usePlatformLayout';

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
  const { dragRegionProps, onInteractiveMouseDown } = usePlatform();
  const { navTotalHeight } = usePlatformLayout();
  const isFiltered = search && search.value && search.value.length > 0;

  return (
    <div
      data-frame-panel="navigation"
      className="fixed top-0 left-0 right-0 z-50 pointer-events-auto"
      {...dragRegionProps}
    >
      <div
        className="bg-background/95 backdrop-blur-xl border-b border-border/80 shadow-[var(--hud-shadow-nav)] flex items-end px-4"
        style={{ height: navTotalHeight }}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/8 to-transparent" />

        {/* Left: Branding */}
        <div className="absolute left-4 bottom-0 h-12 z-10 flex items-center gap-3 select-none" onMouseDown={onInteractiveMouseDown}>
          <button
            onClick={onTitleClick}
            className="text-[22px] font-bold text-foreground tracking-[0.25em] font-mono leading-none bg-transparent border-none cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded"
          >
            {title}
          </button>
          {subtitle && (
            <span className="text-xs font-mono text-muted-foreground">{subtitle}</span>
          )}
        </div>

        {/* Center */}
        {center && (
          <div className="flex-1 flex justify-center h-12 items-center" onMouseDown={onInteractiveMouseDown}>
            {center}
          </div>
        )}

        {/* Right: Actions + Search */}
        <div className="absolute right-4 bottom-0 h-12 z-10 flex items-center gap-3" onMouseDown={onInteractiveMouseDown}>
          {actions}

          {/* Search / Scope filter */}
          {search && (
            <div className="relative w-[220px] bg-card border border-input rounded px-2.5 shadow-[inset_0_1px_0_oklch(var(--foreground)/0.02)] hover:border-ring/60 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/30 focus-within:bg-card transition-all duration-200">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                placeholder={search.placeholder ?? 'Search...'}
                className={`
                  w-full h-7 pl-5 pr-6 bg-transparent text-[12px] font-mono tracking-wider
                  placeholder:text-muted-foreground text-foreground
                  focus:outline-none transition-all duration-200
                  ${isFiltered ? 'text-accent' : ''}
                `}
              />
              {isFiltered && (
                <button
                  onClick={() => search.onChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded-sm"
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

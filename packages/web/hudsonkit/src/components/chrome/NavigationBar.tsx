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

/**
 * Drafting-style mark — a 14px registration glyph (square + crosshair + tick)
 * intended to read as a title-block stamp from an engineering drawing.
 * Strokes use `currentColor` so it themes through `text-foreground` or accent.
 */
const HudsonMark: React.FC<{ title: string }> = ({ title }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeWidth="0.75"
    strokeLinecap="square"
    aria-hidden="true"
    focusable="false"
    role="img"
    style={{ flex: 'none' }}
  >
    <title>{title}</title>
    {/* Outer registration box */}
    <rect x="1" y="1" width="12" height="12" />
    {/* Crosshair */}
    <line x1="7" y1="3.25" x2="7" y2="10.75" />
    <line x1="3.25" y1="7" x2="10.75" y2="7" />
    {/* Center pin — small filled accent dot */}
    <circle cx="7" cy="7" r="0.9" fill="var(--hud-accent, currentColor)" stroke="none" />
    {/* Title-block tick on bottom edge */}
    <line x1="1" y1="11.25" x2="13" y2="11.25" strokeWidth="0.5" opacity="0.55" />
  </svg>
);

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
        className="bg-background/95 border-b shadow-[var(--hud-shadow-nav)] flex items-end px-4"
        style={{ height: navTotalHeight, borderColor: 'var(--hud-chrome-border, oklch(var(--border) / 0.8))' }}
      >
        {/* Left: Branding */}
        <div className="absolute left-4 bottom-0 h-12 z-10 flex items-center gap-3 select-none" onMouseDown={onInteractiveMouseDown}>
          <button
            onClick={onTitleClick}
            aria-label={title}
            className="group flex items-center gap-[7px] text-foreground/85 hover:text-foreground transition-colors bg-transparent border-none cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded-sm px-0.5 -mx-0.5 leading-none"
          >
            <HudsonMark title={title} />
            <span className="font-mono text-[11px] tracking-[0.06em] lowercase leading-none">
              {title}
            </span>
          </button>
          {subtitle && (
            <span className="text-xs font-mono font-light text-muted-foreground">{subtitle}</span>
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
            <div className="hidden sm:block relative w-[220px] max-w-[34vw] bg-card border border-input rounded px-2.5 shadow-[inset_0_1px_0_oklch(var(--foreground)/0.02)] hover:border-ring/60 focus-within:border-ring focus-within:bg-card transition-colors duration-200">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                placeholder={search.placeholder ?? 'Search'}
                className={`
                  w-full h-7 pl-5 pr-6 bg-transparent text-[11px] font-mono font-normal tracking-[0.02em]
                  placeholder:text-muted-foreground/80 placeholder:font-light text-foreground
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

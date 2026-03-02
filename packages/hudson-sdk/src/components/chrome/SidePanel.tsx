import React from 'react';
import { PanelLeftClose, PanelRightClose, PanelLeftOpen, PanelRightOpen } from 'lucide-react';
import { PANEL_STYLES } from '../../lib/theme';
import { usePlatformLayout } from '../../platform/usePlatformLayout';

interface SidePanelProps {
  side: 'left' | 'right';
  title?: string;
  /** Icon rendered before the title */
  icon?: React.ReactNode;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  /** Additional header actions (right of title) */
  headerActions?: React.ReactNode;
  /** Footer content pinned to bottom (outside scroll area) */
  footer?: React.ReactNode;
  /** Additional inline styles (for dynamic positioning) */
  style?: React.CSSProperties;
  /** Width of the panel */
  width?: number;
  /** Resize start handler */
  onResizeStart?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}

const SidePanel: React.FC<SidePanelProps> = ({
  side, title, icon, isCollapsed = false, onToggleCollapse, headerActions, footer, style, width, onResizeStart, children
}) => {
  // Show expand button when collapsed
  if (isCollapsed) {
    const ExpandIcon = side === 'left' ? PanelLeftOpen : PanelRightOpen;
    return (
      <button
        onClick={onToggleCollapse}
        className={`fixed top-1/2 -translate-y-1/2 z-40 ${
          side === 'left' ? 'left-3' : 'right-3'
        } p-2.5 rounded bg-neutral-950/95 border border-neutral-700/80 hover:border-emerald-500/60 backdrop-blur-xl shadow-[0_0_20px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] hover:shadow-[0_0_30px_rgba(16,185,129,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] transition-all duration-200 group pointer-events-auto`}
        title={`Expand ${title || 'panel'}`}
      >
        <ExpandIcon size={14} className="text-neutral-400 group-hover:text-emerald-400 transition-colors" strokeWidth={1.5} />
      </button>
    );
  }

  const CollapseIcon = side === 'left' ? PanelLeftClose : PanelRightClose;
  const { panelTopOffset } = usePlatformLayout();

  // Build className manually to avoid any conflicts
  // Remove outer-edge + inner-edge borders; resize handle provides the inner-edge separator
  const baseClasses = 'bg-neutral-950/95 backdrop-blur-xl border border-neutral-700/80 shadow-[0_0_30px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.08)] fixed bottom-[28px] z-40 rounded-none border-t-0 overflow-hidden';
  const sideSpecificClasses = side === 'left' ? 'border-l-0 border-r-0' : 'border-r-0 border-l-0';
  const panelClass = `${baseClasses} ${sideSpecificClasses}`;

  const finalStyle: React.CSSProperties = {
    ...style,
    // Explicitly set positioning and width via inline styles
    position: 'fixed',
    top: panelTopOffset,
    left: side === 'left' ? 0 : undefined,
    right: side === 'right' ? 0 : undefined,
    width: `${width || 280}px`
  };

  return (
    <div
      data-frame-panel={side === 'left' ? 'manifest' : 'inspector'}
      className={`${panelClass} pointer-events-none select-none font-mono text-[10px] flex flex-col`}
      style={finalStyle}
    >
      {/* Resize handle — sits flush at inner edge, line on the outermost side */}
      {onResizeStart && (
        <div
          className={`absolute top-0 ${side === 'left' ? 'right-0' : 'left-0'} bottom-0 w-[7px] cursor-ew-resize z-50 pointer-events-auto group flex items-center justify-center`}
          onMouseDown={onResizeStart}
        >
          {/* Border line flush at panel edge */}
          <div className={`absolute top-0 bottom-0 ${side === 'left' ? 'right-0' : 'left-0'} w-px bg-neutral-700/80 group-hover:bg-emerald-500/50 transition-colors`} />
          {/* Grip dots */}
          <div className="flex flex-col gap-[3px] opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-[3px] h-[3px] rounded-full bg-neutral-500 group-hover:bg-emerald-400/70" />
            <div className="w-[3px] h-[3px] rounded-full bg-neutral-500 group-hover:bg-emerald-400/70" />
            <div className="w-[3px] h-[3px] rounded-full bg-neutral-500 group-hover:bg-emerald-400/70" />
          </div>
        </div>
      )}
      {/* Static border line when no resize handle */}
      {!onResizeStart && (
        <div className={`absolute top-0 ${side === 'left' ? 'right-0' : 'left-0'} bottom-0 w-px bg-neutral-700/80`} />
      )}
      {/* Top highlight */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent z-10" />

      <div className="pointer-events-auto flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        {title && (
          <div className="shrink-0 p-4 border-b border-neutral-700/50">
            <div className="flex items-center justify-between text-neutral-200 text-[11px]">
              <div className="flex items-center gap-1.5">
                {icon && <span className="text-neutral-400">{icon}</span>}
                <span className="tracking-widest font-bold uppercase">{title}</span>
              </div>
              <div className="flex items-center gap-2">
                {headerActions}
                {onToggleCollapse && (
                  <button
                    onClick={onToggleCollapse}
                    className="p-1 hover:bg-white/10 rounded transition-colors text-neutral-400 hover:text-white"
                    title="Collapse panel"
                  >
                    <CollapseIcon size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto frame-scrollbar">
          {children}
        </div>

        {/* Footer — pinned to bottom */}
        {footer && (
          <div className="shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default SidePanel;

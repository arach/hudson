export function SidePanelExhibit() {
  return (
    <div className="space-y-6 text-[13px] leading-relaxed text-studio-ink-faint">
      <p>
        You&apos;re looking at one right now — the left panel hosting the catalog
        nav. <code className="rounded bg-studio-chip-bg px-1 py-0.5 font-mono text-[11px]">SidePanel</code>{" "}
        is a position-fixed chrome panel with a collapse toggle, optional
        resize handle, optional footer slot, and a header with title + icon.
      </p>

      <div className="rounded-md border border-studio-edge p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-studio-ink-faint">
          · live in this view
        </div>
        <ul className="mt-3 space-y-1.5 text-[12.5px] text-studio-ink">
          <li>
            Left column → <code className="font-mono text-[11px]">{'SidePanel side="left"'}</code>
            , title <em>Catalog</em>, hosting <code className="font-mono text-[11px]">RegistryNav</code>.
          </li>
          <li>
            The collapse chevron, the panel border, and the chrome shadow all
            come from <code className="font-mono text-[11px]">--hud-shadow-panel</code>{" "}
            + <code className="font-mono text-[11px]">--hud-chrome-border</code>.
          </li>
          <li>
            Try collapsing it via the chevron at the top of the panel.
          </li>
        </ul>
      </div>

      <div className="rounded-md border border-studio-edge p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-studio-ink-faint">
          · props
        </div>
        <pre className="mt-3 overflow-x-auto rounded bg-studio-canvas-alt p-3 font-mono text-[11px] text-studio-ink">
{`interface SidePanelProps {
  side: 'left' | 'right';
  title?: string;
  icon?: React.ReactNode;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
  onResizeStart?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}`}
        </pre>
      </div>
    </div>
  );
}

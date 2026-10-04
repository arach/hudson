'use client';

import { useState, type CSSProperties } from 'react';
import { AppWindow, Bot, Info, Mic, SlidersHorizontal } from 'hudsonkit/icons';
import { HudSideNav, HudWindowFrame, type HudNavNode } from 'hudsonkit/nav';

const pages: HudNavNode[] = [
  { id: 'general', label: 'General', icon: SlidersHorizontal },
  { id: 'voice', label: 'Voice', icon: Mic },
  { id: 'apps', label: 'Apps', icon: AppWindow },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'about', label: 'About', icon: Info, count: 2 },
];

// A template is just tokens. `paper` is fab's Settings look; `hudson` is the default.
const templates: Record<string, CSSProperties> = {
  hudson: {},
  paper: {
    '--hud-window-frame-chrome': '#e8e1cf',
    '--hud-window-frame-sheet': '#f2eddf',
    '--hud-window-frame-edge': 'color-mix(in oklab, #1d1b18 12%, transparent)',
    '--hud-window-frame-duration': '300ms',
    '--hud-window-frame-ease': 'cubic-bezier(0.16, 1, 0.3, 1)',
    color: '#1d1b18',
  } as CSSProperties,
};

function Brand() {
  return (
    <span className="flex items-center gap-2 text-[13px] font-semibold">
      <span className="size-3.5 rounded-[3px] bg-cyan-500/80" aria-hidden="true" />
      Hudson
    </span>
  );
}

export default function WindowFrameDemoPage() {
  const [page, setPage] = useState('general');
  const [collapsed, setCollapsed] = useState(true);
  const [width, setWidth] = useState(196);
  const [template, setTemplate] = useState<keyof typeof templates>('hudson');

  return (
    <div className="flex h-dvh min-h-[520px] flex-col items-center justify-center gap-4 bg-muted/30 p-8 text-foreground">
      <div className="flex gap-2 text-[11px]">
        {Object.keys(templates).map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={template === name}
            onClick={() => setTemplate(name)}
            className="rounded-md border border-border/70 px-2.5 py-1 capitalize aria-pressed:border-cyan-500 aria-pressed:text-foreground text-muted-foreground"
          >
            {name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="rounded-md border border-border/70 px-2.5 py-1 text-muted-foreground"
        >
          {collapsed ? 'Unfold' : 'Fold'}
        </button>
      </div>
      <div
        className="h-[480px] w-[760px] overflow-hidden rounded-[12px] border border-border/70 shadow-2xl"
        style={templates[template]}
      >
        <HudWindowFrame
          open={!collapsed}
          onOpenChange={(open) => setCollapsed(!open)}
          expandedWidth={width}
          onExpandedWidthChange={setWidth}
          defaultExpandedWidth={196}
          minExpandedWidth={132}
          maxExpandedWidth={300}
          collapsedWidth={52}
          keyboardShortcut={false}
          resizable
          brand={<Brand />}
          trafficLights={{ preview: true }}
          contentAriaLabel={page}
          navigation={
            <HudSideNav
              items={pages}
              selectedId={page}
              onSelect={(node) => setPage(node.id)}
              selectionWash
              ariaLabel="Settings"
              header={
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Settings
                </span>
              }
              footer={<Brand />}
              collapsedHeader={false}
              collapsedFooter={false}
            />
          }
        >
          <div className="p-6">
            <h1 className="text-lg font-semibold capitalize">{page}</h1>
            <p className="mt-2 max-w-[56ch] text-[13px] leading-6 text-muted-foreground">
              Drag the sidebar edge past its minimum to fold it. Folded, the traffic lights and the
              brand move to a title bar, and this page becomes a sheet with one curved corner.
            </p>
          </div>
        </HudWindowFrame>
      </div>
    </div>
  );
}

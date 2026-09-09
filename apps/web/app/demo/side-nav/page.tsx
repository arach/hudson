'use client';

import { useState } from 'react';
import {
  Activity,
  Bot,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Home,
  Settings,
} from 'hudsonkit/icons';
import {
  HudSideNav,
  HudSideNavLayout,
  HudSideNavProvider,
  HudSideNavTrigger,
  HudSideRail,
  useHudSideNav,
  type HudNavNode,
} from 'hudsonkit/nav';

const destinations: HudNavNode[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'workspaces', label: 'Workspaces', icon: Boxes, count: 4 },
  { id: 'agents', label: 'Agents', icon: Bot, count: 3, live: true },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const projects = ['HudsonKit', 'Canvas runtime', 'Native shell', 'Theme system'];

function PrimaryBrandToggle({ compact = false }: { compact?: boolean }) {
  const { state } = useHudSideNav();
  const collapsed = state === 'collapsed';
  const label = `${collapsed ? 'Expand' : 'Collapse'} primary navigation`;

  return (
    <HudSideNavTrigger
      label={label}
      className={`w-full ${compact ? 'px-0' : 'justify-start px-1'}`}
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded bg-cyan-500/15 text-cyan-600 dark:text-cyan-300">
        <Boxes size={15} aria-hidden="true" />
      </span>
      {!compact ? (
        <span className="min-w-0 flex-1 truncate text-left font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">
          Hudson
        </span>
      ) : null}
    </HudSideNavTrigger>
  );
}

export default function SideNavDemoPage() {
  const [selectedId, setSelectedId] = useState('home');
  const [contextCollapsed, setContextCollapsed] = useState(false);

  return (
    <div className="h-dvh min-h-[520px] bg-background text-foreground">
      <HudSideNavProvider
        collapsible="icon"
        defaultOpen={false}
        defaultExpandedWidth={260}
        collapsedWidth={48}
        keyboardShortcut="b"
      >
        <HudSideNavLayout
          resizable
          navigation={
            <HudSideNav
              items={destinations}
              selectedId={selectedId}
              onSelect={(node) => setSelectedId(node.id)}
              selectionWash
              rovingFocus
              ariaLabel="Demo destinations"
              header={<PrimaryBrandToggle />}
              collapsedHeader={<PrimaryBrandToggle compact />}
              footer={
                <div className="flex items-center gap-2 overflow-hidden text-[10px] text-muted-foreground">
                  <span className="size-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                  <span className="truncate">All systems ready</span>
                </div>
              }
              collapsedFooter={
                <div className="flex w-full justify-center" aria-label="All systems ready">
                  <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
                </div>
              }
            />
          }
          contextRail={
            <HudSideRail
              label="Projects"
              collapsed={contextCollapsed}
              onCollapsedChange={setContextCollapsed}
              resizable
              collapsedContent={
                <div className="flex flex-col items-center gap-2 py-2">
                  {projects.map((project) => (
                    <button
                      key={project}
                      type="button"
                      aria-label={project}
                      className="flex size-8 items-center justify-center rounded-md font-mono text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
                    >
                      {project.slice(0, 2).toUpperCase()}
                    </button>
                  ))}
                </div>
              }
              footer={
                <div className="flex h-9 items-center gap-2 px-3 text-[10px] text-muted-foreground">
                  <CheckCircle2 size={13} className="text-emerald-500" aria-hidden="true" />
                  Synced just now
                </div>
              }
            >
              <div className="space-y-1 p-2">
                {projects.map((project, index) => (
                  <button
                    key={project}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[11px] text-foreground/80 transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center rounded bg-muted font-mono text-[9px] text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{project}</span>
                    <ChevronRight size={12} className="text-muted-foreground" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </HudSideRail>
          }
          contextRailAriaLabel="Project context"
          topRow={
            <div className="flex h-full min-w-0 items-center gap-3 px-3">
              <span className="truncate text-[12px] font-semibold">{selectedId}</span>
              <div className="ml-auto flex items-center gap-1" aria-label="Workspace views">
                {['Overview', 'Timeline', 'Files'].map((view, index) => (
                  <button
                    key={view}
                    type="button"
                    aria-pressed={index === 0}
                    className="h-7 border-b px-2 text-[10px] text-muted-foreground transition-colors hover:text-foreground aria-pressed:border-cyan-500 aria-pressed:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
                  >
                    {view}
                  </button>
                ))}
              </div>
            </div>
          }
          bottomBar={
            <div className="flex h-full items-center gap-2 px-3 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              Ready
              <span className="ml-auto">HudsonKit sidebar anatomy</span>
            </div>
          }
          contentAriaLabel="Sidebar anatomy demo"
        >
          <div className="h-full overflow-auto p-5">
            <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.6fr)]">
              <section className="min-h-[360px] border border-border/70 bg-card/35 p-5">
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                  Active surface
                </p>
                <h1 className="mt-2 text-xl font-semibold capitalize">{selectedId}</h1>
                <p className="mt-2 max-w-[64ch] text-sm leading-6 text-muted-foreground">
                  Primary destinations stay pure navigation. Project context remains a separate rail,
                  and the top row begins beside the full-height navigation column.
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {['Stable icon geometry', 'Keep-alive context', '500ms hover intent', 'Mirrored layout'].map(
                    (label) => (
                      <div key={label} className="border-t border-border/70 py-3 text-[12px] text-foreground/80">
                        {label}
                      </div>
                    ),
                  )}
                </div>
              </section>
              <aside className="border border-border/70 bg-card/35 p-5" aria-label="Interaction guide">
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                  Try it
                </p>
                <ul className="mt-3 space-y-3 text-[12px] leading-5 text-muted-foreground">
                  <li>Press Cmd/Ctrl+B or use the Hudson brand control to expand destination labels.</li>
                  <li>Collapse Projects; its expanded list stays mounted behind the 48px rail.</li>
                  <li>Settle over a compact destination to reveal its Hudson tooltip.</li>
                  <li>Use Arrow keys after focusing a destination to exercise roving focus.</li>
                </ul>
              </aside>
            </div>
          </div>
        </HudSideNavLayout>
      </HudSideNavProvider>
    </div>
  );
}

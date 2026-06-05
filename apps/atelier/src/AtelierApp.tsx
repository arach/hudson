import { useState } from "react";
import { AppShell, WorkspaceShell } from "hudsonkit/app-shell";
import { ThemeProvider } from "hudsonkit/theme";
import { atelierApp } from "./appShellApp";
// Hudson's real apps — imported exactly as the Hudson host imports them
// (app/apps/*). Not reimplemented; the same HudsonApp objects.
import { shaperApp } from "@apps/shaper";
import { logoApp } from "@apps/logo";

type View = "atelier" | "shaper" | "workspace";

const VIEWS: { key: View; label: string }[] = [
  { key: "atelier", label: "Atelier" },
  { key: "shaper", label: "Shaper" },
  { key: "workspace", label: "Workspace" },
];

// Real apps on the multi-app canvas, with sensible opening bounds.
const canvasApps = [
  {
    app: shaperApp,
    canvasMode: "windowed" as const,
    defaultWindowBounds: { x: -560, y: -280, w: 500, h: 560 },
  },
  {
    app: logoApp,
    canvasMode: "windowed" as const,
    defaultWindowBounds: { x: 50, y: -280, w: 540, h: 560 },
  },
];

// Atelier's own host strip — a thin meta-control above whichever kit shell is
// mounted. It is the *only* hand-written chrome in this app; everything below
// it is rendered by hudsonkit.
function Switcher({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <header className="flex h-9 shrink-0 items-center gap-3 border-b border-border/70 bg-card/40 px-3 backdrop-blur">
      <span className="font-mono text-[12px] font-semibold tracking-tight text-foreground">
        atelier
      </span>
      <div className="flex items-center gap-0.5 rounded-md border border-border/70 bg-background/60 p-0.5">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => onChange(v.key)}
            className={`rounded px-2.5 py-1 font-mono text-[11px] transition-colors ${
              view === v.key
                ? "bg-cyan-500/15 text-cyan-300"
                : "text-foreground/55 hover:text-foreground/90"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
      <span className="ml-auto font-mono text-[10px] text-foreground/40">
        hudsonkit · standalone vite
      </span>
    </header>
  );
}

function WorkspaceHeader() {
  return (
    <div className="flex h-10 items-center gap-3 border-b border-border/60 bg-card/30 px-4">
      <span className="font-mono text-[12px] text-foreground/70">WorkspaceShell</span>
      <span className="text-[11px] text-foreground/40">real apps from app/apps · drag · layout persists</span>
      <span className="ml-auto font-mono text-[10px] text-teal-400/70">Shaper + Logo</span>
    </div>
  );
}

export default function AtelierApp() {
  const [view, setView] = useState<View>("atelier");
  return (
    <ThemeProvider defaultTheme="dark">
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
        <Switcher view={view} onChange={setView} />
        <div className="relative min-h-0 flex-1">
          {view === "workspace" ? (
            <WorkspaceShell
              apps={canvasApps}
              storageKey="atelier-apps"
              showGrid
              header={<WorkspaceHeader />}
            />
          ) : (
            // key forces a clean remount when switching which app the single-app
            // shell hosts (AppShell namespaces persistent state by app.id).
            <AppShell key={view} app={view === "shaper" ? shaperApp : atelierApp} assistant={false} />
          )}
        </div>
      </div>
    </ThemeProvider>
  );
}

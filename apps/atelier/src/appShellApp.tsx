import { createContext, useContext, useState } from "react";
import type { FC, ReactNode } from "react";
import { Boxes, Compass, Info, LayoutDashboard, Palette } from "lucide-react";
import type { HudsonApp } from "hudsonkit";

// ---------------------------------------------------------------------------
// The Atelier single-app — a real HudsonApp (Provider owns state; slots read
// it via context; hooks feed the shell chrome). Mounted in AppShell to show
// the full single-app chrome: nav bar, left panel, content, inspector, status
// bar, command palette.
// ---------------------------------------------------------------------------

type Section = "overview" | "shells" | "tokens" | "about";

const SECTIONS: { key: Section; label: string; icon: ReactNode }[] = [
  { key: "overview", label: "Overview", icon: <LayoutDashboard size={13} /> },
  { key: "shells", label: "Shells", icon: <Boxes size={13} /> },
  { key: "tokens", label: "Tokens", icon: <Palette size={13} /> },
  { key: "about", label: "About", icon: <Info size={13} /> },
];

interface AtelierState {
  section: Section;
  setSection: (s: Section) => void;
}

const AtelierCtx = createContext<AtelierState | null>(null);

function useAtelier(): AtelierState {
  const value = useContext(AtelierCtx);
  if (!value) throw new Error("useAtelier must be used inside the Atelier Provider");
  return value;
}

const AtelierProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [section, setSection] = useState<Section>("overview");
  return <AtelierCtx.Provider value={{ section, setSection }}>{children}</AtelierCtx.Provider>;
};

// --- Left panel: section nav (drives Content via Provider state) -------------
const AtelierLeftPanel: FC = () => {
  const { section, setSection } = useAtelier();
  return (
    <nav className="flex flex-col gap-0.5 p-2">
      {SECTIONS.map((s) => (
        <button
          key={s.key}
          type="button"
          onClick={() => setSection(s.key)}
          className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] font-mono transition-colors ${
            section === s.key
              ? "bg-cyan-500/10 text-cyan-300"
              : "text-foreground/55 hover:bg-foreground/5 hover:text-foreground/90"
          }`}
        >
          {s.icon}
          {s.label}
        </button>
      ))}
    </nav>
  );
};

// --- Content sections --------------------------------------------------------
const Kbd: FC<{ children: ReactNode }> = ({ children }) => (
  <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-foreground/70">
    {children}
  </kbd>
);

const Overview: FC = () => (
  <div className="mx-auto max-w-2xl space-y-5 p-8 text-[13px] leading-relaxed text-foreground/80">
    <div>
      <div className="mb-1 font-mono text-[11px] uppercase tracking-widest text-cyan-400/80">
        Standalone consumer
      </div>
      <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Atelier</h1>
    </div>
    <p>
      This is a plain <span className="text-cyan-300">Vite</span> app — its own server, its own
      build, its own <code className="text-teal-300">node_modules</code>. It is{" "}
      <span className="text-foreground">not</span> a route inside Hudson&apos;s Next app. Everything
      you see is rendered by <code className="text-teal-300">hudsonkit</code>, linked as a package.
    </p>
    <p>
      What you are looking at right now is the <span className="text-cyan-300">AppShell</span> — the
      kit&apos;s single-app shell. The chrome around this content (the nav bar up top, the section
      nav on the left, this content area, the inspector on the right, the status bar along the
      bottom, and the <Kbd>⌘K</Kbd> command palette) all come from{" "}
      <code className="text-teal-300">hudsonkit/app-shell</code> — none of it is hand-written here.
    </p>
    <p className="text-foreground/60">
      Flip the switch in the top bar to <span className="text-cyan-300">Workspace</span> to see the
      other shell the kit ships: a multi-app canvas with draggable windows.
    </p>
    <div className="grid grid-cols-3 gap-3 pt-2">
      {[
        { k: "shells", v: "2", note: "AppShell + Workspace" },
        { k: "app imports", v: "0", note: "kit only" },
        { k: "runtime", v: "Vite", note: "port 3034" },
      ].map((s) => (
        <div key={s.k} className="rounded-lg border border-border bg-card/50 p-3">
          <div className="text-[26px] font-semibold tabular-nums text-foreground">{s.v}</div>
          <div className="font-mono text-[10px] uppercase tracking-wide text-foreground/45">
            {s.k}
          </div>
          <div className="mt-1 text-[11px] text-foreground/55">{s.note}</div>
        </div>
      ))}
    </div>
  </div>
);

const Shells: FC = () => (
  <div className="mx-auto max-w-2xl space-y-4 p-8 text-[13px] leading-relaxed text-foreground/80">
    <h2 className="text-[18px] font-semibold tracking-tight text-foreground">Two shells</h2>
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-card/50 p-4">
        <div className="mb-1 flex items-center gap-2">
          <Boxes size={14} className="text-cyan-300" />
          <span className="font-mono text-[13px] text-foreground">AppShell</span>
          <span className="ml-auto font-mono text-[10px] text-foreground/40">single app</span>
        </div>
        <p className="text-[12px] text-foreground/60">
          Full chrome around one app: nav bar, side panels, status bar, command palette. This is the
          shell you are in now.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card/50 p-4">
        <div className="mb-1 flex items-center gap-2">
          <LayoutDashboard size={14} className="text-teal-300" />
          <span className="font-mono text-[13px] text-foreground">WorkspaceShell</span>
          <span className="ml-auto font-mono text-[10px] text-foreground/40">multi app</span>
        </div>
        <p className="text-[12px] text-foreground/60">
          A pan/zoom canvas hosting several apps as draggable windows. The kit&apos;s portable embed
          shell — chrome-light by design.
        </p>
      </div>
    </div>
    <p className="text-[12px] text-foreground/50">
      Both come from the same import: <code className="text-teal-300">hudsonkit/app-shell</code>.
    </p>
  </div>
);

const SWATCHES: { name: string; cls: string }[] = [
  { name: "cyan", cls: "bg-cyan-500" },
  { name: "sky", cls: "bg-sky-500" },
  { name: "blue", cls: "bg-blue-500" },
  { name: "teal", cls: "bg-teal-500" },
  { name: "emerald", cls: "bg-emerald-500" },
  { name: "green", cls: "bg-green-500" },
];

const Tokens: FC = () => (
  <div className="mx-auto max-w-2xl space-y-4 p-8">
    <h2 className="text-[18px] font-semibold tracking-tight text-foreground">Accent tokens</h2>
    <p className="text-[12px] text-foreground/60">
      Surfaces and text below use the kit&apos;s semantic tokens (
      <code className="text-teal-300">bg-card</code>,{" "}
      <code className="text-teal-300">border-border</code>,{" "}
      <code className="text-teal-300">text-foreground</code>) — resolved from{" "}
      <code className="text-teal-300">hudsonkit/styles/tokens.css</code>.
    </p>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {SWATCHES.map((s) => (
        <div
          key={s.name}
          className="flex items-center gap-2.5 rounded-lg border border-border bg-card/50 p-3"
        >
          <div className={`h-8 w-8 rounded ${s.cls} shadow-inner`} />
          <span className="font-mono text-[11px] text-foreground/70">{s.name}</span>
        </div>
      ))}
    </div>
  </div>
);

const About: FC = () => (
  <div className="mx-auto max-w-2xl space-y-4 p-8 text-[13px] leading-relaxed text-foreground/80">
    <h2 className="text-[18px] font-semibold tracking-tight text-foreground">About</h2>
    <p>
      Atelier exists to answer one question out loud: can HudsonKit stand on its own, outside the
      Hudson app? This app imports nothing from <code className="text-teal-300">app/shell</code> —
      only the kit&apos;s public <code className="text-teal-300">hudsonkit/app-shell</code> entry.
    </p>
    <p className="text-foreground/60">
      The full Hudson host (the workspace with its own console, relay, and API) is the next thing to
      make portable. When it is, it mounts here too — same pattern, more chrome.
    </p>
  </div>
);

const AtelierContent: FC = () => {
  const { section } = useAtelier();
  switch (section) {
    case "overview":
      return <Overview />;
    case "shells":
      return <Shells />;
    case "tokens":
      return <Tokens />;
    case "about":
      return <About />;
  }
};

// --- Inspector (right panel) -------------------------------------------------
const InspectorRow: FC<{ k: string; v: string }> = ({ k, v }) => (
  <div className="flex items-baseline justify-between gap-3">
    <span className="text-foreground/40">{k}</span>
    <span className="text-foreground/75">{v}</span>
  </div>
);

const AtelierInspector: FC = () => {
  const { section } = useAtelier();
  return (
    <div className="space-y-2.5 p-3 font-mono text-[11px]">
      <InspectorRow k="package" v="hudsonkit@0.3.0" />
      <InspectorRow k="entry" v="hudsonkit/app-shell" />
      <InspectorRow k="shell" v="AppShell" />
      <InspectorRow k="section" v={section} />
      <InspectorRow k="runtime" v="vite · :3034" />
      <InspectorRow k="host" v="standalone" />
    </div>
  );
};

// --- The app ----------------------------------------------------------------
export const atelierApp: HudsonApp = {
  id: "atelier",
  name: "Atelier",
  description: "HudsonKit, consumed standalone.",
  mode: "panel",
  leftPanel: { title: "Atelier", icon: <Compass size={12} /> },
  rightPanel: { title: "Kit", icon: <Info size={12} /> },
  Provider: AtelierProvider,
  slots: {
    Content: AtelierContent,
    LeftPanel: AtelierLeftPanel,
    Inspector: AtelierInspector,
  },
  hooks: {
    useCommands: () => [],
    useStatus: () => ({ label: "READY", color: "emerald" }),
  },
};

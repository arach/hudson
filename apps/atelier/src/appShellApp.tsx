import { createContext, useContext, useState } from "react";
import type { FC, ReactNode } from "react";
import { Bot, Boxes, Compass, Info, LayoutDashboard, Palette, Radio, Server } from "lucide-react";
import type { HudsonApp } from "hudsonkit";
import { atelierHostServices } from "./hostServices";

// ---------------------------------------------------------------------------
// The Atelier single-app: a real HudsonApp (Provider owns state; slots read
// it via context; hooks feed the shell chrome). Mounted in AppShell to show
// the full single-app chrome: nav bar, left panel, content, inspector, status
// bar, command palette.
// ---------------------------------------------------------------------------

type Section = "overview" | "services" | "shells" | "tokens" | "about";

const SECTIONS: { key: Section; label: string; icon: ReactNode }[] = [
  { key: "overview", label: "Overview", icon: <LayoutDashboard size={13} /> },
  { key: "services", label: "Host Services", icon: <Server size={13} /> },
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
const Overview: FC = () => (
  <div className="mx-auto max-w-2xl space-y-5 p-8 text-[13px] leading-relaxed text-foreground/80">
    <div>
      <div className="mb-1 font-mono text-[11px] uppercase tracking-widest text-cyan-400/80">
        App-builder host
      </div>
      <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Atelier</h1>
    </div>
    <p>
      This is the standalone <span className="text-cyan-300">Atelier</span> host. It serves an
      Atelier-owned workspace registry and a local service API from Vite; it is not the old Hudson
      workspace list mounted under a different port.
    </p>
    <p>
      The first window is this Atelier control surface. Shaper, Document Lab, Code Editor, API
      Inspector, and Workflow Lab come from <code className="text-teal-300">hudson-showroom</code>,
      the extraction staging package. Product apps no longer come from the Hudson workspace registry.
    </p>
    <p className="text-foreground/60">
      The shell implementation is still a transitional import from Hudson. The boundary being tested
      here is the one that matters first: app bundles and host services belong to Atelier, not the
      Hudson workspace registry.
    </p>
    <div className="grid grid-cols-3 gap-3 pt-2">
      {[
        { k: "workspace", v: "1", note: "Atelier-owned" },
        { k: "apps", v: "6", note: "extracted + local" },
        { k: "services", v: "4", note: "owned / adapter / planned" },
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

const statusStyles = {
  owned: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  adapter: "border-cyan-500/25 bg-cyan-500/10 text-cyan-300",
  "not-configured": "border-amber-500/25 bg-amber-500/10 text-amber-300",
} as const;

const HostServices: FC = () => (
  <div className="mx-auto max-w-3xl space-y-4 p-8 text-[13px] leading-relaxed text-foreground/80">
    <div>
      <div className="mb-1 font-mono text-[11px] uppercase tracking-widest text-cyan-400/80">
        {atelierHostServices.name}
      </div>
      <h2 className="text-[18px] font-semibold tracking-tight text-foreground">Host services</h2>
    </div>
    <p className="text-foreground/62">
      This is the service contract App Builder should get from HudsonKit: relay, AI API, app APIs,
      storage, uploads, and service lifecycle through one host adapter.
    </p>
    <div className="grid gap-3 sm:grid-cols-2">
      {atelierHostServices.capabilities.map(capability => (
        <div key={capability.id} className="rounded-lg border border-border bg-card/50 p-4">
          <div className="mb-2 flex items-center gap-2">
            {capability.id === "relay" ? <Radio size={14} className="text-cyan-300" /> : <Bot size={14} className="text-cyan-300" />}
            <span className="font-mono text-[12px] text-foreground/85">{capability.label}</span>
            <span className={`ml-auto rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide ${statusStyles[capability.status]}`}>
              {capability.status.replace("-", " ")}
            </span>
          </div>
          <p className="text-[12px] text-foreground/58">{capability.description}</p>
        </div>
      ))}
    </div>
    <div className="rounded-lg border border-border bg-card/50 p-4 font-mono text-[11px] text-foreground/64">
      <div>relay: {atelierHostServices.relayUrl}</div>
      <div>services: {atelierHostServices.serviceApiUrl || "same-origin"}/api/services</div>
      <div>ai: {atelierHostServices.aiApiUrl}</div>
      <div>app api: {atelierHostServices.appApiBaseUrl}</div>
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
          A pan/zoom canvas hosting several apps as draggable windows. The full chrome host is still
          being migrated; the lightweight embed shell remains available for passive maps.
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
      <code className="text-teal-300">text-foreground</code>) resolved from{" "}
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
      Atelier exists to become the app-builder host: app bundles, workspace declarations, and the
      local services needed to run AI-enabled multi-app products.
    </p>
    <p className="text-foreground/60">
      Today&apos;s state: apps and service ownership are moving here first. The full
      WorkspaceShell implementation still imports from Hudson until it graduates into hudsonkit.
    </p>
  </div>
);

const AtelierContent: FC = () => {
  const { section } = useAtelier();
  switch (section) {
    case "overview":
      return <Overview />;
    case "services":
      return <HostServices />;
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
      <InspectorRow k="runtime" v="vite :3034" />
      <InspectorRow k="host" v="standalone" />
    </div>
  );
};

// --- The app ----------------------------------------------------------------
export const atelierApp: HudsonApp = {
  id: "atelier",
  name: "Atelier",
  description: "Atelier app-builder host.",
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

import { useMemo, useState, type ComponentType } from "react";
import {
  Columns2,
  Command,
  Crosshair,
  Eye,
  Focus,
  Grid3X3,
  Hand,
  Inbox,
  LayoutGrid,
  Maximize2,
  Minus,
  MousePointer2,
  PanelBottom,
  Plus,
  RotateCcw,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  X,
  type HudsonIconProps,
} from "hudsonkit/icons";
import "./canvas-craft.css";

/**
 * THESIS: Canvas already has the right anatomy; the visual lift comes from making
 * spatial focus, live state, and shell depth read before decorative chrome.
 * OWN-WORLD: A restrained graphite instrument with mineral-green selection,
 * blue runtime metadata, crisp rules, and calm black working space.
 * STORY: Compare the shipped visual register with one precision pass while the
 * product structure and interaction model remain fixed.
 * FIRST VIEWPORT: Full-height navigation and inspector frame two live terminal
 * windows on the canvas; Session 2 leads through selection, depth, and detail.
 * FORM: An approximate screenshot-derived reference beside one precision pass.
 */

type Treatment = "current" | "precision";
type SessionId = "session-1" | "session-2";
type Icon = ComponentType<HudsonIconProps>;

interface SessionFixture {
  id: SessionId;
  title: string;
  runtime: string;
  backend: string;
  tone: "blue" | "green";
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  shortId: string;
  cwd: string;
}

const SESSIONS: SessionFixture[] = [
  {
    id: "session-1",
    title: "Session 1",
    runtime: "tmux · local PTY",
    backend: "TMUX",
    tone: "blue",
    x: 132,
    y: 132,
    w: 454,
    h: 276,
    z: 3,
    shortId: "B17F6014",
    cwd: "~/d/hudson",
  },
  {
    id: "session-2",
    title: "Session 2",
    runtime: "zsh · local PTY",
    backend: "LOCAL PTY",
    tone: "green",
    x: 328,
    y: 344,
    w: 430,
    h: 268,
    z: 4,
    shortId: "B17F6014",
    cwd: "~/d/hudson",
  },
];

const TREATMENTS: Array<{
  id: Treatment;
  label: string;
  description: string;
}> = [
  {
    id: "current",
    label: "Reference",
    description: "Approx. baseline",
  },
  {
    id: "precision",
    label: "Precision",
    description: "Visual lift",
  },
];

export function CanvasCraftExhibit() {
  const [treatment, setTreatment] = useState<Treatment>("precision");
  const [selectedId, setSelectedId] = useState<SessionId>("session-2");
  const [notesVisible, setNotesVisible] = useState(true);

  const selected = useMemo(
    () => SESSIONS.find((session) => session.id === selectedId) ?? SESSIONS[1],
    [selectedId],
  );

  return (
    <main className="canvas-craft-study">
      <header className="canvas-craft-labbar">
        <div className="canvas-craft-labtitle">
          <span>Native composition</span>
          <strong>Canvas craft</strong>
        </div>

        <div className="canvas-craft-treatment" aria-label="Visual treatment">
          {TREATMENTS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={treatment === item.id}
              onClick={() => setTreatment(item.id)}
            >
              <span>{item.label}</span>
              <small>{item.description}</small>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="canvas-craft-notes-toggle"
          aria-pressed={notesVisible}
          onClick={() => setNotesVisible((visible) => !visible)}
        >
          <Eye size={14} />
          Craft notes
        </button>
      </header>

      <section className="canvas-craft-frame" data-treatment={treatment}>
        <RootNavigation />
        <WorkspaceRail selectedId={selectedId} onSelect={setSelectedId} />
        <CanvasStage
          treatment={treatment}
          selectedId={selectedId}
          onSelect={setSelectedId}
          notesVisible={notesVisible}
        />
        <Inspector session={selected} />
      </section>
    </main>
  );
}

function RootNavigation() {
  return (
    <aside className="cc-root-rail">
      <div className="cc-window-lights" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>

      <div className="cc-brand">
        <span className="cc-brand-mark">
          <Grid3X3 size={17} />
        </span>
        <span>
          <strong>HUDSONKIT</strong>
          <small>Canvas</small>
        </span>
      </div>

      <nav className="cc-root-nav" aria-label="Canvas navigation">
        <NavItem icon={LayoutGrid} label="Canvas" selected />
        <NavItem icon={Terminal} label="Terminal" />

        <NavSection label="Workspace" />
        <NavItem icon={Columns2} label="Navigator" />
        <NavItem icon={Search} label="Lens" />
        <NavItem icon={SlidersHorizontal} label="Appearance" />

        <NavSection label="Actions" />
        <NavItem icon={Focus} label="Fit Canvas" />
        <NavItem icon={Plus} label="New Terminal" />
        <NavItem icon={Columns2} label="Inspector" />
      </nav>

      <div className="cc-root-bottom">
        <div className="cc-idle-state">
          <i />
          idle
        </div>
      </div>
    </aside>
  );
}

function NavSection({ label }: { label: string }) {
  return <div className="cc-nav-section">{label}</div>;
}

function NavItem({
  icon: IconComponent,
  label,
  selected = false,
}: {
  icon: Icon;
  label: string;
  selected?: boolean;
}) {
  return (
    <button type="button" className="cc-nav-item" aria-current={selected ? "page" : undefined}>
      <IconComponent size={15} />
      <span>{label}</span>
    </button>
  );
}

function WorkspaceRail({
  selectedId,
  onSelect,
}: {
  selectedId: SessionId;
  onSelect: (id: SessionId) => void;
}) {
  return (
    <aside className="cc-workspace-rail">
      <div className="cc-workspace-header">
        <span>Workspace</span>
        <b>2</b>
      </div>

      <div className="cc-filter-row" aria-label="Workspace filter">
        <button type="button" aria-pressed="true">All</button>
        <button type="button">Selected</button>
        <button type="button">Live</button>
      </div>

      <RailLabel>Tags</RailLabel>
      <div className="cc-tag-counts">
        <CountChip icon={Crosshair} value="2" />
        <CountChip icon={Sparkles} value="0" />
        <CountChip icon={Eye} value="0" />
        <CountChip icon={Inbox} value="0" />
      </div>

      <p className="cc-selection-summary">1 selected</p>

      <RailLabel>Tag selection</RailLabel>
      <div className="cc-tag-counts cc-tag-counts-quiet">
        <CountChip icon={Crosshair} />
        <CountChip icon={Sparkles} />
        <CountChip icon={Eye} />
        <CountChip icon={Inbox} />
      </div>

      <div className="cc-session-list">
        {SESSIONS.map((session) => {
          const selected = session.id === selectedId;
          return (
            <button
              key={session.id}
              type="button"
              className="cc-session-row"
              aria-pressed={selected}
              onClick={() => onSelect(session.id)}
            >
              <span>{session.title}</span>
              <Focus size={13} />
            </button>
          );
        })}
      </div>

      <div className="cc-workspace-bottom">
        <button type="button" className="cc-settings-row">
          <span>Settings</span>
          <Settings size={14} />
        </button>
        <div className="cc-minimap-heading">
          <RailLabel>Minimap</RailLabel>
          <span>
            <button type="button" aria-label="Collapse minimap">⌃</button>
            <button type="button" aria-label="Fit minimap"><Maximize2 size={11} /></button>
            <b>100%</b>
          </span>
        </div>
        <div className="cc-minimap" aria-label="Canvas minimap">
          <i className="cc-mini-viewport" />
          <i className="cc-mini-node cc-mini-node-one" />
          <i className="cc-mini-node cc-mini-node-two" />
        </div>
      </div>
    </aside>
  );
}

function RailLabel({ children }: { children: string }) {
  return <div className="cc-rail-label">{children}</div>;
}

function CountChip({ icon: IconComponent, value }: { icon: Icon; value?: string }) {
  return (
    <button type="button" className="cc-count-chip">
      <IconComponent size={12} />
      {value ? <span>{value}</span> : null}
    </button>
  );
}

function CanvasStage({
  treatment,
  selectedId,
  onSelect,
  notesVisible,
}: {
  treatment: Treatment;
  selectedId: SessionId;
  onSelect: (id: SessionId) => void;
  notesVisible: boolean;
}) {
  const selected = SESSIONS.find((session) => session.id === selectedId) ?? SESSIONS[1];
  const trackNumber = selected.id === "session-1" ? "01" : "02";

  return (
    <section className="cc-canvas" aria-label="Spatial terminal canvas">
      <div className="cc-canvas-grid" aria-hidden="true" />
      <div className="cc-canvas-depth" aria-hidden="true" />
      <div className="cc-flight-envelope" aria-hidden="true">
        <span className="cc-envelope-label">LOCAL FRAME / HUDSON-CANVAS</span>
        <span className="cc-envelope-scale">GRID 024 / MAJOR 144</span>
      </div>


      <div className="cc-control-capsule" aria-label="Canvas tools">
        <span className="cc-tool-mode" aria-hidden="true"><i /> NAV</span>
        <i className="cc-tool-divider" aria-hidden="true" />
        <ToolButton icon={MousePointer2} selected label="Select" />
        <ToolButton icon={Hand} label="Pan" />
        <i className="cc-tool-divider" aria-hidden="true" />
        <ToolButton icon={Command} label="Commands" compactText="⌘ K" kind="command" />
        <i className="cc-tool-divider" aria-hidden="true" />
        <ToolButton icon={PanelBottom} label="Terminal drawer" />
        <ToolButton icon={Columns2} label="Inspector" />
        <i className="cc-tool-divider" aria-hidden="true" />
        <ToolButton icon={Plus} label="New terminal" />
      </div>

      {treatment === "precision" ? (
        <div className="cc-focus-field" data-focus={selectedId} aria-hidden="true">
          <span className="cc-focus-lock">
            <b>TRACK {trackNumber}</b>
            <small>{selected.shortId} / SELECTED</small>
          </span>
        </div>
      ) : null}

      <div className="cc-canvas-world">
        {SESSIONS.map((session) => (
          <TerminalWindow
            key={session.id}
            session={session}
            selected={selectedId === session.id}
            onSelect={() => onSelect(session.id)}
          />
        ))}
      </div>

      {notesVisible ? <CraftNotes treatment={treatment} /> : null}

      <div className="cc-canvas-status">
        <span className="cc-status-metric">
          <b>2</b> nodes
        </span>
        <i />
        <span className="cc-status-metric">
          <em /> <b>0</b> live
        </span>
        <i />
        <span>LOCAL DEV</span>
        <i />
        <span>hudson-canvas</span>
        <i />
        <span className="cc-status-track">
          TRACK {trackNumber} · X {selected.x} Y {selected.y} · Z {selected.z}
        </span>
        <span className="cc-status-mode">
          select · <b>100%</b>
        </span>
      </div>

      <div className="cc-zoom-controls" aria-label="Canvas zoom">
        <button type="button" aria-label="Zoom out"><Minus size={11} /></button>
        <b>100%</b>
        <button type="button" aria-label="Zoom in"><Plus size={11} /></button>
        <i className="cc-zoom-divider" aria-hidden="true" />
        <button type="button" aria-label="Reset zoom"><RotateCcw size={11} /></button>
        <button type="button" aria-label="Fit canvas"><Maximize2 size={11} /></button>
      </div>
    </section>
  );
}

function ToolButton({
  icon: IconComponent,
  label,
  selected = false,
  compactText,
  kind,
}: {
  icon: Icon;
  label: string;
  selected?: boolean;
  compactText?: string;
  kind?: string;
}) {
  return (
    <button
      type="button"
      className="cc-tool-button"
      data-kind={kind}
      aria-label={label}
      aria-pressed={selected}
      title={label}
    >
      <IconComponent size={13} />
      {compactText ? <span>{compactText}</span> : null}
    </button>
  );
}

function TerminalWindow({
  session,
  selected,
  onSelect,
}: {
  session: SessionFixture;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="cc-terminal-window"
      data-session={session.id}
      data-tone={session.tone}
      aria-pressed={selected}
      onClick={onSelect}
      style={{
        left: session.x,
        top: session.y,
        width: session.w,
        height: session.h,
        zIndex: session.z,
      }}
    >
      <span className="cc-terminal-titlebar">
        <span className="cc-terminal-lights" aria-hidden="true"><i /><i /><i /></span>
        <span className="cc-terminal-title"><Terminal size={12} /> {session.title}</span>
        <span className="cc-terminal-meta">{session.runtime}</span>
        <Maximize2 size={12} />
      </span>
      <span className="cc-terminal-body">
        <span className="cc-terminal-prompt">
          <b>◆</b>
          <em>›</em>
          <strong>{session.cwd}</strong>
          <i />
          <span>system ⌂</span>
          <small>at 02:00:10</small>
        </span>
        <span className="cc-terminal-cursor" />
      </span>
      <span className="cc-resize-corner" aria-hidden="true" />
    </button>
  );
}

function CraftNotes({ treatment }: { treatment: Treatment }) {
  if (treatment === "current") {
    return (
      <aside className="cc-craft-notes">
        <span>Reference fixture</span>
        <strong>Current composition, approximated</strong>
        <p>Hand-built from the native screenshot; compare hierarchy, not pixel fidelity.</p>
      </aside>
    );
  }

  return (
    <aside className="cc-craft-notes">
      <span>Precision pass</span>
      <strong>Depth follows focus</strong>
      <p>Quieter rails · clearer selected plane · inspector reads as one instrument.</p>
    </aside>
  );
}

function Inspector({ session }: { session: SessionFixture }) {
  return (
    <aside className="cc-inspector">
      <div className="cc-inspector-title">Detail</div>

      <div className="cc-capability-band">
        <span><i /> TMUX</span>
        <b>READY</b>
        <p>Local tmux-backed sessions can be attached and restored.</p>
      </div>

      <div className="cc-detail-heading">
        <span className="cc-selection-dot" data-tone={session.tone} />
        <span>
          <strong>{session.title}</strong>
          <small>{session.runtime}</small>
        </span>
      </div>

      <div className="cc-metric-grid">
        <Metric label="X" value={session.x} />
        <Metric label="Y" value={session.y} />
        <Metric label="W" value={session.w} />
        <Metric label="H" value={session.h} />
        <Metric label="Z" value={session.z} />
        <Metric label="ID" value={session.shortId} />
      </div>

      <RailLabel>Runtime</RailLabel>
      <div className="cc-runtime-detail">
        <b>{session.backend}</b>
        <span>{session.runtime}</span>
      </div>

      <div className="cc-inspector-actions">
        <button type="button"><Crosshair size={13} /> Center</button>
        <button type="button"><X size={13} /> Close</button>
      </div>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="cc-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

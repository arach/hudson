import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  TerminalRelay,
  useTerminalRelay,
  usePersistentState,
  usePlatform,
  type RelayStatus,
} from "hudsonkit";
import { Canvas } from "hudsonkit/canvas";
import { ZoomControls } from "hudsonkit/chrome";

// ---------------------------------------------------------------------------
// Canvas + Terminals — composition study.
//
// Real Hudson canvas (Canvas + zoomed world layer + ZoomControls) hosting
// PTY-backed cards (xterm via TerminalRelay).
//
// Interactions:
//   - drag header to move; space + drag empty canvas to pan; wheel to zoom
//   - right-click empty canvas → 2-step wizard (cwd → identity + backend)
//   - click tone dot → toggle at-rest (collapses to a 320×44 summary chip)
//   - layout (cards, pan, scale) persists via `usePersistentState`
//   - per-card backend toggle: `pty` (orphan-TTL persistence) vs `tmux`
//     (cross-reload persistence)
// ---------------------------------------------------------------------------

type Tone = "neutral" | "emerald" | "amber" | "cyan";
type Backend = "pty" | "tmux";

interface TerminalCard {
  id: string;
  title: string;
  tone: Tone;
  cwd: string;
  backend: Backend;
  x: number;
  y: number;
  /** Width when expanded. At-rest dimensions are constants below. */
  w: number;
  /** Height when expanded. */
  h: number;
  z: number;
  resting: boolean;
  /** ms timestamp; used by at-rest summary to render "up Xm". */
  createdAt: number;
}

const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-zinc-400",
  emerald: "bg-emerald-400",
  amber: "bg-amber-400",
  cyan: "bg-cyan-400",
};

const TONE_RING: Record<Tone, string> = {
  neutral: "ring-zinc-400/60",
  emerald: "ring-emerald-400/70",
  amber: "ring-amber-400/70",
  cyan: "ring-cyan-400/70",
};

const TONE_HEADER_TINT: Record<Tone, string> = {
  neutral: "from-zinc-500/5",
  emerald: "from-emerald-500/15",
  amber: "from-amber-500/15",
  cyan: "from-cyan-500/15",
};

interface CwdPreset {
  label: string;
  cwd: string;
  tone: Tone;
}

const CWD_PRESETS: CwdPreset[] = [
  { label: "~/dev/hudson", cwd: "/Users/arach/dev/hudson", tone: "emerald" },
  { label: "~/dev/studio", cwd: "/Users/arach/dev/studio", tone: "cyan" },
  { label: "~", cwd: "~", tone: "amber" },
];

const HEADER_HEIGHT = 28;
const REST_HEIGHT = 76;
const REST_WIDTH = 340;
const NEW_CARD_SIZE = { w: 580, h: 360 };
const MIN_SCALE = 0.35;
const MAX_SCALE = 2;

const INITIAL_CARDS: TerminalCard[] = [
  {
    id: "hudson",
    title: "~/dev/hudson",
    tone: "emerald",
    cwd: "/Users/arach/dev/hudson",
    backend: "pty",
    x: -650,
    y: -260,
    w: 580,
    h: 360,
    z: 1,
    resting: false,
    createdAt: 0,
  },
  {
    id: "studio",
    title: "~/dev/studio",
    tone: "cyan",
    cwd: "/Users/arach/dev/studio",
    backend: "pty",
    x: 50,
    y: -260,
    w: 580,
    h: 360,
    z: 2,
    resting: false,
    createdAt: 0,
  },
  {
    id: "home",
    title: "~",
    tone: "amber",
    cwd: "~",
    backend: "pty",
    x: -300,
    y: 140,
    w: 700,
    h: 300,
    z: 3,
    resting: false,
    createdAt: 0,
  },
];

interface PersistedLayout {
  cards: TerminalCard[];
  pan: { x: number; y: number };
  scale: number;
  /** Last non-empty output line per card. Surfaced on at-rest summaries
   *  so a glance tells you what each session was last doing — survives
   *  reload + rest because we persist it alongside the layout. */
  lastLines: Record<string, string>;
}

const DEFAULT_LAYOUT: PersistedLayout = {
  cards: INITIAL_CARDS,
  pan: { x: 0, y: 0 },
  scale: 1,
  lastLines: {},
};

interface WizardState {
  screen: { x: number; y: number };
  world: { x: number; y: number };
  step: 1 | 2;
  cwd: string;
  customCwd: string;
  tone: Tone;
  title: string;
  backend: Backend;
}

// ---------------------------------------------------------------------------
// Exhibit root
// ---------------------------------------------------------------------------

export function CanvasTerminalsExhibit() {
  const [layout, setLayout] = usePersistentState<PersistedLayout>(
    "studio.canvas-terminals.layout.v1",
    DEFAULT_LAYOUT,
  );
  const [wizard, setWizard] = useState<WizardState | null>(null);
  const [cardStatus, setCardStatus] = useState<Record<string, RelayStatus>>({});
  const [cardConnectedAt, setCardConnectedAt] = useState<
    Record<string, number>
  >({});

  // Tick to keep "up Xm" labels fresh on at-rest summaries.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const { cards, pan, scale } = layout;
  // Migration: older persisted layouts may lack `lastLines`.
  const lastLines = layout.lastLines ?? {};

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: string;
    startMouse: { x: number; y: number };
    startPos: { x: number; y: number };
  } | null>(null);
  const nextIdRef = useRef(1);

  const maxZ = useMemo(
    () => cards.reduce((m, c) => (c.z > m ? c.z : m), 0),
    [cards],
  );

  const setCards = useCallback(
    (updater: (cs: TerminalCard[]) => TerminalCard[]) =>
      setLayout((l) => ({ ...l, cards: updater(l.cards) })),
    [setLayout],
  );

  const handlePan = useCallback(
    (delta: { x: number; y: number }) =>
      setLayout((l) => ({
        ...l,
        pan: { x: l.pan.x + delta.x, y: l.pan.y + delta.y },
      })),
    [setLayout],
  );

  const handleZoom = useCallback(
    (next: number) =>
      setLayout((l) => ({
        ...l,
        scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, next)),
      })),
    [setLayout],
  );

  const bringToFront = useCallback(
    (id: string) =>
      setCards((cs) => {
        const top = cs.reduce((m, c) => (c.z > m ? c.z : m), 0);
        return cs.map((c) => (c.id === id ? { ...c, z: top + 1 } : c));
      }),
    [setCards],
  );

  const toggleResting = useCallback(
    (id: string) =>
      setCards((cs) =>
        cs.map((c) => (c.id === id ? { ...c, resting: !c.resting } : c)),
      ),
    [setCards],
  );

  const onHeaderMouseDown = useCallback(
    (id: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const card = cards.find((c) => c.id === id);
      if (!card) return;
      dragRef.current = {
        id,
        startMouse: { x: e.clientX, y: e.clientY },
        startPos: { x: card.x, y: card.y },
      };
      bringToFront(id);

      const onMove = (ev: MouseEvent) => {
        const d = dragRef.current;
        if (!d) return;
        const dx = (ev.clientX - d.startMouse.x) / scale;
        const dy = (ev.clientY - d.startMouse.y) / scale;
        setCards((cs) =>
          cs.map((c) =>
            c.id === d.id
              ? { ...c, x: d.startPos.x + dx, y: d.startPos.y + dy }
              : c,
          ),
        );
      };
      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [bringToFront, cards, scale, setCards],
  );

  const onReset = useCallback(() => {
    setLayout(DEFAULT_LAYOUT);
    setCardStatus({});
    setCardConnectedAt({});
    nextIdRef.current = 1;
    setWizard(null);
  }, [setLayout]);

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-canvas-card]")) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      e.preventDefault();

      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;
      const worldX = (localX - rect.width / 2) / scale - pan.x;
      const worldY = (localY - rect.height / 2) / scale - pan.y;

      setWizard({
        screen: { x: localX, y: localY },
        world: { x: worldX, y: worldY },
        step: 1,
        cwd: "",
        customCwd: "",
        tone: "neutral",
        title: "",
        backend: "pty",
      });
    },
    [pan.x, pan.y, scale],
  );

  useEffect(() => {
    if (!wizard) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWizard(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [wizard]);

  const commitNewCard = useCallback(
    (w: WizardState) => {
      const id = `term-${Date.now().toString(36)}-${nextIdRef.current++}`;
      const cwd = w.cwd === "__custom__" ? w.customCwd.trim() || "~" : w.cwd;
      const title = w.title.trim() || prettyCwd(cwd);
      const card: TerminalCard = {
        id,
        title,
        tone: w.tone,
        cwd,
        backend: w.backend,
        x: w.world.x - NEW_CARD_SIZE.w / 2,
        y: w.world.y - 16,
        w: NEW_CARD_SIZE.w,
        h: NEW_CARD_SIZE.h,
        z: maxZ + 1,
        resting: false,
        createdAt: Date.now(),
      };
      setCards((cs) => [...cs, card]);
      setWizard(null);
    },
    [maxZ, setCards],
  );

  const onCardStatusChange = useCallback(
    (id: string, status: RelayStatus) => {
      setCardStatus((s) => (s[id] === status ? s : { ...s, [id]: status }));
      if (status === "connected") {
        setCardConnectedAt((s) => (s[id] ? s : { ...s, [id]: Date.now() }));
      }
    },
    [],
  );

  const onCardLastLine = useCallback(
    (id: string, line: string) => {
      setLayout((l) => {
        const current = l.lastLines?.[id];
        if (current === line) return l;
        return { ...l, lastLines: { ...(l.lastLines ?? {}), [id]: line } };
      });
    },
    [setLayout],
  );

  return (
    <div
      ref={containerRef}
      onContextMenu={onContextMenu}
      className="relative h-full w-full overflow-hidden bg-background text-foreground"
    >
      <Canvas
        panOffset={pan}
        scale={scale}
        onPan={handlePan}
        showGuides={false}
        gridOpacity={1}
      />

      <div
        className="absolute z-10 pointer-events-none"
        style={{ left: "50%", top: "50%", zoom: scale }}
      >
        <div style={{ position: "absolute", left: pan.x, top: pan.y }}>
          {cards.map((card) => {
            const status = cardStatus[card.id];
            const connectedAt = cardConnectedAt[card.id];
            return (
              <TerminalCardView
                key={card.id}
                card={card}
                status={status}
                connectedAt={connectedAt}
                lastLine={lastLines[card.id]}
                onHeaderMouseDown={onHeaderMouseDown(card.id)}
                onToggleResting={() => toggleResting(card.id)}
                onStatusChange={onCardStatusChange}
                onLastLine={onCardLastLine}
              />
            );
          })}
        </div>
      </div>

      <Toolbar
        scale={scale}
        cardCount={cards.length}
        restingCount={cards.filter((c) => c.resting).length}
        activeZ={maxZ}
        onReset={onReset}
      />

      <div className="absolute bottom-5 right-5 z-30">
        <ZoomControls scale={scale} onZoom={handleZoom} />
      </div>

      {wizard ? (
        <NewTerminalWizard
          state={wizard}
          onChange={setWizard}
          onCancel={() => setWizard(null)}
          onCommit={commitNewCard}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// HUD toolbar
// ---------------------------------------------------------------------------

function Toolbar({
  scale,
  cardCount,
  restingCount,
  activeZ,
  onReset,
}: {
  scale: number;
  cardCount: number;
  restingCount: number;
  activeZ: number;
  onReset: () => void;
}) {
  const active = cardCount - restingCount;
  return (
    <div className="absolute left-0 right-0 top-0 z-30 flex items-center justify-between border-b border-studio-edge bg-studio-canvas-alt/85 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-studio-ink-faint backdrop-blur">
      <div className="flex items-center gap-3">
        <span className="text-studio-ink">· canvas + terminals</span>
        <Sep />
        <span>
          {active} active
          {restingCount > 0 ? (
            <span className="text-studio-ink-faint"> · {restingCount} resting</span>
          ) : null}
        </span>
        <Sep />
        <span>z-top {activeZ}</span>
        <Sep />
        <span className="text-studio-ink-faint">relay ws://localhost:3600</span>
      </div>
      <div className="flex items-center gap-3">
        <span>scale {(scale * 100).toFixed(0)}%</span>
        <span className="text-studio-ink-faint">
          right-click to spawn · tone-dot to rest
        </span>
        <button
          type="button"
          onClick={onReset}
          className="rounded-[3px] border border-studio-edge px-2 py-0.5 text-[9.5px] text-studio-ink hover:border-studio-rule-strong hover:bg-studio-chip-bg"
        >
          reset
        </button>
      </div>
    </div>
  );
}

function Sep() {
  return <span className="text-studio-rule">|</span>;
}

// ---------------------------------------------------------------------------
// New-terminal wizard — 2-step popover anchored at right-click location
// ---------------------------------------------------------------------------

function NewTerminalWizard({
  state,
  onChange,
  onCancel,
  onCommit,
}: {
  state: WizardState;
  onChange: (next: WizardState) => void;
  onCancel: () => void;
  onCommit: (next: WizardState) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onCancel();
    };
    const id = window.setTimeout(() => {
      document.addEventListener("mousedown", onDoc);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [onCancel]);

  return (
    <div
      ref={ref}
      data-canvas-card="wizard"
      className="absolute z-40 w-[320px] overflow-hidden rounded-md border border-studio-edge bg-studio-canvas-alt shadow-[0_18px_50px_rgba(0,0,0,0.35)]"
      style={{ left: state.screen.x, top: state.screen.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <WizardHeader step={state.step} onCancel={onCancel} />
      {state.step === 1 ? (
        <StepCwd state={state} onChange={onChange} />
      ) : (
        <StepIdentity state={state} onChange={onChange} onCommit={onCommit} />
      )}
    </div>
  );
}

function WizardHeader({
  step,
  onCancel,
}: {
  step: 1 | 2;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-studio-edge bg-studio-canvas/60 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-studio-ink-faint">
      <div className="flex items-center gap-2">
        <span className="text-studio-ink">· new terminal</span>
        <span className="text-studio-rule">|</span>
        <span>{step === 1 ? "1 / 2 · directory" : "2 / 2 · identity"}</span>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="text-studio-ink-faint hover:text-studio-ink-strong"
        aria-label="Cancel"
      >
        ×
      </button>
    </div>
  );
}

function StepCwd({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (next: WizardState) => void;
}) {
  const advance = (cwd: string, tone: Tone) => {
    const cleanCwd = cwd.trim() || "~";
    onChange({
      ...state,
      cwd: cleanCwd,
      tone,
      title: prettyCwd(cleanCwd),
      step: 2,
    });
  };

  return (
    <div className="p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-ink-faint">
        starting directory
      </div>
      <ul className="mt-2 flex flex-col gap-1">
        {CWD_PRESETS.map((preset) => (
          <li key={preset.cwd}>
            <button
              type="button"
              onClick={() => advance(preset.cwd, preset.tone)}
              className="group flex w-full items-center gap-2.5 rounded-[3px] border border-studio-edge bg-studio-canvas px-2.5 py-1.5 text-left hover:border-studio-rule-strong hover:bg-studio-chip-bg"
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[preset.tone]} shadow-[0_0_6px_currentColor]`}
              />
              <span className="font-mono text-[12px] text-studio-ink-strong">
                {preset.label}
              </span>
              <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.16em] text-studio-ink-faint group-hover:text-studio-ink">
                shell
              </span>
            </button>
          </li>
        ))}
        <li>
          {state.cwd === "__custom__" ? (
            <div className="rounded-[3px] border border-studio-edge bg-studio-canvas p-2">
              <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-studio-ink-faint">
                custom path
              </div>
              <input
                autoFocus
                type="text"
                value={state.customCwd}
                onChange={(e) =>
                  onChange({ ...state, customCwd: e.target.value })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    advance(state.customCwd || "~", "neutral");
                  }
                }}
                placeholder="/path/to/dir or ~/shortcut"
                className="w-full rounded-sm border border-studio-edge bg-studio-canvas-alt px-2 py-1 font-mono text-[12px] text-studio-ink-strong placeholder:text-studio-ink-faint focus:border-cyan-500/60 focus:outline-none"
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => advance(state.customCwd || "~", "neutral")}
                  className="rounded-[3px] border border-studio-edge px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-studio-ink hover:border-studio-rule-strong hover:bg-studio-chip-bg"
                >
                  next →
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() =>
                onChange({ ...state, cwd: "__custom__", tone: "neutral" })
              }
              className="flex w-full items-center gap-2.5 rounded-[3px] border border-dashed border-studio-edge bg-studio-canvas/50 px-2.5 py-1.5 text-left hover:border-studio-rule-strong hover:bg-studio-canvas"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-studio-ink-faint" />
              <span className="font-mono text-[12px] text-studio-ink">
                custom path…
              </span>
            </button>
          )}
        </li>
      </ul>
    </div>
  );
}

function StepIdentity({
  state,
  onChange,
  onCommit,
}: {
  state: WizardState;
  onChange: (next: WizardState) => void;
  onCommit: (next: WizardState) => void;
}) {
  const tones: Tone[] = ["emerald", "cyan", "amber", "neutral"];
  return (
    <div className="p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-ink-faint">
        card identity
      </div>
      <div className="mt-2 rounded-[3px] border border-studio-edge bg-studio-canvas px-2.5 py-2">
        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-studio-ink-faint">
          cwd
        </div>
        <div className="mt-0.5 truncate font-mono text-[12px] text-studio-ink-strong">
          {prettyCwd(state.cwd === "__custom__" ? state.customCwd : state.cwd)}
        </div>
      </div>

      <div className="mt-3">
        <label className="block font-mono text-[9px] uppercase tracking-[0.18em] text-studio-ink-faint">
          title
        </label>
        <input
          autoFocus
          type="text"
          value={state.title}
          onChange={(e) => onChange({ ...state, title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommit(state);
          }}
          className="mt-1 w-full rounded-sm border border-studio-edge bg-studio-canvas px-2 py-1 font-mono text-[12px] text-studio-ink-strong placeholder:text-studio-ink-faint focus:border-cyan-500/60 focus:outline-none"
          placeholder="~/dev/hudson"
        />
      </div>

      <div className="mt-3">
        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-studio-ink-faint">
          tone
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          {tones.map((tone) => (
            <button
              key={tone}
              type="button"
              onClick={() => onChange({ ...state, tone })}
              aria-pressed={state.tone === tone}
              className={`h-6 w-6 rounded-full transition-shadow ${TONE_DOT[tone]} ${
                state.tone === tone
                  ? `ring-2 ring-offset-2 ring-offset-studio-canvas-alt ${TONE_RING[tone]}`
                  : "opacity-80 hover:opacity-100"
              }`}
              title={tone}
            />
          ))}
        </div>
      </div>

      <div className="mt-3">
        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-studio-ink-faint">
          backend
        </div>
        <div className="mt-1.5 flex items-center gap-1">
          <BackendChoice
            value="pty"
            current={state.backend}
            label="PTY"
            hint="orphan-ttl persistence"
            onSelect={(b) => onChange({ ...state, backend: b })}
          />
          <BackendChoice
            value="tmux"
            current={state.backend}
            label="tmux"
            hint="survives reload"
            onSelect={(b) => onChange({ ...state, backend: b })}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onChange({ ...state, step: 1 })}
          className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-ink-faint hover:text-studio-ink-strong"
        >
          ← back
        </button>
        <button
          type="button"
          onClick={() => onCommit(state)}
          className="rounded-[3px] border border-emerald-500/60 bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-200 hover:border-emerald-400 hover:bg-emerald-500/15"
        >
          create terminal
        </button>
      </div>
    </div>
  );
}

function BackendChoice({
  value,
  current,
  label,
  hint,
  onSelect,
}: {
  value: Backend;
  current: Backend;
  label: string;
  hint: string;
  onSelect: (b: Backend) => void;
}) {
  const selected = current === value;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={selected}
      className={`flex flex-1 flex-col items-start gap-0.5 rounded-[3px] border px-2 py-1.5 text-left transition-colors ${
        selected
          ? "border-cyan-500/60 bg-cyan-500/10"
          : "border-studio-edge bg-studio-canvas hover:border-studio-rule-strong hover:bg-studio-chip-bg"
      }`}
    >
      <span
        className={`font-mono text-[11px] uppercase tracking-[0.16em] ${
          selected ? "text-cyan-700 dark:text-cyan-200" : "text-studio-ink"
        }`}
      >
        {label}
      </span>
      <span className="font-mono text-[9px] text-studio-ink-faint">{hint}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Live terminal card — full + at-rest renders
// ---------------------------------------------------------------------------

function TerminalCardView({
  card,
  status,
  connectedAt,
  lastLine,
  onHeaderMouseDown,
  onToggleResting,
  onStatusChange,
  onLastLine,
}: {
  card: TerminalCard;
  status: RelayStatus | undefined;
  connectedAt: number | undefined;
  lastLine: string | undefined;
  onHeaderMouseDown: (e: React.MouseEvent) => void;
  onToggleResting: () => void;
  onStatusChange: (id: string, status: RelayStatus) => void;
  onLastLine: (id: string, line: string) => void;
}) {
  if (card.resting) {
    return (
      <RestingCardView
        card={card}
        status={status}
        connectedAt={connectedAt}
        lastLine={lastLine}
        onHeaderMouseDown={onHeaderMouseDown}
        onToggleResting={onToggleResting}
      />
    );
  }
  return (
    <LiveCardView
      card={card}
      onHeaderMouseDown={onHeaderMouseDown}
      onToggleResting={onToggleResting}
      onStatusChange={onStatusChange}
      onLastLine={onLastLine}
    />
  );
}

function LiveCardView({
  card,
  onHeaderMouseDown,
  onToggleResting,
  onStatusChange,
  onLastLine,
}: {
  card: TerminalCard;
  onHeaderMouseDown: (e: React.MouseEvent) => void;
  onToggleResting: () => void;
  onStatusChange: (id: string, status: RelayStatus) => void;
  onLastLine: (id: string, line: string) => void;
}) {
  const { serviceApiUrl } = usePlatform();
  const relay = useTerminalRelay({
    url: "ws://localhost:3600",
    agent: "shell",
    cwd: card.cwd,
    sessionKey: `studio-canvas-terminals-${card.id}`,
    autoConnect: true,
    backend: card.backend,
    ...(card.backend === "tmux"
      ? { tmuxSession: `hudson-canvas-${card.id}` }
      : {}),
  });

  // Bubble status changes up so the parent can render at-rest summaries
  // for other (resting) cards with accurate connection state.
  useEffect(() => {
    onStatusChange(card.id, relay.status);
  }, [card.id, relay.status, onStatusChange]);

  // Passive output subscriber → extract the most recent non-empty line and
  // report it up. The primary sink (xterm) is unaffected.
  const { subscribeData } = relay;
  useEffect(() => {
    let tailBuffer = "";
    const TAIL_KEEP = 4 * 1024;
    let lastReported = "";
    const unsub = subscribeData((chunk) => {
      tailBuffer = (tailBuffer + chunk).slice(-TAIL_KEEP);
      const cleaned = stripAnsi(tailBuffer);
      const lines = cleaned.split(/\r?\n/);
      while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
        lines.pop();
      }
      const last = (lines[lines.length - 1] ?? "")
        .replace(/\r/g, "")
        .trimEnd();
      if (last && last !== lastReported) {
        lastReported = last;
        onLastLine(card.id, last.length > 120 ? last.slice(-120) : last);
      }
    });
    return unsub;
  }, [subscribeData, card.id, onLastLine]);

  const configItems = useMemo(
    () => [
      { label: "Relay", value: "ws://localhost:3600" },
      { label: "Backend", value: card.backend },
      { label: "CWD", value: card.cwd },
    ],
    [card.backend, card.cwd],
  );

  const handleStartRelay = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`${serviceApiUrl}/api/services/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: "relay",
          action: "start",
          triggeredBy: "user",
        }),
      });
      const data = await res.json();
      return data.success === true;
    } catch {
      return false;
    }
  }, [serviceApiUrl]);

  return (
    <CardShell card={card}>
      <CardHeader
        card={card}
        onMouseDown={onHeaderMouseDown}
        onToggleResting={onToggleResting}
        resting={false}
      />
      <div
        className="bg-studio-canvas"
        style={{ height: `calc(100% - ${HEADER_HEIGHT}px)` }}
      >
        <TerminalRelay
          relay={relay}
          configItems={configItems}
          onStartService={handleStartRelay}
        />
      </div>
    </CardShell>
  );
}

function RestingCardView({
  card,
  status,
  connectedAt,
  lastLine,
  onHeaderMouseDown,
  onToggleResting,
}: {
  card: TerminalCard;
  status: RelayStatus | undefined;
  connectedAt: number | undefined;
  lastLine: string | undefined;
  onHeaderMouseDown: (e: React.MouseEvent) => void;
  onToggleResting: () => void;
}) {
  const upLabel = useMemo(() => {
    if (!status || status === "disconnected") return "idle";
    if (status === "connecting") return "connecting…";
    if (status === "error") return "error";
    if (status === "connected" && connectedAt) {
      // eslint-disable-next-line react-hooks/purity -- exhibit-only uptime label; snapshots Date.now() when status/connectedAt change (the memo deps). A live-ticking clock isn't needed for this static demo label
      return `up ${humanizeDuration(Date.now() - connectedAt)}`;
    }
    return status;
  }, [status, connectedAt]);

  return (
    <CardShell card={card} overrideSize={{ w: REST_WIDTH, h: REST_HEIGHT }}>
      <CardHeader
        card={card}
        onMouseDown={onHeaderMouseDown}
        onToggleResting={onToggleResting}
        resting
      />
      <button
        type="button"
        onClick={onToggleResting}
        className="flex h-[calc(100%-28px)] w-full flex-col items-stretch justify-center gap-1 bg-studio-canvas px-3 text-left hover:bg-studio-canvas-alt"
        title="Resume terminal"
      >
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-studio-ink-faint">
            resting · {upLabel}
          </span>
          <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.18em] text-studio-ink-faint">
            resume →
          </span>
        </div>
        <div
          className="truncate font-mono text-[11px] text-studio-ink"
          title={lastLine}
        >
          {lastLine ? (
            <span className="text-studio-ink-strong">{lastLine}</span>
          ) : (
            <span className="text-studio-ink-faint italic">no output yet</span>
          )}
        </div>
      </button>
    </CardShell>
  );
}

// ---------------------------------------------------------------------------
// Shared card chrome
// ---------------------------------------------------------------------------

function CardShell({
  card,
  overrideSize,
  children,
}: {
  card: TerminalCard;
  overrideSize?: { w: number; h: number };
  children: ReactNode;
}) {
  const w = overrideSize?.w ?? card.w;
  const h = overrideSize?.h ?? card.h;
  return (
    <div
      data-canvas-card={card.id}
      data-interactive="true"
      className="absolute pointer-events-auto overflow-hidden rounded-md border border-studio-edge bg-studio-canvas-alt shadow-[0_8px_30px_rgba(0,0,0,0.25)]"
      style={{
        left: card.x,
        top: card.y,
        width: w,
        height: h,
        zIndex: card.z,
      }}
    >
      {children}
    </div>
  );
}

function CardHeader({
  card,
  onMouseDown,
  onToggleResting,
  resting,
}: {
  card: TerminalCard;
  onMouseDown: (e: React.MouseEvent) => void;
  onToggleResting: () => void;
  resting: boolean;
}) {
  const headerTint = TONE_HEADER_TINT[card.tone];
  const dotClass = TONE_DOT[card.tone];

  return (
    <div
      onMouseDown={onMouseDown}
      className={`flex cursor-grab items-center gap-2.5 border-b border-studio-edge bg-gradient-to-b ${headerTint} to-transparent px-2.5 active:cursor-grabbing`}
      style={{ height: HEADER_HEIGHT }}
    >
      <div className="flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
      </div>
      <div className="ml-1 min-w-0 flex-1 truncate font-mono text-[11px] text-studio-ink-strong">
        {card.title}
      </div>
      {card.backend === "tmux" ? (
        <span
          title="tmux-backed session (survives reload)"
          className="rounded-sm border border-studio-edge bg-studio-canvas px-1 py-px font-mono text-[8.5px] uppercase tracking-[0.16em] text-studio-ink-faint"
        >
          tmux
        </span>
      ) : null}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleResting();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        title={resting ? "Resume" : "Rest"}
        aria-label={resting ? "Resume terminal" : "Rest terminal"}
        className={`h-2.5 w-2.5 shrink-0 rounded-full transition-all ${dotClass} ${
          resting
            ? "opacity-35 shadow-none hover:opacity-70"
            : "shadow-[0_0_6px_currentColor] hover:scale-125"
        }`}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function prettyCwd(cwd: string): string {
  if (!cwd) return "~";
  const home = "/Users/arach";
  if (cwd === home) return "~";
  if (cwd.startsWith(`${home}/`)) return `~/${cwd.slice(home.length + 1)}`;
  return cwd;
}

// Strip the most common ANSI escapes from terminal output so the at-rest
// preview line renders as plain text. Covers CSI (color/cursor) and OSC
// (window title etc.). Not exhaustive — good enough for one-line previews.
const ANSI_CSI = /\[[0-9;?]*[A-Za-z]/g;
const ANSI_OSC = /\][^]*/g;
function stripAnsi(input: string): string {
  return input.replace(ANSI_OSC, "").replace(ANSI_CSI, "");
}

function humanizeDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

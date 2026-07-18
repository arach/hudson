/**
 * PaperHost — Frame owns the canvas; chrome is HUD.
 *
 * AppShell canvas mode hides side panels, so Paper composes Frame + hudsonkit
 * chrome directly. Model/MCP unchanged; this is the host re-cut only.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Layers, ScanSearch, Settings as SettingsIcon } from "lucide-react";
// note: selection opens inspector rail when a region is picked
import {
  Frame,
  NavigationBar,
  SidePanel,
  StatusBar,
} from "hudsonkit/chrome";
import { CommandPalette, type CommandOption } from "hudsonkit/overlays";
import { PaperWorld } from "./PaperWorld";
import { usePaperState } from "./PaperState";
import { PaperLeftPanel } from "./slots/LeftPanel";
import { PaperLeftFooter } from "./slots/LeftFooter";
import { PaperInspector } from "./slots/Inspector";
import { SettingsTool } from "./slots/SettingsTool";
import { usePaperCommands } from "./hooks";
import { MAX_SCALE, MIN_SCALE } from "./types";

const LEFT_W_KEY = "hudson.app.hudson-paper.leftW";
const RIGHT_W_KEY = "hudson.app.hudson-paper.rightW";
const LEFT_COLLAPSED_KEY = "hudson.app.hudson-paper.left";
const RIGHT_COLLAPSED_KEY = "hudson.app.hudson-paper.right";

function readBool(key: string, fallback: boolean) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return raw === "true";
  } catch {
    return fallback;
  }
}

function readNum(key: string, fallback: number) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function writePersist(key: string, value: string | number | boolean) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* ignore */
  }
}

function StatusSep() {
  return (
    <span aria-hidden className="select-none text-muted-foreground/40">
      ·
    </span>
  );
}

function StatusChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="tracking-[0.16em] text-muted-foreground">{label}</span>
      <span className="tabular-nums text-foreground/90">{value}</span>
    </span>
  );
}

export function PaperHost() {
  const {
    view,
    settings,
    filesError,
    handlePan,
    handleZoom,
    setViewportSize,
    rightMode,
    setRightMode,
    fitAll,
    inspectMode,
    setInspectMode,
    selection,
  } = usePaperState();

  const [leftCollapsed, setLeftCollapsed] = useState(() =>
    readBool(LEFT_COLLAPSED_KEY, false),
  );
  // Default open so inspect regions are visible without hunting chrome
  const [rightCollapsed, setRightCollapsed] = useState(() =>
    readBool(RIGHT_COLLAPSED_KEY, false),
  );
  const [leftWidth, setLeftWidth] = useState(() => readNum(LEFT_W_KEY, 280));
  // Wider rail — selection + chat needs room
  const [rightWidth, setRightWidth] = useState(() => readNum(RIGHT_W_KEY, 360));
  const [paletteOpen, setPaletteOpen] = useState(false);

  const commandBridge = useMemo(
    () => ({
      openInspector: () => {
        setRightMode("inspector");
        setRightCollapsed(false);
        writePersist(RIGHT_COLLAPSED_KEY, false);
      },
      openSettings: () => {
        setRightMode("settings");
        setRightCollapsed(false);
        writePersist(RIGHT_COLLAPSED_KEY, false);
      },
      toggleLeft: () => {
        setLeftCollapsed((c) => {
          writePersist(LEFT_COLLAPSED_KEY, !c);
          return !c;
        });
      },
      toggleRight: () => {
        setRightCollapsed((c) => {
          writePersist(RIGHT_COLLAPSED_KEY, !c);
          return !c;
        });
      },
    }),
    [setRightMode],
  );
  const appCommands = usePaperCommands(commandBridge);

  const shellCommands: CommandOption[] = useMemo(
    () => [
      {
        id: "shell:toggle-left",
        label: "Toggle journeys panel",
        shortcut: "Cmd+[",
        action: () => {
          setLeftCollapsed((c) => {
            writePersist(LEFT_COLLAPSED_KEY, !c);
            return !c;
          });
        },
      },
      {
        id: "shell:toggle-right",
        label: "Toggle inspector",
        shortcut: "Cmd+]",
        action: () => {
          setRightCollapsed((c) => {
            writePersist(RIGHT_COLLAPSED_KEY, !c);
            return !c;
          });
        },
      },
      {
        id: "shell:open-palette",
        label: "Command palette",
        shortcut: "Cmd+K",
        action: () => setPaletteOpen(true),
      },
    ],
    [],
  );

  const allCommands = useMemo(
    () => [...appCommands, ...shellCommands],
    [appCommands, shellCommands],
  );

  // Keyboard: Cmd+K palette, panel toggles, fit
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if (e.key === "[") {
        e.preventDefault();
        setLeftCollapsed((c) => {
          writePersist(LEFT_COLLAPSED_KEY, !c);
          return !c;
        });
      }
      if (e.key === "]") {
        e.preventDefault();
        setRightCollapsed((c) => {
          writePersist(RIGHT_COLLAPSED_KEY, !c);
          return !c;
        });
      }
      if (e.key === "0") {
        e.preventDefault();
        fitAll();
      }
      if (e.key === ",") {
        e.preventDefault();
        setRightMode("settings");
        setRightCollapsed(false);
        writePersist(RIGHT_COLLAPSED_KEY, false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fitAll, setRightMode]);

  // Latest scale for wheel handlers (avoid stale closures between renders)
  const scaleRef = useRef(view.scale);
  scaleRef.current = view.scale;

  /**
   * Map-tool wheel: plain scroll zooms (Frame only does ctrl/meta pinch).
   * Shift = horizontal pan, Alt = vertical pan.
   */
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("input, textarea, select, [data-no-canvas-wheel]")) return;
      // Let Frame handle pinch (ctrl/meta) — it already preventDefaults
      if (e.ctrlKey || e.metaKey) return;

      e.preventDefault();
      const scale = scaleRef.current;

      if (e.shiftKey) {
        const dx = (-e.deltaY || -e.deltaX) / scale;
        handlePan({ x: dx, y: 0 });
        return;
      }
      if (e.altKey) {
        handlePan({ x: 0, y: -e.deltaY / scale });
        return;
      }

      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 800 : 1;
      const raw = -e.deltaY * unit;
      const next = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, scale + raw * 0.0018),
      );
      if (next !== scale) {
        scaleRef.current = next;
        handleZoom(next);
      }
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [handlePan, handleZoom]);

  const onViewportChange = useCallback(
    (size: { width: number; height: number }) => {
      setViewportSize({ w: size.width, h: size.height });
    },
    [setViewportSize],
  );

  const handleResizeStart = useCallback(
    (side: "left" | "right") => (e: ReactMouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = side === "left" ? leftWidth : rightWidth;
      const onMove = (ev: MouseEvent) => {
        const delta = side === "left" ? ev.clientX - startX : startX - ev.clientX;
        const next = Math.min(400, Math.max(220, startW + delta));
        if (side === "left") {
          setLeftWidth(next);
          writePersist(LEFT_W_KEY, next);
        } else {
          setRightWidth(next);
          writePersist(RIGHT_W_KEY, next);
        }
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [leftWidth, rightWidth],
  );

  const statusLeft = useMemo(() => {
    const bits: React.ReactNode[] = [];
    if (view.mapName) {
      bits.push(
        <StatusChip key="map" label="Map" value={view.mapName} />,
      );
    }
    if (view.journeyCount || view.pageCount) {
      bits.push(<StatusSep key="s1" />);
      bits.push(
        <StatusChip
          key="counts"
          label="J·P"
          value={`${view.journeyCount}·${view.pageCount}`}
        />,
      );
    }
    if (view.focusedJourneyName || view.focusedPageName) {
      bits.push(<StatusSep key="s2" />);
      bits.push(
        <StatusChip
          key="focus"
          label="Focus"
          value={[view.focusedJourneyName, view.focusedPageName]
            .filter(Boolean)
            .join(" / ")}
        />,
      );
    }
    if (!bits.length) return null;
    return (
      <div className="flex min-w-0 items-center gap-2 overflow-hidden">
        {bits}
      </div>
    );
  }, [view]);

  const navCenter = useMemo(() => {
    const focus = [view.focusedJourneyName, view.focusedPageName]
      .filter(Boolean)
      .join(" · ");
    const region =
      selection?.kind === "region"
        ? selection.label
        : selection?.kind === "node"
          ? selection.type
          : null;
    return (
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {region ? `${focus || "Map"} · ${region}` : focus || "Map"}
      </span>
    );
  }, [view.focusedJourneyName, view.focusedPageName, selection]);

  const openInspector = () => {
    setRightMode("inspector");
    setRightCollapsed(false);
    writePersist(RIGHT_COLLAPSED_KEY, false);
  };

  // Region/node pick → ensure inspector rail is visible
  useEffect(() => {
    if (selection?.kind === "region" || selection?.kind === "node") {
      setRightMode("inspector");
      setRightCollapsed(false);
      writePersist(RIGHT_COLLAPSED_KEY, false);
    }
  }, [selection, setRightMode]);
  const openSettings = () => {
    setRightMode("settings");
    setRightCollapsed(false);
    writePersist(RIGHT_COLLAPSED_KEY, false);
  };

  const rightContent =
    rightMode === "settings" ? <SettingsTool /> : <PaperInspector />;

  // Panel vertical insets: nav ~48, status ~28
  const panelStyle = { top: 48, bottom: 28 } as const;
  const zoomRightOffset = !rightCollapsed ? rightWidth : 0;

  return (
    <Frame
      mode="canvas"
      panOffset={view.pan}
      scale={view.scale}
      onPan={handlePan}
      onZoom={handleZoom}
      onViewportChange={onViewportChange}
      zoomControlsRightOffset={zoomRightOffset}
      zoomControlsBottomOffset={0}
      showZoomControls
      canvasProps={{
        showGuides: false,
        gridOpacity: settings.gridOpacity,
      }}
      zoomSensitivity={1.2}
      hud={
        <>
          <NavigationBar
            title="PAPER"
            subtitle={
              <Layers size={13} strokeWidth={1.5} className="text-foreground/80" />
            }
            center={navCenter}
            actions={
              <div className="flex items-center gap-0.5 pointer-events-auto">
                <button
                  type="button"
                  onClick={() => setInspectMode(!inspectMode)}
                  className={`rounded border px-1.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] transition-colors ${
                    inspectMode
                      ? "border-accent/30 bg-accent/10 text-foreground"
                      : "border-transparent text-foreground/70 hover:border-border hover:bg-muted hover:text-foreground"
                  }`}
                  title="Pick regions on the active page card"
                  aria-label="Toggle inspect pick mode"
                  aria-pressed={inspectMode}
                >
                  Pick
                </button>
                <button
                  type="button"
                  onClick={openInspector}
                  className={`rounded border p-1.5 transition-colors ${
                    !rightCollapsed && rightMode === "inspector"
                      ? "border-accent/30 bg-accent/10 text-foreground"
                      : "border-transparent text-foreground/70 hover:border-border hover:bg-muted hover:text-foreground"
                  }`}
                  title="Inspector (Cmd+])"
                  aria-label="Toggle inspector"
                >
                  <ScanSearch size={13} strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  onClick={openSettings}
                  className={`rounded border p-1.5 transition-colors ${
                    !rightCollapsed && rightMode === "settings"
                      ? "border-accent/30 bg-accent/10 text-foreground"
                      : "border-transparent text-foreground/70 hover:border-border hover:bg-muted hover:text-foreground"
                  }`}
                  title="Settings (Cmd+,)"
                  aria-label="Open settings"
                >
                  <SettingsIcon size={13} strokeWidth={1.5} />
                </button>
              </div>
            }
          />

          <SidePanel
            side="left"
            title="Journeys"
            icon={<Layers size={12} strokeWidth={1.5} />}
            isCollapsed={leftCollapsed}
            onToggleCollapse={() => {
              setLeftCollapsed((c) => {
                writePersist(LEFT_COLLAPSED_KEY, !c);
                return !c;
              });
            }}
            width={leftWidth}
            onResizeStart={handleResizeStart("left")}
            floating
            footer={<PaperLeftFooter />}
            style={panelStyle}
          >
            <PaperLeftPanel />
          </SidePanel>

          <SidePanel
            side="right"
            title={rightMode === "settings" ? "Settings" : "Inspector"}
            icon={<ScanSearch size={12} strokeWidth={1.5} />}
            isCollapsed={rightCollapsed}
            onToggleCollapse={() => {
              setRightCollapsed((c) => {
                writePersist(RIGHT_COLLAPSED_KEY, !c);
                return !c;
              });
            }}
            width={rightWidth}
            onResizeStart={handleResizeStart("right")}
            floating
            style={panelStyle}
          >
            {rightContent}
          </SidePanel>

          <StatusBar
            status={
              filesError
                ? { label: "API", color: "amber", title: filesError }
                : { label: "MAP", color: "emerald", title: "Paper map canvas" }
            }
            left={statusLeft}
            viewport={{
              pan: view.pan,
              zoom: view.scale,
              canvasSize: {
                w: Math.round(view.viewportSize.w),
                h: Math.round(view.viewportSize.h),
              },
            }}
          />

          <CommandPalette
            isOpen={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            commands={allCommands}
          />
        </>
      }
    >
      <PaperWorld />
    </Frame>
  );
}

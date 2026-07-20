import {
  createElement,
  useEffect,
  useMemo,
  useRef,
  type FC,
} from "react";
import {
  ArrowLeft,
  ScanSearch,
  Settings,
  Workflow,
} from "lucide-react";
import type { HudsonApp } from "hudsonkit";
import { useAppShellSidePanels } from "hudsonkit/app-shell";
import {
  StudioFlowsProvider,
  StudioFlowsWorld,
  StudioFlowsLeftPanel,
  StudioFlowsLeftFooter,
  StudioFlowsInspector,
  StudioFlowsSettings,
  STUDIO_FLOWS_MAX_SCALE,
  STUDIO_FLOWS_MIN_SCALE,
  useStudioFlowsCommands,
  useStudioFlowsState,
} from "@hudsonkit/paper/host";
import "@hudsonkit/paper/host/styles.css";
import { navigate } from "../router";

const FlowsProvider: FC<{ children: React.ReactNode }> = ({ children }) => (
  <StudioFlowsProvider>{children}</StudioFlowsProvider>
);

function selectionKey(
  selection: ReturnType<typeof useStudioFlowsState>["selection"],
  pageId: string | null,
) {
  if (!selection) return pageId ?? "";
  if (selection.kind === "page") return `page:${selection.pageId}`;
  if (selection.kind === "region") {
    return `region:${selection.pageId}:${selection.regionId}`;
  }
  return `node:${selection.pageId}:${selection.nodeId}`;
}

function FlowsShellBridge() {
  const panels = useAppShellSidePanels();
  const { pageId, selection, setRightMode } = useStudioFlowsState();
  const activeSelection = selectionKey(selection, pageId);
  const previousSelection = useRef(activeSelection);

  useEffect(() => {
    if (!activeSelection || activeSelection === previousSelection.current) return;
    previousSelection.current = activeSelection;
    setRightMode("inspector");
    panels.right.setCollapsed(false);
  }, [activeSelection, panels.right, setRightMode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key !== ",") return;
      event.preventDefault();
      setRightMode("settings");
      panels.right.setCollapsed(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [panels.right, setRightMode]);

  return null;
}

function FlowsCanvas() {
  const { view, handlePan, handleZoom } = useStudioFlowsState();
  const scaleRef = useRef(view.scale);

  useEffect(() => {
    scaleRef.current = view.scale;
  }, [view.scale]);

  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest?.(
          "input, textarea, select, [data-no-canvas-wheel], [data-frame-panel]",
        )
      ) {
        return;
      }
      if (event.ctrlKey || event.metaKey) return;

      event.preventDefault();
      const scale = scaleRef.current;
      if (event.shiftKey) {
        const dx = (-event.deltaY || -event.deltaX) / scale;
        handlePan({ x: dx, y: 0 });
        return;
      }
      if (event.altKey) {
        handlePan({ x: 0, y: -event.deltaY / scale });
        return;
      }

      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 800 : 1;
      const next = Math.min(
        STUDIO_FLOWS_MAX_SCALE,
        Math.max(
          STUDIO_FLOWS_MIN_SCALE,
          scale - event.deltaY * unit * 0.0018,
        ),
      );
      if (next !== scale) {
        scaleRef.current = next;
        handleZoom(next);
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [handlePan, handleZoom]);

  return (
    <>
      <FlowsShellBridge />
      <StudioFlowsWorld />
    </>
  );
}

function FlowsInspector() {
  const { rightMode } = useStudioFlowsState();
  return rightMode === "settings" ? (
    <StudioFlowsSettings />
  ) : (
    <StudioFlowsInspector />
  );
}

function FlowsNavCenter() {
  const { view, selection } = useStudioFlowsState();
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
      {region ? `${focus || "Flow"} · ${region}` : focus || "Flow map"}
    </span>
  );
}

function FlowsNavActions() {
  const panels = useAppShellSidePanels();
  const { inspectMode, setInspectMode, rightMode, setRightMode } =
    useStudioFlowsState();

  const openRight = (mode: "inspector" | "settings") => {
    setRightMode(mode);
    panels.right.setCollapsed(false);
  };

  return (
    <div className="pointer-events-auto flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => navigate("/")}
        className="rounded border border-transparent p-1.5 text-foreground/70 transition-colors hover:border-border hover:bg-muted hover:text-foreground"
        title="Back to Studio catalog"
        aria-label="Back to Studio catalog"
      >
        <ArrowLeft size={13} strokeWidth={1.5} />
      </button>
      <button
        type="button"
        onClick={() => setInspectMode(!inspectMode)}
        className={`rounded border px-1.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] transition-colors ${
          inspectMode
            ? "border-accent/30 bg-accent/10 text-foreground"
            : "border-transparent text-foreground/70 hover:border-border hover:bg-muted hover:text-foreground"
        }`}
        title="Pick regions on the active screen"
        aria-label="Toggle inspect pick mode"
        aria-pressed={inspectMode}
      >
        Pick
      </button>
      <button
        type="button"
        onClick={() => openRight("inspector")}
        className={`rounded border p-1.5 transition-colors ${
          !panels.right.isCollapsed && rightMode === "inspector"
            ? "border-accent/30 bg-accent/10 text-foreground"
            : "border-transparent text-foreground/70 hover:border-border hover:bg-muted hover:text-foreground"
        }`}
        title="Inspector (Cmd+])"
        aria-label="Open inspector"
      >
        <ScanSearch size={13} strokeWidth={1.5} />
      </button>
      <button
        type="button"
        onClick={() => openRight("settings")}
        className={`rounded border p-1.5 transition-colors ${
          !panels.right.isCollapsed && rightMode === "settings"
            ? "border-accent/30 bg-accent/10 text-foreground"
            : "border-transparent text-foreground/70 hover:border-border hover:bg-muted hover:text-foreground"
        }`}
        title="Flow settings (Cmd+,)"
        aria-label="Open Flow settings"
      >
        <Settings size={13} strokeWidth={1.5} />
      </button>
    </div>
  );
}

function FlowsRightHeaderActions() {
  const { rightMode, setRightMode } = useStudioFlowsState();
  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => setRightMode("inspector")}
        className={`rounded p-1 transition-colors ${
          rightMode === "inspector"
            ? "bg-accent/10 text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
        title="Inspector"
      >
        <ScanSearch size={12} />
      </button>
      <button
        type="button"
        onClick={() => setRightMode("settings")}
        className={`rounded p-1 transition-colors ${
          rightMode === "settings"
            ? "bg-accent/10 text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
        title="Flow settings"
      >
        <Settings size={12} />
      </button>
    </div>
  );
}

function useFlowsViewport() {
  const {
    view,
    settings,
    handlePan,
    handleZoom,
    setViewportSize,
  } = useStudioFlowsState();

  return useMemo(
    () => ({
      pan: view.pan,
      zoom: view.scale,
      canvasSize: {
        w: Math.round(view.viewportSize.w),
        h: Math.round(view.viewportSize.h),
      },
      onPan: handlePan,
      onZoom: handleZoom,
      onViewportChange: ({ width, height }: { width: number; height: number }) =>
        setViewportSize({ w: width, h: height }),
      gridOpacity: settings.gridOpacity,
      zoomSensitivity: 1.2,
    }),
    [handlePan, handleZoom, setViewportSize, settings.gridOpacity, view],
  );
}

function FlowsStatusLeft() {
  const { view } = useStudioFlowsState();
  return (
    <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
      {view.mapName ?? "Studio Flows"} · {view.journeyCount} journeys · {view.pageCount} screens
    </span>
  );
}

function FlowsStatusRight() {
  const { inspectMode } = useStudioFlowsState();
  return (
    <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
      {inspectMode ? "Pick on" : "Navigate"}
    </span>
  );
}

export const flowsApp: HudsonApp = {
  id: "hudson-studio-flows",
  name: "Studio Flows",
  description: "Spatial product flows, live screens, inspection, and discussion.",
  mode: "canvas",
  icon: createElement(Workflow, { size: 13, strokeWidth: 1.5 }),
  leftPanel: {
    title: "Flows",
    icon: createElement(Workflow, { size: 12, strokeWidth: 1.5 }),
  },
  rightPanel: {
    title: "Flow tools",
    icon: createElement(ScanSearch, { size: 12, strokeWidth: 1.5 }),
    headerActions: FlowsRightHeaderActions,
  },
  layout: {
    leftWidth: 280,
    rightWidth: 360,
    left: { min: 220, max: 400 },
    right: { min: 260, max: 460 },
  },
  Provider: FlowsProvider,
  slots: {
    Content: FlowsCanvas,
    LeftPanel: StudioFlowsLeftPanel,
    LeftFooter: StudioFlowsLeftFooter,
    Inspector: FlowsInspector,
  },
  hooks: {
    useCommands: useStudioFlowsCommands,
    useStatus: () => {
      const { filesError } = useStudioFlowsState();
      return filesError
        ? { label: "API", color: "amber", title: filesError }
        : { label: "FLOW", color: "emerald", title: "Studio Flows canvas" };
    },
    useStatusLeft: () => createElement(FlowsStatusLeft),
    useStatusRight: () => createElement(FlowsStatusRight),
    useViewport: useFlowsViewport,
    useNavCenter: () => createElement(FlowsNavCenter),
    useNavActions: () => createElement(FlowsNavActions),
  },
};

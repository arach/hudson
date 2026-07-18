/**
 * Paper → HudsonKit web canvas.
 *
 * Loads a journey map from the local Hudson Paper API and places every page
 * as a card on the real HudsonKit Canvas (dot grid + pan + ZoomControls).
 * Same host pattern as the canvas-terminals exhibit.
 *
 * Deep-link: /exhibits/paper?file=<fileId>&page=<pageId>
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Canvas } from "hudsonkit/canvas";
import { ZoomControls } from "hudsonkit/chrome";
import {
  HudBadge,
  HudButton,
  HudCheckbox,
  HudInput,
  HudListItem,
  HudPanelSection,
  HudTextarea,
  HudToolbar,
} from "hudsonkit/primitives";
import {
  CompRenderer,
  type CompNode,
  type PaperTokens,
} from "@hudsonkit/paper/render";

const PAPER_API =
  (import.meta as ImportMeta & { env?: { VITE_PAPER_API?: string } }).env
    ?.VITE_PAPER_API ?? "http://127.0.0.1:29980";

const MIN_SCALE = 0.12;
const MAX_SCALE = 1.5;

type FileListItem = {
  id: string;
  name: string;
  pageCount: number;
  updatedAt: string;
};

type CanvasPage = {
  id: string;
  name: string;
  journeyId: string | null;
  journeyName: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  root: CompNode;
};

type CanvasPayload = {
  fileId: string;
  fileName: string;
  tokens: PaperTokens;
  journeys: { id: string; name: string; y: number; pageIds: string[] }[];
  pages: CanvasPage[];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  };
};

function readQuery(): { file?: string; page?: string } {
  if (typeof window === "undefined") return {};
  const q = new URLSearchParams(window.location.search);
  return {
    file: q.get("file") ?? undefined,
    page: q.get("page") ?? undefined,
  };
}

function writeQuery(file?: string, page?: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (file) url.searchParams.set("file", file);
  else url.searchParams.delete("file");
  if (page) url.searchParams.set("page", page);
  else url.searchParams.delete("page");
  window.history.replaceState({}, "", url.toString());
}

/** Map CompNode Hud* props onto real hudsonkit primitives. */
function hudsonkitComponents(): NonNullable<
  Parameters<typeof CompRenderer>[0]["components"]
> {
  return {
    HudButton: (props) => (
      <HudButton
        tone={(props.tone as "neutral" | "accent" | undefined) ?? "neutral"}
        variant={(props.variant as "solid" | "soft" | "ghost" | undefined) ?? "solid"}
        density={(props.density as "default" | "compact" | undefined) ?? "default"}
        disabled={Boolean(props.disabled)}
      >
        {String(props.label ?? props.text ?? "Button")}
      </HudButton>
    ),
    HudBadge: (props) => (
      <HudBadge
        tone={(props.tone as "neutral" | "accent" | undefined) ?? "neutral"}
        density={(props.density as "default" | "compact" | undefined) ?? "compact"}
        dot={Boolean(props.dot)}
      >
        {String(props.label ?? props.text ?? "Badge")}
      </HudBadge>
    ),
    HudInput: (props) => (
      <HudInput
        defaultValue={String(props.value ?? "")}
        placeholder={String(props.placeholder ?? "")}
        density={(props.density as "default" | "compact" | undefined) ?? "default"}
        readOnly
      />
    ),
    HudTextarea: (props) => (
      <HudTextarea
        defaultValue={String(props.value ?? "")}
        placeholder={String(props.placeholder ?? "")}
        rows={Number(props.rows) || 3}
        density="default"
        readOnly
      />
    ),
    HudPanelSection: ({ children, ...props }) => (
      <HudPanelSection title={String(props.title ?? "Section")} defaultOpen>
        {children as ReactNode}
      </HudPanelSection>
    ),
    HudListItem: (props) => (
      <HudListItem
        description={
          props.description != null ? String(props.description) : undefined
        }
      >
        {String(props.title ?? props.label ?? props.text ?? "")}
      </HudListItem>
    ),
    HudCheckbox: (props) => (
      <HudCheckbox
        checked={Boolean(props.checked)}
        label={String(props.label ?? "")}
        onChange={() => {}}
      />
    ),
    HudToolbar: ({ children }) => <HudToolbar>{children as ReactNode}</HudToolbar>,
  };
}

export function PaperPagesExhibit() {
  const initial = useMemo(() => readQuery(), []);
  const containerRef = useRef<HTMLDivElement>(null);

  const [files, setFiles] = useState<FileListItem[]>([]);
  const [fileId, setFileId] = useState<string | undefined>(initial.file);
  const [payload, setPayload] = useState<CanvasPayload | null>(null);
  const [pageId, setPageId] = useState<string | undefined>(initial.page);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(0.28);
  const [zTop, setZTop] = useState(1);
  const [zByPage, setZByPage] = useState<Record<string, number>>({});

  const hudComponents = useMemo(() => hudsonkitComponents(), []);

  const refreshFiles = useCallback(async () => {
    try {
      const res = await fetch(`${PAPER_API}/api/files`);
      if (!res.ok) throw new Error(`Paper API ${res.status}`);
      const data = (await res.json()) as { files: FileListItem[] };
      setFiles(data.files ?? []);
      setError(null);
      if (!fileId && data.files?.length) setFileId(data.files[0]!.id);
    } catch (e) {
      setError(
        e instanceof Error
          ? `${e.message} — is hpaper serve running on :29980?`
          : "Paper API unreachable",
      );
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  useEffect(() => {
    void refreshFiles();
  }, [refreshFiles]);

  // Load full canvas map (all page trees + world coords)
  useEffect(() => {
    if (!fileId) {
      setPayload(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${PAPER_API}/api/files/${encodeURIComponent(fileId)}/canvas`,
        );
        if (!res.ok) throw new Error(`canvas ${res.status}`);
        const data = (await res.json()) as CanvasPayload;
        if (cancelled) return;
        setPayload(data);
        setError(null);

        const hasPage = pageId && data.pages.some((p) => p.id === pageId);
        const focusId = hasPage
          ? pageId!
          : (data.journeys[0] && data.pages.find((p) => p.journeyId === data.journeys[0]!.id)?.id) ||
            data.pages[0]?.id;
        if (focusId) setPageId(focusId);

        // Center the map in the canvas world (Canvas origin is viewport center)
        const b = data.bounds;
        setPan({ x: -b.centerX, y: -b.centerY });
        // Fit roughly to viewport width if we can guess
        const fit =
          typeof window !== "undefined"
            ? Math.min(
                0.55,
                Math.max(
                  MIN_SCALE,
                  (window.innerWidth * 0.72) / Math.max(b.width, 1),
                ),
              )
            : 0.28;
        setScale(fit);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load canvas");
          setPayload(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // only re-load when file changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId]);

  useEffect(() => {
    if (fileId && pageId) writeQuery(fileId, pageId);
  }, [fileId, pageId]);

  const handlePan = useCallback((delta: { x: number; y: number }) => {
    setPan((p) => ({ x: p.x + delta.x, y: p.y + delta.y }));
  }, []);

  const handleZoom = useCallback((next: number) => {
    setScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, next)));
  }, []);

  const selectPage = useCallback((id: string) => {
    setPageId(id);
    setZTop((z) => {
      const next = z + 1;
      setZByPage((m) => ({ ...m, [id]: next }));
      return next;
    });
  }, []);

  const focusPage = useCallback(
    (id: string) => {
      const page = payload?.pages.find((p) => p.id === id);
      if (!page) return;
      selectPage(id);
      setPan({
        x: -(page.x + page.width / 2),
        y: -(page.y + page.height / 2),
      });
      setScale((s) => Math.max(s, 0.45));
    },
    [payload, selectPage],
  );

  const tokenStyle = useMemo(() => {
    if (!payload?.tokens) return {} as CSSProperties;
    return Object.fromEntries(Object.entries(payload.tokens)) as CSSProperties;
  }, [payload?.tokens]);

  const selected = payload?.pages.find((p) => p.id === pageId) ?? null;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-background text-foreground"
    >
      {/* HudsonKit canvas — dot grid + pan */}
      <Canvas
        panOffset={pan}
        scale={scale}
        onPan={handlePan}
        showGuides={false}
        gridOpacity={1}
      />

      {/* World layer (same composition as canvas-terminals) */}
      <div
        className="absolute z-10 pointer-events-none"
        style={{ left: "50%", top: "50%", zoom: scale }}
      >
        <div style={{ position: "absolute", left: pan.x, top: pan.y }}>
          {/* Journey row labels */}
          {payload?.journeys.map((j) => (
            <div
              key={`label-${j.id}`}
              className="pointer-events-none absolute font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground"
              style={{
                left: (payload.bounds.minX ?? 0) - 48,
                top: j.y + 12,
                transform: "translateX(-100%)",
                whiteSpace: "nowrap",
              }}
            >
              {j.name}
            </div>
          ))}

          {payload?.pages.map((page) => {
            const active = page.id === pageId;
            const z = zByPage[page.id] ?? 1;
            return (
              <div
                key={page.id}
                data-canvas-card
                data-page-id={page.id}
                className="pointer-events-auto absolute overflow-hidden shadow-[0_18px_50px_rgba(0,0,0,0.28)]"
                style={{
                  left: page.x,
                  top: page.y,
                  width: page.width,
                  height: page.height,
                  zIndex: active ? zTop + 1 : z,
                  ...tokenStyle,
                  background: "var(--raised, #f8f6f1)",
                  outline: active
                    ? "2px solid color-mix(in srgb, oklch(var(--accent)) 70%, transparent)"
                    : "1px solid color-mix(in srgb, var(--foreground) 12%, transparent)",
                  outlineOffset: active ? 4 : 0,
                  display: "flex",
                  flexDirection: "column",
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  selectPage(page.id);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  focusPage(page.id);
                }}
              >
                {/* Card chrome — page identity over the CompNode tree */}
                <div
                  className="flex shrink-0 items-center justify-between border-b px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em]"
                  style={{
                    borderColor: "color-mix(in srgb, var(--ink, #211f1c) 12%, transparent)",
                    background: "color-mix(in srgb, var(--raised, #f8f6f1) 92%, black)",
                    color: "var(--faint, #8c897f)",
                  }}
                >
                  <span>
                    {[page.journeyName, page.name].filter(Boolean).join(" · ")}
                  </span>
                  <span>
                    {page.width}×{page.height}
                  </span>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden">
                  <CompRenderer node={page.root} components={hudComponents} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* HUD toolbar */}
      <div className="absolute left-0 right-0 top-0 z-30 flex items-center justify-between gap-3 border-b border-studio-edge bg-studio-canvas-alt/90 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-studio-ink-faint backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 text-studio-ink">· paper canvas</span>
          <select
            className="max-w-[240px] truncate rounded border border-studio-edge bg-studio-canvas px-2 py-1 text-[11px] normal-case tracking-normal text-studio-ink"
            value={fileId ?? ""}
            onChange={(e) => {
              setFileId(e.target.value || undefined);
              setPageId(undefined);
            }}
          >
            {!files.length ? <option value="">No maps</option> : null}
            {files.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.pageCount})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void refreshFiles()}
            className="rounded border border-studio-edge px-2 py-1 hover:bg-studio-chip-bg"
          >
            Refresh
          </button>
        </div>
        <div className="flex items-center gap-3">
          {selected ? (
            <span className="hidden truncate text-studio-ink sm:inline">
              {selected.journeyName} · {selected.name}
            </span>
          ) : null}
          <span>{payload?.pages.length ?? 0} pages</span>
          <span>{Math.round(scale * 100)}%</span>
          {loading ? <span>loading…</span> : null}
        </div>
      </div>

      {/* Journey rail — pick a page without hunting the canvas */}
      <aside className="absolute bottom-5 left-4 top-12 z-30 flex w-[220px] flex-col overflow-hidden rounded-md border border-studio-edge bg-studio-canvas-alt/95 shadow-lg backdrop-blur">
        <div className="border-b border-studio-edge px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-studio-ink-faint">
          Journeys
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
          {payload?.journeys.map((j) => (
            <div key={j.id} className="mb-2">
              <div className="px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-studio-ink-faint">
                {j.name}
              </div>
              <ul className="space-y-0.5">
                {j.pageIds.map((id) => {
                  const p = payload.pages.find((x) => x.id === id);
                  if (!p) return null;
                  const active = p.id === pageId;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => focusPage(p.id)}
                        className={`w-full rounded px-2 py-1.5 text-left text-[12px] ${
                          active
                            ? "bg-studio-chip-bg font-medium text-studio-ink-strong"
                            : "text-studio-ink hover:bg-studio-chip-bg/60"
                        }`}
                      >
                        {p.name}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {!payload && !error ? (
            <p className="px-2 py-3 text-[12px] text-studio-ink-faint">
              {loading ? "Loading map…" : "Select a map"}
            </p>
          ) : null}
        </div>
        {error ? (
          <div className="border-t border-studio-edge px-3 py-2 text-[11px] leading-snug text-amber-600">
            {error}
          </div>
        ) : (
          <div className="border-t border-studio-edge px-3 py-2 text-[10px] leading-snug text-studio-ink-faint">
            Drag empty canvas to pan · wheel / controls to zoom · double-click a
            page to focus
          </div>
        )}
      </aside>

      <div className="absolute bottom-5 right-5 z-30">
        <ZoomControls scale={scale} onZoom={handleZoom} />
      </div>
    </div>
  );
}

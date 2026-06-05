'use client';

import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
  type ReactElement,
} from 'react';
import { traceFromImage } from './lib/bezier-fit';
import { createAppApiClient, createHudsonId, sounds } from 'hudsonkit';
import { useShaperAI, type AiActivityEntry } from './useShaperAI';
import type {
  BezierData,
  BezierSegment,
  NamedAnchor,
  AnchorsData,
  SelectedPoint,
  Tool,
  ProjectImage,
  ImageWarning,
  RecentImage,
  TraceOptions,
  TraceInfo,
  ProjectMeta,
} from './types';
import {
  DEFAULT_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
  MAX_HISTORY,
  MAX_RECENT,
  DEFAULT_TRACE_OPTIONS,
} from './types';

const shaperApi = createAppApiClient({ id: 'shaper', backend: {} });

// ---------------------------------------------------------------------------
// Context value shape
// ---------------------------------------------------------------------------
export interface ShaperContextValue {
  // Canvas/Viewport
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  pan: { x: number; y: number };
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  isPanning: boolean;
  setIsPanning: React.Dispatch<React.SetStateAction<boolean>>;
  panStart: { x: number; y: number };
  setPanStart: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  dragStart: { x: number; y: number } | null;
  setDragStart: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
  mousePosRef: React.RefObject<{ screen: { x: number; y: number }; canvas: { x: number; y: number } } | null>;
  clearMousePos: () => void;

  // Tools
  tool: Tool;
  switchTool: (t: Tool) => void;
  penStrokeIndex: number | null;
  setPenStrokeIndex: React.Dispatch<React.SetStateAction<number | null>>;
  penLastPoint: [number, number] | null;
  setPenLastPoint: React.Dispatch<React.SetStateAction<[number, number] | null>>;
  penPreviewPos: [number, number] | null;
  setPenPreviewPos: React.Dispatch<React.SetStateAction<[number, number] | null>>;
  finishPenStroke: () => void;

  // Data
  bezierData: BezierData | null;
  setBezierData: React.Dispatch<React.SetStateAction<BezierData | null>>;
  anchorsData: AnchorsData | null;
  setAnchorsData: React.Dispatch<React.SetStateAction<AnchorsData | null>>;
  smoothStates: Record<string, boolean>;
  setSmoothStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  pathColor: string;
  setPathColor: React.Dispatch<React.SetStateAction<string>>;

  // Selection
  selectedPoint: SelectedPoint | null;
  setSelectedPoint: React.Dispatch<React.SetStateAction<SelectedPoint | null>>;
  isDraggingPoint: boolean;
  setIsDraggingPoint: React.Dispatch<React.SetStateAction<boolean>>;

  // Visibility
  showOriginal: boolean; setShowOriginal: React.Dispatch<React.SetStateAction<boolean>>;
  showSilhouette: boolean; setShowSilhouette: React.Dispatch<React.SetStateAction<boolean>>;
  showPath: boolean; setShowPath: React.Dispatch<React.SetStateAction<boolean>>;
  showHandles: boolean; setShowHandles: React.Dispatch<React.SetStateAction<boolean>>;
  showAnchors: boolean; setShowAnchors: React.Dispatch<React.SetStateAction<boolean>>;
  showLabels: boolean; setShowLabels: React.Dispatch<React.SetStateAction<boolean>>;
  showGrid: boolean; setShowGrid: React.Dispatch<React.SetStateAction<boolean>>;
  showGuides: boolean; setShowGuides: React.Dispatch<React.SetStateAction<boolean>>;

  // Fill
  fillEnabled: boolean; setFillEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  fillPattern: 'solid' | 'dither' | 'halftone' | 'noise';
  setFillPattern: React.Dispatch<React.SetStateAction<'solid' | 'dither' | 'halftone' | 'noise'>>;
  fillWeights: Record<string, number>;
  setFillWeights: React.Dispatch<React.SetStateAction<Record<string, number>>>;

  // Animation
  animationModeEnabled: boolean; setAnimationModeEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  isAnimating: boolean; setIsAnimating: React.Dispatch<React.SetStateAction<boolean>>;
  animationProgress: number; setAnimationProgress: React.Dispatch<React.SetStateAction<number>>;
  animationSpeed: number; setAnimationSpeed: React.Dispatch<React.SetStateAction<number>>;
  showAnimationHandles: boolean; setShowAnimationHandles: React.Dispatch<React.SetStateAction<boolean>>;
  animationEasing: boolean; setAnimationEasing: React.Dispatch<React.SetStateAction<boolean>>;
  showAnimationAngles: boolean; setShowAnimationAngles: React.Dispatch<React.SetStateAction<boolean>>;
  handleOpacity: number; setHandleOpacity: React.Dispatch<React.SetStateAction<number>>;
  angleArcRadius: number; setAngleArcRadius: React.Dispatch<React.SetStateAction<number>>;
  showAngleReference: boolean; setShowAngleReference: React.Dispatch<React.SetStateAction<boolean>>;

  // UI
  openSections: Record<string, boolean>;
  toggleSection: (id: string) => void;
  searchQuery: string; setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  showActionsMenu: boolean; setShowActionsMenu: React.Dispatch<React.SetStateAction<boolean>>;
  anchorListHeight: number; setAnchorListHeight: React.Dispatch<React.SetStateAction<number>>;
  isResizingAnchors: boolean; setIsResizingAnchors: React.Dispatch<React.SetStateAction<boolean>>;

  // Project
  projectImage: ProjectImage | null;
  showDropZone: boolean; setShowDropZone: React.Dispatch<React.SetStateAction<boolean>>;
  isInitialLoad: boolean;
  isDragOver: boolean; setIsDragOver: React.Dispatch<React.SetStateAction<boolean>>;
  traceOptions: TraceOptions; setTraceOptions: React.Dispatch<React.SetStateAction<TraceOptions>>;
  traceInfo: TraceInfo | null;
  imageWarnings: ImageWarning[];
  setImageWarnings: React.Dispatch<React.SetStateAction<ImageWarning[]>>;
  recentImages: RecentImage[];
  isTracing: boolean;
  projectId: string | null;
  projectMeta: ProjectMeta | null;

  // Dev
  devTab: 'path' | 'log' | 'info'; setDevTab: React.Dispatch<React.SetStateAction<'path' | 'log' | 'info'>>;
  devLogs: string[]; setDevLogs: React.Dispatch<React.SetStateAction<string[]>>;

  // Refs
  canvasRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;

  // Computed
  connectionMap: Map<string, string[]>;
  strokesPath: string;
  pathLengthEstimate: number;
  revealedHandles: Array<{
    x1: number; y1: number; x2: number; y2: number;
    angle?: number;
    anchorX: number; anchorY: number;
    handleX: number; handleY: number;
    opacity: number;
  }>;
  revealedAnchors: Array<{
    x: number; y: number;
    isSmooth: boolean;
    opacity: number;
  }>;
  handleLines: ReactElement[];
  controlPoints: ReactElement[];
  anchorPoints: ReactElement[];
  anchorLabels: ReactElement[];
  staticAngleLabels: ReactElement[];
  strokeGroups: [string, NamedAnchor[]][];
  strokeSummaries: Array<{
    index: number;
    segments: number;
    name: string | null;
    bbox: { x: number; y: number; width: number; height: number };
    hidden: boolean;
  }>;
  hiddenStrokes: Set<number>;
  toggleStrokeVisibility: (index: number) => void;
  deleteStroke: (index: number) => void;
  focusOnStroke: (index: number) => void;

  // AI
  sendAiMessage: (text: string, label?: string) => void;
  aiStatus: string;
  aiActivity: AiActivityEntry[];
  aiError: string | null;
  clearAiActivity: () => void;
  stopAi: (() => void) | undefined;
  filteredAnchors: NamedAnchor[];
  selectedPointData: { x: number; y: number; strokeIndex: number; segmentIndex: number; pointType: string } | null;
  showEditor: boolean;
  showDropScreen: boolean;
  traceImageSrc: string;
  displayImageSrc: string;

  // Callbacks
  undo: () => void;
  redo: () => void;
  quickSave: () => void;
  downloadJson: () => void;
  deleteSelectedPoint: () => void;
  resetZoom: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  handleWheel: (e: WheelEvent) => void;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: () => void;
  getCanvasCoords: (e: React.MouseEvent) => { x: number; y: number };
  findNearestPoint: (x: number, y: number, threshold?: number) => SelectedPoint | null;
  nudgeSelectedPoint: (dx: number, dy: number, alt: boolean, shift: boolean) => void;
  handleRetrace: () => Promise<void>;
  handlePointMouseDown: (e: React.MouseEvent) => void;
  handleCanvasMouseMove: (e: React.MouseEvent) => void;
  handleCanvasMouseUp: () => void;
  updatePointCoord: (axis: 'x' | 'y', value: number) => void;
  selectAnchorByName: (anchor: NamedAnchor) => void;
  focusOnPoint: (x: number, y: number) => void;
  selectAndFocusAnchor: (anchor: NamedAnchor) => void;
  focusOnSelected: () => void;
  handleAnchorResizeStart: (e: React.MouseEvent) => void;
  handleMinimapClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  newProject: () => void;
  processImageFile: (file: File) => Promise<void>;
  selectRecentImage: (recent: RecentImage) => void;
  startProjectFromImage: (image: ProjectImage) => Promise<void>;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleGlobalDragOver: (e: React.DragEvent) => void;
  handleGlobalDrop: (e: React.DragEvent) => void;
}

const ShaperContext = createContext<ShaperContextValue | null>(null);

export function useShaper() {
  const ctx = useContext(ShaperContext);
  if (!ctx) throw new Error('useShaper must be used inside ShaperProvider');
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
function isEditableKeyboardTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return Boolean(el.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""], [role="textbox"]'));
}

export function ShaperProvider({
  children,
  visible = true,
  focused = true,
}: {
  children: ReactNode;
  visible?: boolean;
  focused?: boolean;
}) {
  const visibleRef = useRef(visible);
  const focusedRef = useRef(focused);

  useEffect(() => {
    visibleRef.current = visible;
    focusedRef.current = focused;
  }, [visible, focused]);

  // ── Tools ──
  const [tool, setTool] = useState<Tool>('select');
  // ── Canvas/Viewport ──
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const panStartRef = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const mousePosRef = useRef<{ screen: { x: number; y: number }; canvas: { x: number; y: number } } | null>(null);
  const clearMousePos = useCallback(() => {
    mousePosRef.current = null;
    // Hide guide elements
    const container = containerRef.current;
    if (!container) return;
    const v = container.querySelector('[data-shaper-guide-v]') as HTMLElement | null;
    const h = container.querySelector('[data-shaper-guide-h]') as HTMLElement | null;
    const l = container.querySelector('[data-shaper-guide-label]') as HTMLElement | null;
    if (v) v.style.display = 'none';
    if (h) h.style.display = 'none';
    if (l) l.style.display = 'none';
  }, []);
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null);
  const [isDraggingPoint, setIsDraggingPoint] = useState(false);
  const [pathColor, setPathColor] = useState('#ff4d4d');
  const [penStrokeIndex, setPenStrokeIndex] = useState<number | null>(null);
  const [penLastPoint, setPenLastPoint] = useState<[number, number] | null>(null);
  const [penPreviewPos, setPenPreviewPos] = useState<[number, number] | null>(null);

  // ── Visibility ──
  const [showOriginal, setShowOriginal] = useState(true);
  const [showSilhouette, setShowSilhouette] = useState(false);
  const [showPath, setShowPath] = useState(true);
  const [showHandles, setShowHandles] = useState(true);
  const [showAnchors, setShowAnchors] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [showGuides, setShowGuides] = useState(true);

  // ── Data ──
  const [bezierData, setBezierData] = useState<BezierData | null>(null);
  const [anchorsData, setAnchorsData] = useState<AnchorsData | null>(null);
  const [smoothStates, setSmoothStates] = useState<Record<string, boolean>>({});
  const [hiddenStrokes, setHiddenStrokes] = useState<Set<number>>(() => new Set());
  const [fillEnabled, setFillEnabled] = useState(false);
  const [fillPattern, setFillPattern] = useState<'solid' | 'dither' | 'halftone' | 'noise'>('solid');
  const [fillWeights, setFillWeights] = useState<Record<string, number>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [traceOptions, setTraceOptions] = useState<TraceOptions>(DEFAULT_TRACE_OPTIONS);
  const [traceInfo, setTraceInfo] = useState<TraceInfo | null>(null);
  const [isTracing, setIsTracing] = useState(false);

  // ── Dev ──
  const [devTab, setDevTab] = useState<'path' | 'log' | 'info'>('path');
  const [devLogs, setDevLogs] = useState<string[]>([]);

  // ── UI ──
  const [searchQuery, setSearchQuery] = useState('');
  const [anchorListHeight, setAnchorListHeight] = useState(192);
  const [isResizingAnchors, setIsResizingAnchors] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    visibility: true, strokes: true, minimap: true,
    selected: true, anchors: true, fill: true, animation: true, appearance: true, trace: true, info: true,
    export: true,
  });
  const [showActionsMenu, setShowActionsMenu] = useState(false);

  // ── Animation ──
  const [animationModeEnabled, setAnimationModeEnabled] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [animationSpeed, setAnimationSpeed] = useState(2);
  const [showAnimationHandles, setShowAnimationHandles] = useState(false);
  const [animationEasing, setAnimationEasing] = useState(true);
  const [showAnimationAngles, setShowAnimationAngles] = useState(false);
  const [handleOpacity, setHandleOpacity] = useState(0.35);
  const [angleArcRadius, setAngleArcRadius] = useState(20);
  const [showAngleReference, setShowAngleReference] = useState(true);

  // ── Project ──
  const [projectImage, setProjectImage] = useState<ProjectImage | null>(null);
  const [showDropZone, setShowDropZone] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const [imageWarnings, setImageWarnings] = useState<ImageWarning[]>([]);
  const [recentImages, setRecentImages] = useState<RecentImage[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectMeta, setProjectMeta] = useState<ProjectMeta | null>(null);

  // ── Refs ──
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const isUndoRedoRef = useRef(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const toggleSection = useCallback((id: string) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // ── Image processing ──
  const processImageFile = useCallback(async (file: File) => {
    const warnings: ImageWarning[] = [];
    const validTypes = ['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setImageWarnings([{ message: `Unsupported format: ${file.type}. Use PNG, SVG, JPEG, or WebP.`, type: 'warn' }]);
      return;
    }
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = url;
      });
      const { naturalWidth: w, naturalHeight: h } = img;
      if (w !== h) warnings.push({ message: `Image is ${w}x${h} — not square. It will be stretched to fit the canvas.`, type: 'warn' });
      if (w < 256 || h < 256) warnings.push({ message: `Image is small (${w}x${h}). Results may be rough. 512x512 or larger recommended.`, type: 'warn' });
      if (w > 4096 || h > 4096) warnings.push({ message: `Image is large (${w}x${h}). It will be downscaled for tracing.`, type: 'info' });
      if (file.type === 'image/jpeg') warnings.push({ message: 'JPEG has no alpha channel — shapes will be detected by luminance (Otsu threshold).', type: 'info' });
      setImageWarnings(warnings);
      setProjectImage({ url, name: file.name, width: w, height: h });
      const thumbSize = 80;
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = thumbSize;
      thumbCanvas.height = thumbSize;
      const thumbCtx = thumbCanvas.getContext('2d')!;
      thumbCtx.drawImage(img, 0, 0, thumbSize, thumbSize);
      const thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.6);
      setRecentImages((prev) => {
        const filtered = prev.filter((r) => r.name !== file.name);
        return [
          { name: file.name, thumbnail, blobUrl: url, width: w, height: h, timestamp: Date.now() },
          ...filtered,
        ].slice(0, MAX_RECENT);
      });
    } catch (err) {
      console.error('Failed to process image:', err);
      setImageWarnings([{ message: `Failed to load image: ${err}`, type: 'warn' }]);
    }
  }, []);

  const selectRecentImage = useCallback((recent: RecentImage) => {
    setImageWarnings([]);
    setProjectImage({ url: recent.blobUrl, name: recent.name, width: recent.width, height: recent.height });
  }, []);

  // Persist active project session to localStorage.
  // Stroke data + visibility are updated separately (see autosave effect below).
  const persistSession = useCallback((image: ProjectImage, dataUrl: string) => {
    try {
      const existing = localStorage.getItem('shaper-session');
      const prior = existing ? JSON.parse(existing) : {};
      localStorage.setItem('shaper-session', JSON.stringify({
        ...prior,
        image: { name: image.name, width: image.width, height: image.height },
        dataUrl,
      }));
    } catch { /* quota exceeded — ignore */ }
  }, []);

  const clearSession = useCallback(() => {
    try { localStorage.removeItem('shaper-session'); } catch { /* storage unavailable */ }
  }, []);

  const startProjectFromImage = useCallback(async (image: ProjectImage) => {
    // Set projectImage state immediately — prevents session restore from overriding
    setProjectImage(image);
    setImageWarnings([]);
    setIsTracing(true);
    try {
      const result = await traceFromImage(image.url, traceOptions);
      if (result.strokes.length > 0 && result.strokes[0].length > 0) {
        setBezierData({ strokes: result.strokes });
        setTraceInfo(result.info);
        setSmoothStates({});
        setHiddenStrokes(new Set());
        setAnchorsData({ anchors: [] });
        historyRef.current = [JSON.stringify({ strokes: result.strokes })];
        historyIndexRef.current = 0;
        setZoom(DEFAULT_ZOOM);
        setPan({ x: 0, y: 0 });
        setSelectedPoint(null);
        setShowDropZone(false);
        setIsInitialLoad(false);
        // Persist image as data URL so it survives refresh
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = image.url;
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = Math.min(img.naturalWidth, 1024);
          c.height = Math.min(img.naturalHeight, 1024);
          c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
          persistSession(image, c.toDataURL('image/png'));
        };
      } else {
        setImageWarnings((prev) => [...prev, { message: 'Trace produced no curves. Try adjusting error tolerance or use a higher-contrast image.', type: 'warn' }]);
      }
    } catch (err) {
      console.error('Trace error:', err);
      setImageWarnings((prev) => [...prev, { message: `Trace failed: ${err}`, type: 'warn' }]);
    } finally {
      setIsTracing(false);
    }
  }, [traceOptions]);

  const newProject = useCallback(() => {
    if (projectImage?.url.startsWith('blob:')) URL.revokeObjectURL(projectImage.url);
    clearSession();
    const id = createHudsonId('project', 24);
    setProjectId(id);
    setProjectMeta({ id, name: 'Untitled', createdAt: Date.now() });
    setProjectImage(null);
    setBezierData(null);
    setAnchorsData(null);
    setSmoothStates({});
    setHiddenStrokes(new Set());
    setSelectedPoint(null);
    setImageWarnings([]);
    setTraceInfo(null);
    setTraceOptions(DEFAULT_TRACE_OPTIONS);
    setShowDropZone(true);
    historyRef.current = [];
    historyIndexRef.current = -1;
  }, [projectImage]);

  // ── Drop handlers ──
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processImageFile(file);
  }, [processImageFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
  }, [processImageFile]);

  const handleGlobalDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleGlobalDrop = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setShowDropZone(true);
      setBezierData(null);
      processImageFile(file);
    }
  }, [processImageFile]);

  // ── Auto-load: restore session or fall back to demo ──
  useEffect(() => {
    if (projectImage) return;
    // Check for a persisted session first
    try {
      const raw = localStorage.getItem('shaper-session');
      if (raw) {
        const session = JSON.parse(raw);
        if (session.dataUrl && session.image) {
          setProjectImage({ url: session.dataUrl, ...session.image });
          // Restore the user's own bezier data; fall back to starter strokes only if
          // the session pre-dates stroke persistence.
          if (session.bezier && Array.isArray(session.bezier.strokes)) {
            setBezierData(session.bezier);
            if (Array.isArray(session.hiddenStrokes)) {
              setHiddenStrokes(new Set(session.hiddenStrokes));
            }
            historyRef.current = [JSON.stringify(session.bezier)];
            historyIndexRef.current = 0;
            setIsInitialLoad(false);
          } else {
            // Legacy session: prompt to retrace via the drop zone.
            setShowDropZone(true);
            setIsInitialLoad(false);
          }
          return;
        }
      }
    } catch { /* corrupted — fall through */ }

    // Default: load the starter demo
    Promise.all([
      fetch('/shaper/starter-bezier.json').then((r) => r.json()),
      fetch('/shaper/starter-anchors.json').then((r) => r.json()),
    ]).then(([bezier, anchors]) => {
      setBezierData(bezier);
      setAnchorsData(anchors);
      historyRef.current = [JSON.stringify(bezier)];
      historyIndexRef.current = 0;
    }).catch(() => {
      setShowDropZone(true);
    }).finally(() => {
      setIsInitialLoad(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Undo history ──
  const pushHistoryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!bezierData || isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }
    if (pushHistoryRef.current) clearTimeout(pushHistoryRef.current);
    pushHistoryRef.current = setTimeout(() => {
      const json = JSON.stringify(bezierData);
      const current = historyRef.current[historyIndexRef.current];
      if (json === current) return;
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
      historyRef.current.push(json);
      if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
      historyIndexRef.current = historyRef.current.length - 1;
    }, 300);
  }, [bezierData]);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current--;
    isUndoRedoRef.current = true;
    setBezierData(JSON.parse(historyRef.current[historyIndexRef.current]));
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current++;
    isUndoRedoRef.current = true;
    setBezierData(JSON.parse(historyRef.current[historyIndexRef.current]));
  }, []);

  // ── Save ──
  const saveToDisk = useCallback(async (data: BezierData, smooth: Record<string, boolean>) => {
    setSaveStatus('saving');
    try {
      const res = await shaperApi.post('save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bezier: data, smooth, projectId }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [projectId]);

  const quickSave = useCallback(() => {
    if (!bezierData) return;
    saveToDisk(bezierData, smoothStates);
  }, [bezierData, smoothStates, saveToDisk]);

  // Auto-save
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadRef = useRef(true);
  useEffect(() => {
    if (!bezierData) return;
    if (initialLoadRef.current) { initialLoadRef.current = false; return; }
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => { saveToDisk(bezierData, smoothStates); }, 2000);
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); };
  }, [bezierData, smoothStates, saveToDisk]);

  // Persist stroke edits into the session so reload restores user work instead of the starter.
  // Only active when the user has their own project loaded.
  useEffect(() => {
    if (!projectImage || !bezierData) return;
    try {
      const raw = localStorage.getItem('shaper-session');
      if (!raw) return;
      const session = JSON.parse(raw);
      session.bezier = bezierData;
      session.hiddenStrokes = Array.from(hiddenStrokes);
      localStorage.setItem('shaper-session', JSON.stringify(session));
    } catch { /* quota or parse error — ignore */ }
  }, [projectImage, bezierData, hiddenStrokes]);

  const downloadJson = useCallback(() => {
    if (!bezierData) return;
    const blob = new Blob([JSON.stringify(bezierData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shaper-bezier.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [bezierData]);

  // ── Delete selected point ──
  const deleteSelectedPoint = useCallback(() => {
    if (!selectedPoint || !bezierData) return;
    const { strokeIndex, segmentIndex, pointType } = selectedPoint;
    setBezierData((prev) => {
      if (!prev) return prev;
      const newData = JSON.parse(JSON.stringify(prev));
      const stroke = newData.strokes[strokeIndex];
      if (!stroke) return prev;
      if (pointType === 'c1') {
        const seg = stroke[segmentIndex];
        seg.c1[0] = (seg.p0[0] * 2 + seg.p3[0]) / 3;
        seg.c1[1] = (seg.p0[1] * 2 + seg.p3[1]) / 3;
        return newData;
      }
      if (pointType === 'c2') {
        const seg = stroke[segmentIndex];
        seg.c2[0] = (seg.p0[0] + seg.p3[0] * 2) / 3;
        seg.c2[1] = (seg.p0[1] + seg.p3[1] * 2) / 3;
        return newData;
      }
      if (stroke.length === 1) {
        newData.strokes.splice(strokeIndex, 1);
      } else if (segmentIndex === 0 && pointType === 'p0') {
        stroke.splice(0, 1);
      } else if (segmentIndex === stroke.length - 1 && pointType === 'p3') {
        stroke.splice(stroke.length - 1, 1);
      } else {
        if (pointType === 'p3' && segmentIndex < stroke.length - 1) {
          const curr = stroke[segmentIndex];
          const next = stroke[segmentIndex + 1];
          const merged = { p0: curr.p0, c1: curr.c1, c2: next.c2, p3: next.p3 };
          stroke.splice(segmentIndex, 2, merged);
        } else if (pointType === 'p0' && segmentIndex > 0) {
          const prev = stroke[segmentIndex - 1];
          const curr = stroke[segmentIndex];
          const merged = { p0: prev.p0, c1: prev.c1, c2: curr.c2, p3: curr.p3 };
          stroke.splice(segmentIndex - 1, 2, merged);
        } else {
          stroke.splice(segmentIndex, 1);
        }
      }
      newData.strokes = newData.strokes.filter((s: unknown[]) => s.length > 0);
      return newData;
    });
    setSelectedPoint(null);
  }, [selectedPoint, bezierData]);

  // ── Pen stroke ──
  const finishPenStroke = useCallback(() => {
    setPenStrokeIndex(null);
    setPenLastPoint(null);
    setPenPreviewPos(null);
    setBezierData((prev) => {
      if (!prev) return prev;
      const filtered = prev.strokes.filter((s) => s.length > 0);
      if (filtered.length === prev.strokes.length) return prev;
      return { strokes: filtered };
    });
  }, []);

  const switchTool = useCallback((t: Tool) => {
    if (tool === 'pen' && t !== 'pen') finishPenStroke();
    setTool(t);
  }, [tool, finishPenStroke]);

  // ── Zoom ──
  const resetZoom = useCallback(() => { setZoom(DEFAULT_ZOOM); setPan({ x: 0, y: 0 }); }, []);
  const zoomIn = useCallback(() => { setZoom((z) => Math.min(MAX_ZOOM, z * 1.2)); }, []);
  const zoomOut = useCallback(() => { setZoom((z) => Math.max(MIN_ZOOM, z / 1.2)); }, []);
  // Called from a native wheel listener attached with { passive: false }
  // (see ShaperContent) — React's synthetic onWheel is passive and can't
  // preventDefault on scroll without a console warning on every event.
  const handleWheel = useCallback((e: WheelEvent) => {
    // Cmd/Ctrl+scroll is handled by Frame for workspace-level zoom — don't double-zoom
    if (e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (tool === 'hand' || e.button === 1 || e.altKey) {
      setIsPanning(true);
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      e.preventDefault();
    }
  }, [tool, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanningRef.current && canvasRef.current) {
      const newX = e.clientX - panStartRef.current.x;
      const newY = e.clientY - panStartRef.current.y;
      canvasRef.current.style.transform = `translate(${newX}px, ${newY}px) scale(${zoom})`;
    }
  }, [zoom]);

  const handleMouseUp = useCallback(() => {
    if (isPanningRef.current && canvasRef.current) {
      const style = canvasRef.current.style.transform;
      const match = style.match(/translate\((.+?)px,\s*(.+?)px\)/);
      if (match) setPan({ x: parseFloat(match[1]), y: parseFloat(match[2]) });
    }
    setIsPanning(false);
    isPanningRef.current = false;
  }, []);

  // ── Anchor resize ──
  const handleAnchorResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingAnchors(true);
    const startHeight = anchorListHeight;
    const startY = e.clientY;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientY - startY;
      const newHeight = Math.max(100, Math.min(600, startHeight + delta));
      const el = document.querySelector('[data-anchor-list]') as HTMLElement | null;
      if (el) el.style.height = `${newHeight}px`;
    };

    const onMouseUp = (ev: MouseEvent) => {
      const delta = ev.clientY - startY;
      setAnchorListHeight(Math.max(100, Math.min(600, startHeight + delta)));
      setIsResizingAnchors(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [anchorListHeight]);

  // ── Canvas coords ──
  const getCanvasCoords = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current || !canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
  }, [zoom]);

  const findNearestPoint = useCallback((x: number, y: number, threshold = 15): SelectedPoint | null => {
    if (!bezierData) return null;
    const scaledThreshold = threshold / zoom;
    for (let si = 0; si < bezierData.strokes.length; si++) {
      const stroke = bezierData.strokes[si];
      for (let ei = 0; ei < stroke.length; ei++) {
        const seg = stroke[ei];
        if (Math.hypot(seg.p0[0] - x, seg.p0[1] - y) < scaledThreshold) return { strokeIndex: si, segmentIndex: ei, pointType: 'p0' };
        if (Math.hypot(seg.p3[0] - x, seg.p3[1] - y) < scaledThreshold) return { strokeIndex: si, segmentIndex: ei, pointType: 'p3' };
        if (showHandles) {
          if (Math.hypot(seg.c1[0] - x, seg.c1[1] - y) < scaledThreshold) return { strokeIndex: si, segmentIndex: ei, pointType: 'c1' };
          if (Math.hypot(seg.c2[0] - x, seg.c2[1] - y) < scaledThreshold) return { strokeIndex: si, segmentIndex: ei, pointType: 'c2' };
        }
      }
    }
    return null;
  }, [bezierData, showHandles, zoom]);

  // ── Connection map ──
  const connectionMap = useMemo(() => {
    if (!bezierData) return new Map<string, string[]>();
    const allPoints: { key: string; x: number; y: number }[] = [];
    bezierData.strokes.forEach((stroke, si) => {
      stroke.forEach((seg, ei) => {
        allPoints.push({ key: `${si}-${ei}-p0`, x: seg.p0[0], y: seg.p0[1] });
        allPoints.push({ key: `${si}-${ei}-p3`, x: seg.p3[0], y: seg.p3[1] });
      });
    });
    const links = new Map<string, Set<string>>();
    for (const pt of allPoints) { if (!links.has(pt.key)) links.set(pt.key, new Set()); }
    for (let i = 0; i < allPoints.length; i++) {
      for (let j = i + 1; j < allPoints.length; j++) {
        const a = allPoints[i], b = allPoints[j];
        if (Math.hypot(a.x - b.x, a.y - b.y) < 2) {
          links.get(a.key)!.add(b.key);
          links.get(b.key)!.add(a.key);
        }
      }
    }
    const result = new Map<string, string[]>();
    const visited = new Set<string>();
    for (const pt of allPoints) {
      if (visited.has(pt.key)) continue;
      const group: string[] = [];
      const queue = [pt.key];
      while (queue.length > 0) {
        const curr = queue.pop()!;
        if (visited.has(curr)) continue;
        visited.add(curr);
        group.push(curr);
        for (const neighbor of links.get(curr) || []) {
          if (!visited.has(neighbor)) queue.push(neighbor);
        }
      }
      if (group.length > 1) {
        for (const k of group) result.set(k, group.filter((g) => g !== k));
      }
    }
    return result;
  }, [bezierData]);

  // ── Nudge ──
  const nudgeSelectedPoint = useCallback((dx: number, dy: number, alt: boolean, shift: boolean) => {
    if (!selectedPoint || !bezierData) return;
    const step = (!alt && shift) ? 10 : 1;
    const ndx = dx * step, ndy = dy * step;
    setBezierData((prev) => {
      if (!prev) return prev;
      const newData: BezierData = JSON.parse(JSON.stringify(prev));
      const { strokeIndex, segmentIndex, pointType } = selectedPoint;
      const seg = newData.strokes[strokeIndex]?.[segmentIndex];
      if (!seg) return prev;
      if (pointType === 'c1' || pointType === 'c2') {
        seg[pointType][0] += ndx;
        seg[pointType][1] += ndy;
        if (alt) {
          const anchor = pointType === 'c1' ? seg.p0 : seg.p3;
          const moved = seg[pointType];
          const angle = Math.atan2(moved[1] - anchor[1], moved[0] - anchor[0]);
          const dist = Math.hypot(moved[0] - anchor[0], moved[1] - anchor[1]);
          const opposite = pointType === 'c1' ? 'c2' : 'c1';
          seg[opposite][0] = anchor[0] + Math.cos(angle + Math.PI) * dist;
          seg[opposite][1] = anchor[1] + Math.sin(angle + Math.PI) * dist;
        }
      } else {
        const applyToAnchor = (s: typeof seg, pt: 'p0' | 'p3') => {
          if (alt && shift) {
            const c1Off: [number, number] = [s.c1[0] - s[pt][0], s.c1[1] - s[pt][1]];
            const c2Off: [number, number] = [s.c2[0] - s[pt][0], s.c2[1] - s[pt][1]];
            s[pt][0] += ndx; s[pt][1] += ndy;
            s.c1[0] = s[pt][0] + c1Off[0]; s.c1[1] = s[pt][1] + c1Off[1];
            s.c2[0] = s[pt][0] + c2Off[0]; s.c2[1] = s[pt][1] + c2Off[1];
          } else if (alt) {
            s[pt][0] += ndx; s[pt][1] += ndy;
            s.c1[0] += ndx; s.c1[1] += ndy;
            s.c2[0] += ndx; s.c2[1] += ndy;
          } else {
            s[pt][0] += ndx; s[pt][1] += ndy;
          }
        };
        applyToAnchor(seg, pointType);
        const myKey = `${strokeIndex}-${segmentIndex}-${pointType}`;
        const linked = connectionMap.get(myKey) || [];
        for (const lk of linked) {
          const [lsi, lei, lpt] = lk.split('-');
          const linkedSeg = newData.strokes[Number(lsi)]?.[Number(lei)];
          if (linkedSeg) applyToAnchor(linkedSeg, lpt as 'p0' | 'p3');
        }
      }
      return newData;
    });
  }, [selectedPoint, bezierData, connectionMap]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!visibleRef.current || !focusedRef.current || isEditableKeyboardTarget(e.target)) return;
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (isMod && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
      if (isMod && e.key === 'y') { e.preventDefault(); redo(); }
      if (isMod && e.key === 's') { e.preventDefault(); quickSave(); }
      if (e.key === 'Escape') { finishPenStroke(); return; }
      if (e.key === 'v' || e.key === 'V') switchTool('select');
      if (e.key === 'p' || e.key === 'P') switchTool('pen');
      if (e.key === 'h' || e.key === 'H') switchTool('hand');
      if (e.key === 't' || e.key === 'T') { setAnimationModeEnabled(prev => !prev); sounds.click(); }
      if (animationModeEnabled) {
        if (e.key === ' ') { e.preventDefault(); setIsAnimating(prev => !prev); return; }
        if (e.key === 'r' || e.key === 'R') { e.preventDefault(); setIsAnimating(false); setAnimationProgress(0); sounds.click(); return; }
      }
      if ((e.key === 'Backspace' || e.key === 'Delete') && !isMod) {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        deleteSelectedPoint();
      }
      if (e.key === ' ') { e.preventDefault(); switchTool('hand'); }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedPoint) {
        e.preventDefault();
        const ddx = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        const ddy = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
        nudgeSelectedPoint(ddx, ddy, e.altKey, e.shiftKey);
      }
    };
    const keyup = (e: KeyboardEvent) => {
      if (!visibleRef.current || !focusedRef.current || isEditableKeyboardTarget(e.target)) return;
      if (e.key === ' ' && !animationModeEnabled) switchTool('select');
    };
    window.addEventListener('keydown', handler);
    window.addEventListener('keyup', keyup);
    return () => { window.removeEventListener('keydown', handler); window.removeEventListener('keyup', keyup); };
  }, [undo, redo, quickSave, deleteSelectedPoint, switchTool, finishPenStroke, nudgeSelectedPoint, selectedPoint, animationModeEnabled]);

  // ── Animation loop ──
  useEffect(() => {
    if (!isAnimating) return;
    let lastTime = performance.now();
    let animId: number;
    const animate = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;
      setAnimationProgress(prev => {
        const increment = deltaTime * animationSpeed * 0.4;
        const newProgress = prev + increment;
        if (newProgress >= 1) { setIsAnimating(false); return 1; }
        return newProgress;
      });
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [isAnimating, animationSpeed]);

  // ── Trace ──
  const traceImageSrc = projectImage?.url || '/shaper/starter-silhouette.png';
  const displayImageSrc = projectImage?.url || '/shaper/starter-original.png';

  const handleRetrace = useCallback(async () => {
    setIsTracing(true);
    try {
      const result = await traceFromImage(traceImageSrc, traceOptions);
      if (result.strokes.length > 0 && result.strokes[0].length > 0) {
        setBezierData({ strokes: result.strokes });
        setTraceInfo(result.info);
        setSmoothStates({});
        setHiddenStrokes(new Set());
      }
    } catch (err) {
      console.error('Re-trace error:', err);
    } finally {
      setIsTracing(false);
    }
  }, [traceOptions, traceImageSrc]);

  // ── Canvas mouse handlers ──
  const handlePointMouseDown = useCallback((e: React.MouseEvent) => {
    if (tool === 'hand' || e.button === 1 || (tool !== 'pen' && e.button === 0 && e.altKey)) {
      setIsPanning(true);
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      e.preventDefault();
      return;
    }
    if (tool === 'pen') {
      e.stopPropagation();
      const coords = getCanvasCoords(e);
      const clickPoint: [number, number] = [coords.x, coords.y];
      const nearPoint = findNearestPoint(coords.x, coords.y, 12);
      const isEndpoint = nearPoint && (nearPoint.pointType === 'p0' || nearPoint.pointType === 'p3');
      setBezierData((prev) => {
        const data = prev ? JSON.parse(JSON.stringify(prev)) : { strokes: [] };
        if (penStrokeIndex !== null && penLastPoint) {
          const stroke = data.strokes[penStrokeIndex];
          if (stroke) {
            const prevEnd = penLastPoint;
            const dx = clickPoint[0] - prevEnd[0];
            const dy = clickPoint[1] - prevEnd[1];
            stroke.push({
              p0: [...prevEnd] as [number, number],
              c1: [prevEnd[0] + dx / 3, prevEnd[1] + dy / 3] as [number, number],
              c2: [clickPoint[0] - dx / 3, clickPoint[1] - dy / 3] as [number, number],
              p3: [...clickPoint] as [number, number],
            });
            setPenLastPoint(clickPoint);
            return data;
          }
        }
        if (isEndpoint && prev) {
          const { strokeIndex, segmentIndex, pointType } = nearPoint;
          const seg = prev.strokes[strokeIndex]?.[segmentIndex];
          if (seg) {
            const anchor: [number, number] = pointType === 'p3' ? [seg.p3[0], seg.p3[1]] : [seg.p0[0], seg.p0[1]];
            setPenStrokeIndex(strokeIndex);
            setPenLastPoint(anchor);
            return data;
          }
        }
        const newStrokeIdx = data.strokes.length;
        data.strokes.push([]);
        setPenStrokeIndex(newStrokeIdx);
        setPenLastPoint(clickPoint);
        return data;
      });
      return;
    }
    if (tool !== 'select') return;
    e.stopPropagation();
    const coords = getCanvasCoords(e);
    const point = findNearestPoint(coords.x, coords.y);
    if (point) {
      if (e.altKey && (point.pointType === 'p0' || point.pointType === 'p3')) {
        const anchorKey = `${point.strokeIndex}-${point.segmentIndex}-${point.pointType}`;
        setSmoothStates((prev) => ({ ...prev, [anchorKey]: !prev[anchorKey] }));
        return;
      }
      setSelectedPoint(point);
      setIsDraggingPoint(true);
      setDragStart(coords);
      dragStartRef.current = coords;
    } else {
      setSelectedPoint(null);
    }
  }, [tool, getCanvasCoords, findNearestPoint, pan, penStrokeIndex, penLastPoint]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const coords = getCanvasCoords(e);
      mousePosRef.current = { screen: { x: screenX, y: screenY }, canvas: { x: coords.x, y: coords.y } };
      // Direct DOM updates for crosshair guides — no state, no re-render
      const container = containerRef.current;
      const vLine = container.querySelector('[data-shaper-guide-v]') as HTMLElement | null;
      const hLine = container.querySelector('[data-shaper-guide-h]') as HTMLElement | null;
      const label = container.querySelector('[data-shaper-guide-label]') as HTMLElement | null;
      if (vLine) { vLine.style.left = `${screenX}px`; vLine.style.display = ''; }
      if (hLine) { hLine.style.top = `${screenY}px`; hLine.style.display = ''; }
      if (label) { label.style.left = `${screenX}px`; label.style.top = `${screenY}px`; label.textContent = `${coords.x.toFixed(0)}, ${coords.y.toFixed(0)}`; label.style.display = ''; }
    }
    if (tool === 'pen') {
      const coords = getCanvasCoords(e);
      setPenPreviewPos([coords.x, coords.y]);
    }
    if (isPanningRef.current && canvasRef.current) {
      const newX = e.clientX - panStartRef.current.x;
      const newY = e.clientY - panStartRef.current.y;
      canvasRef.current.style.transform = `translate(${newX}px, ${newY}px) scale(${zoom})`;
      return;
    }
    if (isDraggingPoint && selectedPoint && dragStartRef.current) {
      const coords = getCanvasCoords(e);
      const dx = coords.x - dragStartRef.current.x;
      const dy = coords.y - dragStartRef.current.y;
      const isAltHeld = e.altKey;
      const isShiftHeld = e.shiftKey;
      setBezierData((prev) => {
        if (!prev) return prev;
        const { strokeIndex, segmentIndex, pointType } = selectedPoint;
        const newStrokes = prev.strokes.map((stroke, si) => {
          if (si !== strokeIndex) return stroke;
          return stroke.map((seg, sei) => {
            if (sei !== segmentIndex) return seg;
            return { p0: [...seg.p0], c1: [...seg.c1], c2: [...seg.c2], p3: [...seg.p3] } as BezierSegment;
          });
        });
        if (pointType === 'p0' || pointType === 'p3') {
          const myKey = `${strokeIndex}-${segmentIndex}-${pointType}`;
          const linked = connectionMap.get(myKey) || [];
          for (const lk of linked) {
            const [lsi, lei] = lk.split('-').map(Number);
            if (lsi !== strokeIndex || lei !== segmentIndex) {
              newStrokes[lsi] = newStrokes[lsi] === prev.strokes[lsi]
                ? [...prev.strokes[lsi]]
                : newStrokes[lsi];
              const origSeg = prev.strokes[lsi][lei];
              newStrokes[lsi][lei] = { p0: [...origSeg.p0], c1: [...origSeg.c1], c2: [...origSeg.c2], p3: [...origSeg.p3] } as BezierSegment;
            }
          }
        }
        const newData = { strokes: newStrokes };
        const seg = newData.strokes[strokeIndex][segmentIndex];
        const anchorKey = `${strokeIndex}-${segmentIndex}-${pointType === 'c1' ? 'p0' : pointType === 'c2' ? 'p3' : pointType}`;
        if (pointType === 'c1' || pointType === 'c2') {
          seg[pointType][0] += dx;
          seg[pointType][1] += dy;
          const isSmooth = smoothStates[anchorKey] && !isAltHeld;
          if (isSmooth) {
            const anchor = pointType === 'c1' ? seg.p0 : seg.p3;
            const movedHandle = seg[pointType];
            const angle = Math.atan2(movedHandle[1] - anchor[1], movedHandle[0] - anchor[0]);
            const dist = Math.hypot(movedHandle[0] - anchor[0], movedHandle[1] - anchor[1]);
            const oppositeAngle = angle + Math.PI;
            if (pointType === 'c1') {
              seg.c2[0] = anchor[0] + Math.cos(oppositeAngle) * dist;
              seg.c2[1] = anchor[1] + Math.sin(oppositeAngle) * dist;
            } else {
              seg.c1[0] = anchor[0] + Math.cos(oppositeAngle) * dist;
              seg.c1[1] = anchor[1] + Math.sin(oppositeAngle) * dist;
            }
          }
        } else if (pointType === 'p0' || pointType === 'p3') {
          const moveAnchor = (s: typeof seg, pt: 'p0' | 'p3', moveHandles: boolean) => {
            s[pt][0] += dx;
            s[pt][1] += dy;
            if (moveHandles) {
              const handle = pt === 'p0' ? 'c1' : 'c2';
              s[handle][0] += dx;
              s[handle][1] += dy;
            }
          };
          const moveHandles = !isShiftHeld;
          moveAnchor(seg, pointType, moveHandles);
          const myKey = `${strokeIndex}-${segmentIndex}-${pointType}`;
          const linked = connectionMap.get(myKey) || [];
          for (const lk of linked) {
            const [lsi, lei, lpt] = lk.split('-');
            const linkedSeg = newData.strokes[Number(lsi)]?.[Number(lei)];
            if (linkedSeg) moveAnchor(linkedSeg, lpt as 'p0' | 'p3', moveHandles);
          }
        }
        return newData;
      });
      dragStartRef.current = coords;
    }
  }, [isDraggingPoint, selectedPoint, getCanvasCoords, smoothStates, connectionMap, tool, zoom]);

  const handleCanvasMouseUp = useCallback(() => {
    if (isPanningRef.current && canvasRef.current) {
      const style = canvasRef.current.style.transform;
      const match = style.match(/translate\((.+?)px,\s*(.+?)px\)/);
      if (match) setPan({ x: parseFloat(match[1]), y: parseFloat(match[2]) });
    }
    setIsPanning(false);
    isPanningRef.current = false;
    setIsDraggingPoint(false);
    dragStartRef.current = null;
  }, []);

  // ── Point editing ──
  const updatePointCoord = useCallback((axis: 'x' | 'y', value: number) => {
    if (!selectedPoint) return;
    setBezierData((prev) => {
      if (!prev) return prev;
      const newData = JSON.parse(JSON.stringify(prev));
      const seg = newData.strokes[selectedPoint.strokeIndex][selectedPoint.segmentIndex];
      const idx = axis === 'x' ? 0 : 1;
      seg[selectedPoint.pointType][idx] = value;
      return newData;
    });
  }, [selectedPoint]);

  const selectAnchorByName = useCallback((anchor: NamedAnchor) => {
    if (!bezierData) return;
    const threshold = 10;
    for (let si = 0; si < bezierData.strokes.length; si++) {
      const stroke = bezierData.strokes[si];
      for (let ei = 0; ei < stroke.length; ei++) {
        const seg = stroke[ei];
        if (Math.hypot(seg.p0[0] - anchor.x, seg.p0[1] - anchor.y) < threshold) {
          setSelectedPoint({ strokeIndex: si, segmentIndex: ei, pointType: 'p0' });
          return;
        }
        if (Math.hypot(seg.p3[0] - anchor.x, seg.p3[1] - anchor.y) < threshold) {
          setSelectedPoint({ strokeIndex: si, segmentIndex: ei, pointType: 'p3' });
          return;
        }
      }
    }
  }, [bezierData]);

  const focusOnPoint = useCallback((x: number, y: number) => {
    if (!containerRef.current) return;
    const targetZoom = Math.max(0.8, zoom);
    setZoom(targetZoom);
    // Canvas is anchored at container center with transform-origin: center.
    // Pan offsets the canvas-space point (x, y) from its natural position at (512, 512).
    setPan({ x: (512 - x) * targetZoom, y: (512 - y) * targetZoom });
  }, [zoom]);

  const selectAndFocusAnchor = useCallback((anchor: NamedAnchor) => {
    selectAnchorByName(anchor);
    focusOnPoint(anchor.x, anchor.y);
  }, [selectAnchorByName, focusOnPoint]);

  const focusOnSelected = useCallback(() => {
    if (!selectedPoint || !bezierData) return;
    const seg = bezierData.strokes[selectedPoint.strokeIndex]?.[selectedPoint.segmentIndex];
    if (!seg) return;
    const pt = seg[selectedPoint.pointType];
    focusOnPoint(pt[0], pt[1]);
  }, [selectedPoint, bezierData, focusOnPoint]);

  // ── Minimap ──
  const handleMinimapClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mapW = rect.width, mapH = rect.height;
    const scale = Math.min(mapW / 1024, mapH / 1024);
    const renderedW = 1024 * scale, renderedH = 1024 * scale;
    const offsetX = (mapW - renderedW) / 2, offsetY = (mapH - renderedH) / 2;
    const clickX = e.clientX - rect.left, clickY = e.clientY - rect.top;
    const canvasX = (clickX - offsetX) / scale, canvasY = (clickY - offsetY) / scale;
    const cx = Math.max(0, Math.min(1024, canvasX));
    const cy = Math.max(0, Math.min(1024, canvasY));
    const viewRect = containerRef.current.getBoundingClientRect();
    setPan({ x: viewRect.width / 2 - cx * zoom, y: viewRect.height / 2 - cy * zoom });
  }, [zoom]);

  // ── Computed values ──
  const strokesPath = useMemo(() => {
    if (!bezierData) return '';
    return bezierData.strokes.map((stroke, i) => {
      if (stroke.length === 0 || hiddenStrokes.has(i)) return '';
      let d = `M ${stroke[0].p0[0]} ${stroke[0].p0[1]}`;
      for (const seg of stroke) {
        d += ` C ${seg.c1[0]} ${seg.c1[1]}, ${seg.c2[0]} ${seg.c2[1]}, ${seg.p3[0]} ${seg.p3[1]}`;
      }
      return d;
    }).join(' ');
  }, [bezierData, hiddenStrokes]);

  const pathLengthEstimate = useMemo(() => {
    if (!bezierData) return 0;
    let totalLength = 0;
    for (const stroke of bezierData.strokes) {
      for (const seg of stroke) {
        const len1 = Math.hypot(seg.c1[0] - seg.p0[0], seg.c1[1] - seg.p0[1]);
        const len2 = Math.hypot(seg.c2[0] - seg.c1[0], seg.c2[1] - seg.c1[1]);
        const len3 = Math.hypot(seg.p3[0] - seg.c2[0], seg.p3[1] - seg.c2[1]);
        const controlPolygonLength = len1 + len2 + len3;
        const chordLength = Math.hypot(seg.p3[0] - seg.p0[0], seg.p3[1] - seg.p0[1]);
        totalLength += (controlPolygonLength * 0.7 + chordLength * 0.3);
      }
    }
    return totalLength;
  }, [bezierData]);

  // Handle/anchor reveal for animation
  const { revealedHandles, revealedAnchors } = useMemo(() => {
    if (!bezierData || animationProgress === 0) return { revealedHandles: [] as ShaperContextValue['revealedHandles'], revealedAnchors: [] as ShaperContextValue['revealedAnchors'] };
    if (!showAnimationHandles && !showAnimationAngles) return { revealedHandles: [] as ShaperContextValue['revealedHandles'], revealedAnchors: [] as ShaperContextValue['revealedAnchors'] };
    const totalSegments = bezierData.strokes.reduce((sum, stroke) => sum + stroke.length, 0);
    const currentSegmentFloat = totalSegments * animationProgress;
    const currentSegmentIndex = Math.floor(currentSegmentFloat);
    const segmentProgress = currentSegmentFloat - currentSegmentIndex;
    const handles: ShaperContextValue['revealedHandles'] = [];
    let segIdx = 0;
    for (const stroke of bezierData.strokes) {
      for (const seg of stroke) {
        const isCurrent = segIdx === currentSegmentIndex;
        const isPast = segIdx < currentSegmentIndex;
        if (isPast) {
          const dx1 = seg.c1[0] - seg.p0[0], dy1 = seg.c1[1] - seg.p0[1];
          const c1Angle = Math.round((Math.atan2(dy1, dx1) * 180) / Math.PI);
          const dx2 = seg.c2[0] - seg.p3[0], dy2 = seg.c2[1] - seg.p3[1];
          const c2Angle = Math.round((Math.atan2(dy2, dx2) * 180) / Math.PI);
          handles.push({ x1: seg.p0[0], y1: seg.p0[1], x2: seg.c1[0], y2: seg.c1[1], angle: showAnimationAngles ? c1Angle : undefined, anchorX: seg.p0[0], anchorY: seg.p0[1], handleX: seg.c1[0], handleY: seg.c1[1], opacity: 1 });
          handles.push({ x1: seg.p3[0], y1: seg.p3[1], x2: seg.c2[0], y2: seg.c2[1], angle: showAnimationAngles ? c2Angle : undefined, anchorX: seg.p3[0], anchorY: seg.p3[1], handleX: seg.c2[0], handleY: seg.c2[1], opacity: 1 });
        } else if (isCurrent) {
          const dx1 = seg.c1[0] - seg.p0[0], dy1 = seg.c1[1] - seg.p0[1];
          const c1Angle = Math.round((Math.atan2(dy1, dx1) * 180) / Math.PI);
          if (segmentProgress > 0.15) {
            const fadeIn = Math.min(1, (segmentProgress - 0.15) / 0.1);
            handles.push({ x1: seg.p0[0], y1: seg.p0[1], x2: seg.c1[0], y2: seg.c1[1], angle: showAnimationAngles ? c1Angle : undefined, anchorX: seg.p0[0], anchorY: seg.p0[1], handleX: seg.c1[0], handleY: seg.c1[1], opacity: fadeIn });
          }
          if (segmentProgress > 0.6) {
            const dx2 = seg.c2[0] - seg.p3[0], dy2 = seg.c2[1] - seg.p3[1];
            const c2Angle = Math.round((Math.atan2(dy2, dx2) * 180) / Math.PI);
            const fadeIn = Math.min(1, (segmentProgress - 0.6) / 0.15);
            handles.push({ x1: seg.p3[0], y1: seg.p3[1], x2: seg.c2[0], y2: seg.c2[1], angle: showAnimationAngles ? c2Angle : undefined, anchorX: seg.p3[0], anchorY: seg.p3[1], handleX: seg.c2[0], handleY: seg.c2[1], opacity: fadeIn });
          }
        }
        segIdx++;
      }
    }
    const anchors: ShaperContextValue['revealedAnchors'] = [];
    segIdx = 0;
    for (const stroke of bezierData.strokes) {
      for (const seg of stroke) {
        const isCurrent = segIdx === currentSegmentIndex;
        const isPast = segIdx < currentSegmentIndex;
        if (isPast) {
          anchors.push({ x: seg.p0[0], y: seg.p0[1], isSmooth: smoothStates[`${segIdx}-0-p0`] || false, opacity: 1 });
          anchors.push({ x: seg.p3[0], y: seg.p3[1], isSmooth: smoothStates[`${segIdx}-${stroke.length - 1}-p3`] || false, opacity: 1 });
        } else if (isCurrent && segmentProgress > 0.05) {
          const fadeIn = Math.min(1, (segmentProgress - 0.05) / 0.1);
          anchors.push({ x: seg.p0[0], y: seg.p0[1], isSmooth: smoothStates[`${segIdx}-0-p0`] || false, opacity: fadeIn });
        }
        segIdx++;
      }
    }
    return { revealedHandles: handles, revealedAnchors: anchors };
  }, [bezierData, animationProgress, showAnimationHandles, showAnimationAngles, smoothStates, isAnimating]);

  // SVG elements — handle lines, control points, anchor points, labels
  const handleLines = useMemo(() => {
    if (!bezierData || !showHandles) return [];
    const lines: ReactElement[] = [];
    bezierData.strokes.forEach((stroke, si) => {
      if (hiddenStrokes.has(si)) return;
      stroke.forEach((seg, ei) => {
        const isC1Sel = selectedPoint?.strokeIndex === si && selectedPoint?.segmentIndex === ei && selectedPoint?.pointType === 'c1';
        const isC2Sel = selectedPoint?.strokeIndex === si && selectedPoint?.segmentIndex === ei && selectedPoint?.pointType === 'c2';
        lines.push(
          <line key={`h1-${si}-${ei}`} x1={seg.p0[0]} y1={seg.p0[1]} x2={seg.c1[0]} y2={seg.c1[1]} className={isC1Sel ? 'stroke-yellow-400' : 'stroke-blue-400'} strokeWidth={isC1Sel ? 2 : 1} opacity={isC1Sel ? 1 : 0.6} />,
          <line key={`h2-${si}-${ei}`} x1={seg.p3[0]} y1={seg.p3[1]} x2={seg.c2[0]} y2={seg.c2[1]} className={isC2Sel ? 'stroke-yellow-400' : 'stroke-blue-400'} strokeWidth={isC2Sel ? 2 : 1} opacity={isC2Sel ? 1 : 0.6} />
        );
      });
    });
    return lines;
  }, [bezierData, showHandles, selectedPoint, hiddenStrokes]);

  const controlPoints = useMemo(() => {
    if (!bezierData || !showHandles) return [];
    const points: ReactElement[] = [];
    bezierData.strokes.forEach((stroke, si) => {
      if (hiddenStrokes.has(si)) return;
      stroke.forEach((seg, ei) => {
        const isC1Sel = selectedPoint?.strokeIndex === si && selectedPoint?.segmentIndex === ei && selectedPoint?.pointType === 'c1';
        const isC2Sel = selectedPoint?.strokeIndex === si && selectedPoint?.segmentIndex === ei && selectedPoint?.pointType === 'c2';
        points.push(
          <circle key={`c1-${si}-${ei}`} cx={seg.c1[0]} cy={seg.c1[1]} r={isC1Sel ? 7 : 4} className={isC1Sel ? 'fill-yellow-400' : 'fill-blue-400'} />,
          <circle key={`c2-${si}-${ei}`} cx={seg.c2[0]} cy={seg.c2[1]} r={isC2Sel ? 7 : 4} className={isC2Sel ? 'fill-yellow-400' : 'fill-blue-400'} />
        );
      });
    });
    return points;
  }, [bezierData, showHandles, selectedPoint, hiddenStrokes]);

  const anchorPoints = useMemo(() => {
    if (!bezierData || !showAnchors) return [];
    const points: ReactElement[] = [];
    bezierData.strokes.forEach((stroke, si) => {
      if (hiddenStrokes.has(si)) return;
      stroke.forEach((seg, ei) => {
        const isP0Sel = selectedPoint?.strokeIndex === si && selectedPoint?.segmentIndex === ei && selectedPoint?.pointType === 'p0';
        const isP3Sel = selectedPoint?.strokeIndex === si && selectedPoint?.segmentIndex === ei && selectedPoint?.pointType === 'p3';
        const isP0Smooth = smoothStates[`${si}-${ei}-p0`];
        const isP3Smooth = smoothStates[`${si}-${ei}-p3`];
        if (isP0Smooth) points.push(<circle key={`p0-ring-${si}-${ei}`} cx={seg.p0[0]} cy={seg.p0[1]} r="9" fill="none" stroke="#22c55e" strokeWidth="2" opacity="0.8" />);
        if (isP3Smooth) points.push(<circle key={`p3-ring-${si}-${ei}`} cx={seg.p3[0]} cy={seg.p3[1]} r="9" fill="none" stroke="#22c55e" strokeWidth="2" opacity="0.8" />);
        points.push(
          <circle key={`p0-${si}-${ei}`} cx={seg.p0[0]} cy={seg.p0[1]} r={isP0Sel ? 8 : 5} className={isP0Sel ? 'fill-yellow-400' : isP0Smooth ? 'fill-green-500' : 'fill-red-500'} />,
          <circle key={`p3-${si}-${ei}`} cx={seg.p3[0]} cy={seg.p3[1]} r={isP3Sel ? 8 : 5} className={isP3Sel ? 'fill-yellow-400' : isP3Smooth ? 'fill-green-500' : 'fill-red-500'} />
        );
      });
    });
    return points;
  }, [bezierData, showAnchors, selectedPoint, smoothStates, hiddenStrokes]);

  const anchorLabels = useMemo(() => {
    if (!anchorsData || !showLabels) return [];
    return anchorsData.anchors.map((anchor, i) => (
      <g key={i}>
        <rect x={anchor.x + 8} y={anchor.y - 10} width={anchor.name.length * 7 + 8} height="18" rx="3" className="fill-zinc-900" opacity="0.8" />
        <text x={anchor.x + 12} y={anchor.y + 2} className="fill-white text-[10px] font-mono">{anchor.name}</text>
      </g>
    ));
  }, [anchorsData, showLabels]);

  const staticAngleLabels = useMemo(() => {
    if (!bezierData || !showAnimationAngles) return [];
    if (animationProgress > 0 && isAnimating) return [];
    const labels: ReactElement[] = [];
    const arcR = angleArcRadius;
    bezierData.strokes.forEach((stroke, si) => {
      stroke.forEach((seg, ei) => {
        const dx1 = seg.c1[0] - seg.p0[0], dy1 = seg.c1[1] - seg.p0[1];
        const angleRad1 = Math.atan2(dy1, dx1);
        const angleDeg1 = Math.round((angleRad1 * 180) / Math.PI);
        const refAngle = 0;
        const startX1 = seg.p0[0] + arcR * Math.cos(refAngle), startY1 = seg.p0[1] + arcR * Math.sin(refAngle);
        const endX1 = seg.p0[0] + arcR * Math.cos(angleRad1), endY1 = seg.p0[1] + arcR * Math.sin(angleRad1);
        const largeArc1 = Math.abs(angleDeg1) > 180 ? 1 : 0;
        const sweepFlag1 = angleDeg1 > 0 ? 1 : 0;
        const midAngle1 = angleRad1 / 2;
        const labelR1 = arcR + 12;
        labels.push(
          <g key={`c1-angle-${si}-${ei}`}>
            {showAngleReference && <line x1={seg.p0[0]} y1={seg.p0[1]} x2={seg.p0[0] + arcR * 1.2} y2={seg.p0[1]} stroke="#60a5fa" strokeWidth="0.5" opacity="0.3" strokeDasharray="2,2" />}
            <path d={`M ${startX1} ${startY1} A ${arcR} ${arcR} 0 ${largeArc1} ${sweepFlag1} ${endX1} ${endY1}`} fill="none" stroke="#60a5fa" strokeWidth="1.5" opacity="0.7" />
            <text x={seg.p0[0] + labelR1 * Math.cos(midAngle1)} y={seg.p0[1] + labelR1 * Math.sin(midAngle1)} fontSize="9" fontFamily="monospace" fill="#60a5fa" opacity="0.7" fontWeight="600" textAnchor="middle" dominantBaseline="middle">{angleDeg1}°</text>
          </g>
        );
        const dx2 = seg.c2[0] - seg.p3[0], dy2 = seg.c2[1] - seg.p3[1];
        const angleRad2 = Math.atan2(dy2, dx2);
        const angleDeg2 = Math.round((angleRad2 * 180) / Math.PI);
        const startX2 = seg.p3[0] + arcR * Math.cos(refAngle), startY2 = seg.p3[1] + arcR * Math.sin(refAngle);
        const endX2 = seg.p3[0] + arcR * Math.cos(angleRad2), endY2 = seg.p3[1] + arcR * Math.sin(angleRad2);
        const largeArc2 = Math.abs(angleDeg2) > 180 ? 1 : 0;
        const sweepFlag2 = angleDeg2 > 0 ? 1 : 0;
        const midAngle2 = angleRad2 / 2;
        const labelR2 = arcR + 12;
        labels.push(
          <g key={`c2-angle-${si}-${ei}`}>
            {showAngleReference && <line x1={seg.p3[0]} y1={seg.p3[1]} x2={seg.p3[0] + arcR * 1.2} y2={seg.p3[1]} stroke="#60a5fa" strokeWidth="0.5" opacity="0.3" strokeDasharray="2,2" />}
            <path d={`M ${startX2} ${startY2} A ${arcR} ${arcR} 0 ${largeArc2} ${sweepFlag2} ${endX2} ${endY2}`} fill="none" stroke="#60a5fa" strokeWidth="1.5" opacity="0.7" />
            <text x={seg.p3[0] + labelR2 * Math.cos(midAngle2)} y={seg.p3[1] + labelR2 * Math.sin(midAngle2)} fontSize="9" fontFamily="monospace" fill="#60a5fa" opacity="0.7" fontWeight="600" textAnchor="middle" dominantBaseline="middle">{angleDeg2}°</text>
          </g>
        );
      });
    });
    return labels;
  }, [bezierData, showAnimationAngles, animationProgress, isAnimating, angleArcRadius, showAngleReference]);

  const strokeGroups = useMemo(() => {
    if (!anchorsData) return [];
    const groups: Record<string, NamedAnchor[]> = {};
    anchorsData.anchors.forEach((anchor) => {
      if (!groups[anchor.stroke]) groups[anchor.stroke] = [];
      groups[anchor.stroke].push(anchor);
    });
    return Object.entries(groups);
  }, [anchorsData]);

  // Per-stroke summaries: always populated from bezierData, independent of anchorsData.
  // Used by the left panel's Strokes section — anchorsData is empty for traced images.
  const strokeSummaries = useMemo(() => {
    if (!bezierData) return [];
    // If a stroke has named anchors, surface the most common one as its label.
    const nameByStrokeIndex = new Map<number, string>();
    if (anchorsData) {
      const counts = new Map<number, Map<string, number>>();
      for (const a of anchorsData.anchors) {
        if (!counts.has(a.index)) counts.set(a.index, new Map());
        const m = counts.get(a.index)!;
        m.set(a.stroke, (m.get(a.stroke) ?? 0) + 1);
      }
      for (const [idx, m] of counts) {
        let best = ''; let bestN = 0;
        for (const [name, n] of m) if (n > bestN) { best = name; bestN = n; }
        if (best) nameByStrokeIndex.set(idx, best);
      }
    }
    return bezierData.strokes.map((stroke, index) => {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const seg of stroke) {
        for (const pt of [seg.p0, seg.p3] as const) {
          if (pt[0] < minX) minX = pt[0]; if (pt[0] > maxX) maxX = pt[0];
          if (pt[1] < minY) minY = pt[1]; if (pt[1] > maxY) maxY = pt[1];
        }
      }
      const bbox = stroke.length === 0
        ? { x: 0, y: 0, width: 0, height: 0 }
        : { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
      return {
        index,
        segments: stroke.length,
        name: nameByStrokeIndex.get(index) ?? null,
        bbox,
        hidden: hiddenStrokes.has(index),
      };
    });
  }, [bezierData, anchorsData, hiddenStrokes]);

  const toggleStrokeVisibility = useCallback((index: number) => {
    setHiddenStrokes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  }, []);

  const deleteStroke = useCallback((index: number) => {
    setBezierData((prev) => {
      if (!prev) return prev;
      const strokes = prev.strokes.filter((_, i) => i !== index);
      return { strokes };
    });
    // Re-index hiddenStrokes so the set stays consistent after removal.
    setHiddenStrokes((prev) => {
      const next = new Set<number>();
      for (const i of prev) {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      }
      return next;
    });
    setSelectedPoint((sp) => (sp && sp.strokeIndex === index ? null : sp));
  }, []);

  const focusOnStroke = useCallback((index: number) => {
    if (!bezierData || !containerRef.current) return;
    const stroke = bezierData.strokes[index];
    if (!stroke || stroke.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const seg of stroke) {
      for (const pt of [seg.p0, seg.p3] as const) {
        if (pt[0] < minX) minX = pt[0]; if (pt[0] > maxX) maxX = pt[0];
        if (pt[1] < minY) minY = pt[1]; if (pt[1] > maxY) maxY = pt[1];
      }
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    focusOnPoint(cx, cy);
  }, [bezierData, focusOnPoint]);

  // ── AI (tool-using agent over the trace pipeline + stroke list) ──
  const { sendAiMessage, aiStatus, aiActivity, aiError, clearAiActivity, stopAi } = useShaperAI({
    projectImage,
    traceOptions,
    traceInfo,
    setTraceOptions,
    handleRetrace,
    toggleStrokeVisibility,
    deleteStroke,
    strokeSummaries,
  });

  const filteredAnchors = useMemo(() => {
    if (!anchorsData) return [];
    if (!searchQuery.trim()) return anchorsData.anchors;
    const query = searchQuery.trim();
    const filters: { strokes?: string[]; xMin?: number; xMax?: number; yMin?: number; yMax?: number; namePattern?: string } = {};
    const tokens = query.split(/\s+/);
    const nameParts: string[] = [];
    for (const token of tokens) {
      if (token.startsWith('stroke:')) {
        filters.strokes = token.slice(7).split(',').filter(Boolean);
      } else if (/^x([<>]=?|=)/.test(token)) {
        const match = token.match(/^x([<>]=?|=)(\d+(?:\.\d+)?)$/);
        if (match) { const op = match[1], val = Number(match[2]); if (op === '>' || op === '>=') filters.xMin = val; else if (op === '<' || op === '<=') filters.xMax = val; }
      } else if (/^y([<>]=?|=)/.test(token)) {
        const match = token.match(/^y([<>]=?|=)(\d+(?:\.\d+)?)$/);
        if (match) { const op = match[1], val = Number(match[2]); if (op === '>' || op === '>=') filters.yMin = val; else if (op === '<' || op === '<=') filters.yMax = val; }
      } else {
        nameParts.push(token);
      }
    }
    if (nameParts.length > 0) filters.namePattern = nameParts.join(' ').toLowerCase();
    return anchorsData.anchors.filter((anchor) => {
      if (filters.strokes && !filters.strokes.includes(anchor.stroke)) return false;
      if (filters.xMin !== undefined && anchor.x < filters.xMin) return false;
      if (filters.xMax !== undefined && anchor.x > filters.xMax) return false;
      if (filters.yMin !== undefined && anchor.y < filters.yMin) return false;
      if (filters.yMax !== undefined && anchor.y > filters.yMax) return false;
      if (filters.namePattern && !anchor.name.toLowerCase().includes(filters.namePattern)) return false;
      return true;
    });
  }, [anchorsData, searchQuery]);

  const selectedPointData = useMemo(() => {
    if (!selectedPoint || !bezierData) return null;
    const seg = bezierData.strokes[selectedPoint.strokeIndex]?.[selectedPoint.segmentIndex];
    if (!seg) return null;
    const pt = seg[selectedPoint.pointType];
    return { x: pt[0], y: pt[1], ...selectedPoint };
  }, [selectedPoint, bezierData]);

  const showEditor = !isInitialLoad && !showDropZone && (bezierData !== null || projectImage !== null);
  const showDropScreen = !isInitialLoad && (showDropZone || (!bezierData && !projectImage));

  // ── Context value ──
  const value = useMemo<ShaperContextValue>(() => ({
    zoom, setZoom, pan, setPan, isPanning, setIsPanning, panStart, setPanStart,
    dragStart, setDragStart, mousePosRef, clearMousePos,
    tool, switchTool, penStrokeIndex, setPenStrokeIndex, penLastPoint, setPenLastPoint,
    penPreviewPos, setPenPreviewPos, finishPenStroke,
    bezierData, setBezierData, anchorsData, setAnchorsData, smoothStates, setSmoothStates,
    saveStatus, pathColor, setPathColor,
    selectedPoint, setSelectedPoint, isDraggingPoint, setIsDraggingPoint,
    showOriginal, setShowOriginal, showSilhouette, setShowSilhouette,
    showPath, setShowPath, showHandles, setShowHandles, showAnchors, setShowAnchors,
    showLabels, setShowLabels, showGrid, setShowGrid, showGuides, setShowGuides,
    fillEnabled, setFillEnabled, fillPattern, setFillPattern, fillWeights, setFillWeights,
    animationModeEnabled, setAnimationModeEnabled, isAnimating, setIsAnimating,
    animationProgress, setAnimationProgress, animationSpeed, setAnimationSpeed,
    showAnimationHandles, setShowAnimationHandles, animationEasing, setAnimationEasing,
    showAnimationAngles, setShowAnimationAngles, handleOpacity, setHandleOpacity,
    angleArcRadius, setAngleArcRadius, showAngleReference, setShowAngleReference,
    openSections, toggleSection, searchQuery, setSearchQuery,
    showActionsMenu, setShowActionsMenu, anchorListHeight, setAnchorListHeight,
    isResizingAnchors, setIsResizingAnchors,
    projectImage, showDropZone, setShowDropZone, isInitialLoad,
    isDragOver, setIsDragOver, traceOptions, setTraceOptions, traceInfo,
    imageWarnings, setImageWarnings, recentImages,
    isTracing, projectId, projectMeta,
    devTab, setDevTab, devLogs, setDevLogs,
    canvasRef, containerRef, fileInputRef,
    connectionMap, strokesPath, pathLengthEstimate,
    revealedHandles, revealedAnchors,
    handleLines, controlPoints, anchorPoints, anchorLabels, staticAngleLabels,
    strokeGroups, strokeSummaries, hiddenStrokes, toggleStrokeVisibility, deleteStroke, focusOnStroke,
    sendAiMessage, aiStatus, aiActivity, aiError, clearAiActivity, stopAi,
    filteredAnchors, selectedPointData, showEditor, showDropScreen,
    traceImageSrc, displayImageSrc,
    undo, redo, quickSave, downloadJson, deleteSelectedPoint,
    resetZoom, zoomIn, zoomOut, handleWheel, handleMouseDown, handleMouseMove, handleMouseUp,
    getCanvasCoords, findNearestPoint, nudgeSelectedPoint,
    handleRetrace, handlePointMouseDown, handleCanvasMouseMove, handleCanvasMouseUp,
    updatePointCoord, selectAnchorByName, focusOnPoint, selectAndFocusAnchor, focusOnSelected,
    handleAnchorResizeStart, handleMinimapClick, newProject,
    processImageFile, selectRecentImage, startProjectFromImage,
    handleDragOver, handleDragLeave, handleDrop, handleFileSelect,
    handleGlobalDragOver, handleGlobalDrop,
  }), [
    zoom, pan, isPanning,
    tool, switchTool, penStrokeIndex, penLastPoint, penPreviewPos, finishPenStroke,
    bezierData, anchorsData, smoothStates, saveStatus, pathColor,
    selectedPoint, isDraggingPoint,
    showOriginal, showSilhouette, showPath, showHandles, showAnchors, showLabels, showGrid, showGuides,
    fillEnabled, fillPattern, fillWeights,
    animationModeEnabled, isAnimating, animationProgress, animationSpeed,
    showAnimationHandles, animationEasing, showAnimationAngles, handleOpacity, angleArcRadius, showAngleReference,
    openSections, toggleSection, searchQuery, showActionsMenu, anchorListHeight, isResizingAnchors,
    projectImage, showDropZone, isInitialLoad, isDragOver, traceOptions, traceInfo, imageWarnings, recentImages,
    isTracing, projectId, projectMeta, devTab, devLogs,
    connectionMap, strokesPath, pathLengthEstimate, revealedHandles, revealedAnchors,
    handleLines, controlPoints, anchorPoints, anchorLabels, staticAngleLabels,
    strokeGroups, strokeSummaries, hiddenStrokes, toggleStrokeVisibility, deleteStroke, focusOnStroke,
    sendAiMessage, aiStatus, aiActivity, aiError, clearAiActivity, stopAi,
    filteredAnchors, selectedPointData, showEditor, showDropScreen,
    traceImageSrc, displayImageSrc,
    undo, redo, quickSave, downloadJson, deleteSelectedPoint,
    resetZoom, zoomIn, zoomOut, handleWheel, handleMouseDown, handleMouseMove, handleMouseUp,
    getCanvasCoords, findNearestPoint, nudgeSelectedPoint,
    handleRetrace, handlePointMouseDown, handleCanvasMouseMove, handleCanvasMouseUp,
    updatePointCoord, selectAnchorByName, focusOnPoint, selectAndFocusAnchor, focusOnSelected,
    handleAnchorResizeStart, handleMinimapClick, newProject,
    processImageFile, selectRecentImage, startProjectFromImage, clearMousePos,
    handleDragOver, handleDragLeave, handleDrop, handleFileSelect,
    handleGlobalDragOver, handleGlobalDrop,
  ]);

  return <ShaperContext.Provider value={value}>{children}</ShaperContext.Provider>;
}

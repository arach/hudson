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
import { sounds } from '@hudson/sdk';
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
} from './types';
import {
  DEFAULT_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
  MAX_HISTORY,
  MAX_RECENT,
} from './types';

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
  mousePos: { screen: { x: number; y: number }; canvas: { x: number; y: number } } | null;
  setMousePos: React.Dispatch<React.SetStateAction<{ screen: { x: number; y: number }; canvas: { x: number; y: number } } | null>>;

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
  dropTraceError: number; setDropTraceError: React.Dispatch<React.SetStateAction<number>>;
  imageWarnings: ImageWarning[];
  setImageWarnings: React.Dispatch<React.SetStateAction<ImageWarning[]>>;
  recentImages: RecentImage[];
  traceError: number; setTraceError: React.Dispatch<React.SetStateAction<number>>;
  isTracing: boolean;

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
  handleWheel: (e: React.WheelEvent) => void;
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
  startProjectFromImage: (image: ProjectImage, tolerance: number) => Promise<void>;
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
export function ShaperProvider({ children }: { children: ReactNode }) {
  // ── Tools ──
  const [tool, setTool] = useState<Tool>('select');
  // ── Canvas/Viewport ──
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ screen: { x: number; y: number }; canvas: { x: number; y: number } } | null>(null);
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
  const [fillEnabled, setFillEnabled] = useState(false);
  const [fillPattern, setFillPattern] = useState<'solid' | 'dither' | 'halftone' | 'noise'>('solid');
  const [fillWeights, setFillWeights] = useState<Record<string, number>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [traceError, setTraceError] = useState(5);
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
  const [dropTraceError, setDropTraceError] = useState(5);
  const [imageWarnings, setImageWarnings] = useState<ImageWarning[]>([]);
  const [recentImages, setRecentImages] = useState<RecentImage[]>([]);

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

  const startProjectFromImage = useCallback(async (image: ProjectImage, tolerance: number) => {
    setIsTracing(true);
    try {
      const result = await traceFromImage(image.url, tolerance);
      if (result.length > 0 && result[0].length > 0) {
        setBezierData({ strokes: result });
        setSmoothStates({});
        setAnchorsData({ anchors: [] });
        historyRef.current = [JSON.stringify({ strokes: result })];
        historyIndexRef.current = 0;
        setZoom(DEFAULT_ZOOM);
        setPan({ x: 0, y: 0 });
        setSelectedPoint(null);
        setShowDropZone(false);
      } else {
        setImageWarnings((prev) => [...prev, { message: 'Trace produced no curves. Try adjusting error tolerance or use a higher-contrast image.', type: 'warn' }]);
      }
    } catch (err) {
      console.error('Trace error:', err);
      setImageWarnings((prev) => [...prev, { message: `Trace failed: ${err}`, type: 'warn' }]);
    } finally {
      setIsTracing(false);
    }
  }, []);

  const newProject = useCallback(() => {
    if (projectImage?.url.startsWith('blob:')) URL.revokeObjectURL(projectImage.url);
    setProjectImage(null);
    setBezierData(null);
    setAnchorsData(null);
    setSmoothStates({});
    setSelectedPoint(null);
    setImageWarnings([]);
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

  // ── Auto-load demo ──
  useEffect(() => {
    if (projectImage) return;
    Promise.all([
      fetch('/shaper/talkie-bezier.json').then((r) => r.json()),
      fetch('/shaper/talkie-anchors.json').then((r) => r.json()),
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
      const res = await fetch('/api/shaper/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bezier: data, smooth }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, []);

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
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Cmd/Ctrl+scroll is handled by Frame for workspace-level zoom — don't double-zoom
    if (e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (tool === 'hand' || e.button === 1 || e.altKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
    }
  }, [tool, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => { setIsPanning(false); }, []);

  // ── Anchor resize ──
  const handleAnchorResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingAnchors(true);
  }, []);

  const handleAnchorResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizingAnchors) return;
    setAnchorListHeight(prev => Math.max(100, Math.min(600, prev + e.movementY)));
  }, [isResizingAnchors]);

  const handleAnchorResizeEnd = useCallback(() => { setIsResizingAnchors(false); }, []);

  useEffect(() => {
    if (isResizingAnchors) {
      window.addEventListener('mousemove', handleAnchorResizeMove);
      window.addEventListener('mouseup', handleAnchorResizeEnd);
      return () => {
        window.removeEventListener('mousemove', handleAnchorResizeMove);
        window.removeEventListener('mouseup', handleAnchorResizeEnd);
      };
    }
  }, [isResizingAnchors, handleAnchorResizeMove, handleAnchorResizeEnd]);

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
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        const ddx = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        const ddy = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
        nudgeSelectedPoint(ddx, ddy, e.altKey, e.shiftKey);
      }
    };
    const keyup = (e: KeyboardEvent) => {
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
  const traceImageSrc = projectImage?.url || '/shaper/talkie-silhouette.png';
  const displayImageSrc = projectImage?.url || '/shaper/talkie-original.png';

  const handleRetrace = useCallback(async () => {
    setIsTracing(true);
    try {
      const result = await traceFromImage(traceImageSrc, traceError);
      if (result.length > 0 && result[0].length > 0) {
        setBezierData({ strokes: result });
        setSmoothStates({});
      }
    } catch (err) {
      console.error('Re-trace error:', err);
    } finally {
      setIsTracing(false);
    }
  }, [traceError, traceImageSrc]);

  // ── Canvas mouse handlers ──
  const handlePointMouseDown = useCallback((e: React.MouseEvent) => {
    if (tool === 'hand' || e.button === 1 || (tool !== 'pen' && e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
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
      setMousePos({ screen: { x: screenX, y: screenY }, canvas: { x: coords.x, y: coords.y } });
    }
    if (tool === 'pen') {
      const coords = getCanvasCoords(e);
      setPenPreviewPos([coords.x, coords.y]);
    }
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }
    if (isDraggingPoint && selectedPoint && dragStart) {
      const coords = getCanvasCoords(e);
      const dx = coords.x - dragStart.x;
      const dy = coords.y - dragStart.y;
      const isAltHeld = e.altKey;
      const isShiftHeld = e.shiftKey;
      setBezierData((prev) => {
        if (!prev) return prev;
        const newData = JSON.parse(JSON.stringify(prev));
        const { strokeIndex, segmentIndex, pointType } = selectedPoint;
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
      setDragStart(coords);
    }
  }, [isPanning, isDraggingPoint, selectedPoint, dragStart, getCanvasCoords, panStart, smoothStates, connectionMap, tool]);

  const handleCanvasMouseUp = useCallback(() => {
    setIsPanning(false);
    setIsDraggingPoint(false);
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
    const rect = containerRef.current.getBoundingClientRect();
    const targetZoom = Math.max(0.8, zoom);
    setZoom(targetZoom);
    setPan({ x: rect.width / 2 - x * targetZoom, y: rect.height / 2 - y * targetZoom });
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
    return bezierData.strokes.map((stroke) => {
      if (stroke.length === 0) return '';
      let d = `M ${stroke[0].p0[0]} ${stroke[0].p0[1]}`;
      for (const seg of stroke) {
        d += ` C ${seg.c1[0]} ${seg.c1[1]}, ${seg.c2[0]} ${seg.c2[1]}, ${seg.p3[0]} ${seg.p3[1]}`;
      }
      return d;
    }).join(' ');
  }, [bezierData]);

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
  }, [bezierData, showHandles, selectedPoint]);

  const controlPoints = useMemo(() => {
    if (!bezierData || !showHandles) return [];
    const points: ReactElement[] = [];
    bezierData.strokes.forEach((stroke, si) => {
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
  }, [bezierData, showHandles, selectedPoint]);

  const anchorPoints = useMemo(() => {
    if (!bezierData || !showAnchors) return [];
    const points: ReactElement[] = [];
    bezierData.strokes.forEach((stroke, si) => {
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
  }, [bezierData, showAnchors, selectedPoint, smoothStates]);

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
    dragStart, setDragStart, mousePos, setMousePos,
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
    isDragOver, setIsDragOver, dropTraceError, setDropTraceError,
    imageWarnings, setImageWarnings, recentImages,
    traceError, setTraceError, isTracing,
    devTab, setDevTab, devLogs, setDevLogs,
    canvasRef, containerRef, fileInputRef,
    connectionMap, strokesPath, pathLengthEstimate,
    revealedHandles, revealedAnchors,
    handleLines, controlPoints, anchorPoints, anchorLabels, staticAngleLabels,
    strokeGroups, filteredAnchors, selectedPointData, showEditor, showDropScreen,
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
    zoom, pan, isPanning, panStart, dragStart, mousePos,
    tool, switchTool, penStrokeIndex, penLastPoint, penPreviewPos, finishPenStroke,
    bezierData, anchorsData, smoothStates, saveStatus, pathColor,
    selectedPoint, isDraggingPoint,
    showOriginal, showSilhouette, showPath, showHandles, showAnchors, showLabels, showGrid, showGuides,
    fillEnabled, fillPattern, fillWeights,
    animationModeEnabled, isAnimating, animationProgress, animationSpeed,
    showAnimationHandles, animationEasing, showAnimationAngles, handleOpacity, angleArcRadius, showAngleReference,
    openSections, toggleSection, searchQuery, showActionsMenu, anchorListHeight, isResizingAnchors,
    projectImage, showDropZone, isInitialLoad, isDragOver, dropTraceError, imageWarnings, recentImages,
    traceError, isTracing, devTab, devLogs,
    connectionMap, strokesPath, pathLengthEstimate, revealedHandles, revealedAnchors,
    handleLines, controlPoints, anchorPoints, anchorLabels, staticAngleLabels,
    strokeGroups, filteredAnchors, selectedPointData, showEditor, showDropScreen,
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
  ]);

  return <ShaperContext.Provider value={value}>{children}</ShaperContext.Provider>;
}

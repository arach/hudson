'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { usePlatform, usePersistentState } from '@hudson/sdk';
import type { Asset, AssetEntry, DiscoveredImage } from './types';

// ── Context shape ─────────────────────────────────────────────────────────

interface AssetsState {
  assets: Asset[];
  selectedAssetId: string | null;
  selectedAsset: Asset | null;
  selectAsset: (id: string | null) => void;
  removeAsset: (id: string) => void;
  clearAll: () => void;
  addFromDataUrl: (dataUrl: string, name: string, source: Asset['source'], sourceUrl?: string) => void;
  addFromFile: (file: File) => Promise<void>;
  url: string;
  setUrl: (url: string) => void;
  discovering: boolean;
  discoveryError: string | null;
  discoverFromUrl: () => Promise<void>;
  discoveredImages: DiscoveredImage[] | null;
  discoveredPageTitle: string | null;
  showPicker: boolean;
  closePicker: () => void;
  importDiscovered: (urls: string[]) => Promise<void>;
  importing: boolean;
  /** Fetch the data URL for an asset (for port output / piping) */
  getDataUrl: (assetId: string) => Promise<string | null>;
}

const Ctx = createContext<AssetsState | null>(null);

export function useAssets() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAssets must be inside AssetsProvider');
  return ctx;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function nameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split('/').filter(Boolean).pop();
    if (last) return decodeURIComponent(last).slice(0, 60);
  } catch { /* ignore */ }
  return 'image';
}

function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = dataUrl;
  });
}

function dataUrlSize(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1];
  if (!base64) return 0;
  return Math.floor(base64.length * 0.75);
}

function contentTypeFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:([^;,]+)/);
  return match?.[1] ?? 'image/png';
}

/** Convert an AssetEntry from the API into an Asset with displayUrl. */
function entryToAsset(entry: AssetEntry, apiBase: string): Asset {
  return {
    ...entry,
    displayUrl: `${apiBase}/api/assets?file=${encodeURIComponent(entry.file)}`,
  };
}

// ── Provider ──────────────────────────────────────────────────────────────

export function AssetsProvider({ children }: { children: ReactNode }) {
  const { apiBaseUrl } = usePlatform();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = usePersistentState<string | null>('assets.selected', null);

  // URL bar
  const [url, setUrl] = usePersistentState<string>('assets.url', '');
  const [discovering, setDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  // Picker modal
  const [discoveredImages, setDiscoveredImages] = useState<DiscoveredImage[] | null>(null);
  const [discoveredPageTitle, setDiscoveredPageTitle] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [importing, setImporting] = useState(false);

  // Data URL cache (for port output)
  const dataUrlCache = useRef<Map<string, string>>(new Map());

  // ── Load from disk on mount ─────────────────────────────────────────
  const didLoad = useRef(false);
  useEffect(() => {
    if (didLoad.current) return;
    didLoad.current = true;

    fetch(`${apiBaseUrl}/api/assets`)
      .then(r => r.json())
      .then(data => {
        if (data.assets && Array.isArray(data.assets)) {
          setAssets(data.assets.map((e: AssetEntry) => entryToAsset(e, apiBaseUrl)));
        }
      })
      .catch(e => console.error('[Assets] failed to load manifest:', e));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Save asset to disk ──────────────────────────────────────────────
  const saveToApi = useCallback(async (asset: Asset, dataUrl: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: asset.id,
          name: asset.name,
          dataUrl,
          contentType: asset.contentType,
          size: asset.size,
          source: asset.source,
          sourceUrl: asset.sourceUrl,
          addedAt: asset.addedAt,
          width: asset.width,
          height: asset.height,
        }),
      });
      const data = await res.json();
      if (data.asset) {
        // Update the asset with the server-assigned filename
        return entryToAsset(data.asset, apiBaseUrl);
      }
    } catch (e) {
      console.error('[Assets] save failed:', e);
    }
    return asset;
  }, [apiBaseUrl]);

  // ── Core: add an asset ──────────────────────────────────────────────
  const addFromDataUrl = useCallback(async (
    dataUrl: string,
    name: string,
    source: Asset['source'],
    sourceUrl?: string,
  ) => {
    const dims = await getImageDimensions(dataUrl);
    const id = generateId();
    const ct = contentTypeFromDataUrl(dataUrl);
    const asset: Asset = {
      id,
      name,
      displayUrl: dataUrl, // temporary — will be replaced after save
      dataUrl,
      file: '',
      contentType: ct,
      size: dataUrlSize(dataUrl),
      source,
      sourceUrl,
      addedAt: Date.now(),
      ...dims,
    };

    // Cache the data URL
    dataUrlCache.current.set(id, dataUrl);

    // Optimistically add to state
    setAssets(prev => [asset, ...prev]);
    setSelectedAssetId(id);

    // Save to disk, then update with server file info
    const saved = await saveToApi(asset, dataUrl);
    setAssets(prev => prev.map(a => a.id === id ? saved : a));
  }, [saveToApi, setSelectedAssetId]);

  const addFromFile = useCallback(async (file: File) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        await addFromDataUrl(dataUrl, file.name, 'drop');
        resolve();
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }, [addFromDataUrl]);

  // ── Remove / clear ──────────────────────────────────────────────────
  const removeAsset = useCallback((id: string) => {
    setAssets(prev => prev.filter(a => a.id !== id));
    dataUrlCache.current.delete(id);
    setSelectedAssetId(prev => prev === id ? null : prev);
    // Delete from disk
    fetch(`${apiBaseUrl}/api/assets?id=${id}`, { method: 'DELETE' }).catch(() => {});
  }, [apiBaseUrl, setSelectedAssetId]);

  const clearAll = useCallback(() => {
    const ids = assets.map(a => a.id);
    setAssets([]);
    setSelectedAssetId(null);
    dataUrlCache.current.clear();
    // Delete all from disk
    for (const id of ids) {
      fetch(`${apiBaseUrl}/api/assets?id=${id}`, { method: 'DELETE' }).catch(() => {});
    }
  }, [assets, apiBaseUrl, setSelectedAssetId]);

  // ── Selection ───────────────────────────────────────────────────────
  const selectAsset = useCallback((id: string | null) => {
    setSelectedAssetId(id);
  }, [setSelectedAssetId]);

  const selectedAsset = assets.find(a => a.id === selectedAssetId) ?? null;

  // ── Get data URL (for port output) ──────────────────────────────────
  const getDataUrl = useCallback(async (assetId: string): Promise<string | null> => {
    // Check cache first
    const cached = dataUrlCache.current.get(assetId);
    if (cached) return cached;

    // Find the asset
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return null;

    // Fetch from API and convert to data URL
    try {
      const res = await fetch(asset.displayUrl);
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      dataUrlCache.current.set(assetId, dataUrl);
      return dataUrl;
    } catch {
      return null;
    }
  }, [assets]);

  // ── URL discovery ───────────────────────────────────────────────────
  const discoverFromUrl = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    setDiscovering(true);
    setDiscoveryError(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/discover-images?url=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);

      if (data.type === 'direct') {
        await addFromDataUrl(data.image.dataUrl, nameFromUrl(trimmed), 'url', trimmed);
      } else if (data.type === 'page') {
        setDiscoveredImages(data.images);
        setDiscoveredPageTitle(data.title ?? null);
        setShowPicker(true);
      }
    } catch (err) {
      setDiscoveryError(err instanceof Error ? err.message : String(err));
    } finally {
      setDiscovering(false);
    }
  }, [url, apiBaseUrl, addFromDataUrl]);

  // ── Import from picker ──────────────────────────────────────────────
  const importDiscovered = useCallback(async (urls: string[]) => {
    if (urls.length === 0) return;
    setImporting(true);

    try {
      const results = await Promise.allSettled(
        urls.map(async (imgUrl) => {
          if (imgUrl.startsWith('data:')) {
            await addFromDataUrl(imgUrl, 'inline.svg', 'url', url.trim());
            return;
          }
          const res = await fetch(`${apiBaseUrl}/api/fetch-image?url=${encodeURIComponent(imgUrl)}`);
          const data = await res.json();
          if (!res.ok || data.error) throw new Error(data.error);
          await addFromDataUrl(data.dataUrl, nameFromUrl(imgUrl), 'url', imgUrl);
        }),
      );

      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) {
        setDiscoveryError(`Imported ${urls.length - failed} of ${urls.length} images (${failed} failed)`);
      }
    } finally {
      setImporting(false);
      setShowPicker(false);
      setDiscoveredImages(null);
    }
  }, [apiBaseUrl, addFromDataUrl, url]);

  const closePicker = useCallback(() => {
    setShowPicker(false);
    setDiscoveredImages(null);
    setDiscoveredPageTitle(null);
  }, []);

  return (
    <Ctx.Provider
      value={{
        assets,
        selectedAssetId,
        selectedAsset,
        selectAsset,
        removeAsset,
        clearAll,
        addFromDataUrl,
        addFromFile,
        url,
        setUrl,
        discovering,
        discoveryError,
        discoverFromUrl,
        discoveredImages,
        discoveredPageTitle,
        showPicker,
        closePicker,
        importDiscovered,
        importing,
        getDataUrl,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

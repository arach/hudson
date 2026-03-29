/** A single asset in the library. */
export interface Asset {
  id: string;
  name: string;
  /** URL for displaying the asset (API-served or data URL) */
  displayUrl: string;
  /** Data URL — populated lazily for port output, may be null initially */
  dataUrl?: string;
  /** Filename on disk */
  file: string;
  contentType: string;
  size: number;
  source: 'drop' | 'paste' | 'url';
  sourceUrl?: string;
  addedAt: number;
  width?: number;
  height?: number;
}

/** Server-side manifest entry (matches API response). */
export interface AssetEntry {
  id: string;
  name: string;
  file: string;
  contentType: string;
  size: number;
  source: 'drop' | 'paste' | 'url';
  sourceUrl?: string;
  addedAt: number;
  width?: number;
  height?: number;
}

/** An image discovered by scraping a webpage. */
export interface DiscoveredImage {
  url: string;
  type: 'img' | 'svg' | 'og';
  alt?: string;
  inline?: string;
}

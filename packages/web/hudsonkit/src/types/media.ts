/**
 * Library-owned media descriptor used by the hudsonkit player.
 * Consumer-specific data (e.g. a video record, audio metadata, etc.) can ride
 * in `meta` without leaking into the library's API.
 */
export interface MediaItem<TMeta = unknown> {
  /** Stable identifier — used as the persistence key for position/queue. */
  id: string;
  kind: 'audio' | 'video';
  /** Resolved, playable URL (absolute or app-relative path the browser can fetch). */
  src: string;
  title?: string;
  artist?: string;
  /** Items shown on lock-screen / Bluetooth UIs via Media Session API. */
  artwork?: MediaImage[];
  /** Authoring-known duration in seconds (used as a fallback before metadata loads). */
  duration?: number;
  /** Optional consumer-specific payload — opaque to the library. */
  meta?: TMeta;
}

export type RepeatMode = 'off' | 'all' | 'one';

/** Persisted queue items — light IDs only, rehydrated on load via `resolveItem`. */
export interface StoredQueueItem {
  kind: 'audio' | 'video';
  id: string;
}

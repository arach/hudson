// hudsonkit/server — server-only helpers (HUD-008).
//
// Anything that imports node:* (fs, path, etc.) lives in this entrypoint and
// MUST NOT be imported from a client-bannered file. Built without
// `'use client'` and never bundled into the browser graph.
//
// `server-only` is a Vercel package whose only purpose is to throw at build
// time if this module is pulled into a React Client Component graph. It is
// the canonical Next-friendly guard; the tsup platform split + missing
// `'use client'` banner remain the primary defenses.
import 'server-only';

export { appStorage } from './lib/server/appStorage';
export type {
  AppStorage,
  AppStorageOptions,
  AppStoragePaths,
  AppStorageSeedOptions,
} from './lib/server/appStorage';

export { createFsWatchEventStream } from './lib/server/createFsWatchEventStream';
export type { CreateFsWatchEventStreamOptions } from './lib/server/createFsWatchEventStream';

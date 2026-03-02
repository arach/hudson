'use client';

import React, { createContext, useContext } from 'react';
import type { PlatformAdapter } from './types';
import { WEB_ADAPTER } from './defaults';

const PlatformContext = createContext<PlatformAdapter>(WEB_ADAPTER);

/** Wrap your app root to override platform defaults (e.g. Electrobun adapter). */
export function PlatformProvider({
  adapter,
  children,
}: {
  adapter: PlatformAdapter;
  children: React.ReactNode;
}) {
  return (
    <PlatformContext.Provider value={adapter}>
      {children}
    </PlatformContext.Provider>
  );
}

/** Read the active platform adapter. Falls back to WEB_ADAPTER. */
export function usePlatform(): PlatformAdapter {
  return useContext(PlatformContext);
}

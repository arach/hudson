'use client';

import { createContext, useContext, type ReactNode } from 'react';

export interface InstanceContextValue {
  instanceId: string;
  appId: string;
}

const InstanceContext = createContext<InstanceContextValue | null>(null);

export function InstanceProvider({
  instanceId,
  appId,
  children,
}: InstanceContextValue & { children: ReactNode }) {
  return (
    <InstanceContext.Provider value={{ instanceId, appId }}>
      {children}
    </InstanceContext.Provider>
  );
}

/** Returns the current instance, or null when rendered outside any Provider.
 *  Use this from library hooks (e.g. usePersistentState) that want to scope
 *  per-instance when available but fall back to a global key otherwise. */
export function useOptionalInstance(): InstanceContextValue | null {
  return useContext(InstanceContext);
}

/** Like useOptionalInstance, but throws when called outside a Provider. */
export function useInstance(): InstanceContextValue {
  const ctx = useContext(InstanceContext);
  if (!ctx) {
    throw new Error('useInstance() must be called inside an <InstanceProvider>');
  }
  return ctx;
}

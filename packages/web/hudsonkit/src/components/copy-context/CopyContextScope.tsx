'use client';

import React, { createContext, useContext, useMemo, useRef } from 'react';

interface CopyContextValue {
  /** Returns the scope's DOM root, or null if not yet mounted. */
  getNode: () => Element | null;
  /** Caller-provided override: if present, this is the canonical text and the walker is skipped. */
  getSource: (() => string) | null;
}

const CopyContextCtx = createContext<CopyContextValue | null>(null);

export interface CopyContextScopeProps {
  children: React.ReactNode;
  /** Optional override: return canonical markdown directly, bypass the DOM walker. */
  source?: () => string;
  /** Optional identifier echoed onto the wrapper as `data-copy-context-scope`. */
  scopeId?: string;
  className?: string;
}

export function CopyContextScope({
  children,
  source,
  scopeId,
  className,
}: CopyContextScopeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const value = useMemo<CopyContextValue>(
    () => ({
      getNode: () => ref.current,
      getSource: source ?? null,
    }),
    [source],
  );
  return (
    <CopyContextCtx.Provider value={value}>
      <div
        ref={ref}
        data-copy-context-scope={scopeId ?? ''}
        className={className}
      >
        {children}
      </div>
    </CopyContextCtx.Provider>
  );
}

export function useCopyContextScope(): CopyContextValue | null {
  return useContext(CopyContextCtx);
}

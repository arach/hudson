'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { useServiceRegistry } from '../../services/useServiceRegistry';

type Registry = ReturnType<typeof useServiceRegistry>;

interface ServicesState extends Registry {
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
}

const ServicesContext = createContext<ServicesState | null>(null);

export function ServicesProvider({ children }: { children: ReactNode }) {
  const registry = useServiceRegistry();
  const [selectedId, setSelectedId] = useState<string | null>(
    registry.catalog[0]?.id ?? null,
  );

  return (
    <ServicesContext.Provider value={{ ...registry, selectedId, setSelectedId }}>
      {children}
    </ServicesContext.Provider>
  );
}

export function useServices(): ServicesState {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error('useServices must be used within ServicesProvider');
  return ctx;
}

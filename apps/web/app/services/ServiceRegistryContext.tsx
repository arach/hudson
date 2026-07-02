'use client';

import { createContext, useContext } from 'react';
import type { useServiceRegistry } from './useServiceRegistry';

export type ServiceRegistryValue = ReturnType<typeof useServiceRegistry>;

const ServiceRegistryContext = createContext<ServiceRegistryValue | null>(null);

export function ServiceRegistryProvider({
  value,
  children,
}: {
  value: ServiceRegistryValue;
  children: React.ReactNode;
}) {
  return (
    <ServiceRegistryContext.Provider value={value}>
      {children}
    </ServiceRegistryContext.Provider>
  );
}

export function useServiceRegistryContext() {
  const ctx = useContext(ServiceRegistryContext);
  if (!ctx) throw new Error('useServiceRegistryContext must be used within ServiceRegistryProvider');
  return ctx;
}

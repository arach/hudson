'use client';
import { useMemo } from 'react';
import type { CommandOption } from '@hudson/sdk';
import { useLogo, type Variant } from './LogoProvider';

export function useLogoCommands(): CommandOption[] {
  const { setVariant, resetDefaults } = useLogo();
  return useMemo(() => [
    { id: 'logo:neg', label: 'Logo: Negative space variant', action: () => setVariant('negative-space') },
    { id: 'logo:green', label: 'Logo: Green channel variant', action: () => setVariant('green-channel') },
    { id: 'logo:grid', label: 'Logo: Grid color variant', action: () => setVariant('grid-color') },
    { id: 'logo:lock', label: 'Logo: Interlocking variant', action: () => setVariant('interlocking') },
    { id: 'logo:lattice', label: 'Logo: Lattice grid variant', action: () => setVariant('lattice-grid') },
    { id: 'logo:apps', label: 'Logo: App windows variant', action: () => setVariant('app-windows') },
    { id: 'logo:reset', label: 'Logo: Reset defaults', action: resetDefaults },
  ], [setVariant, resetDefaults]);
}

export function useLogoStatus() {
  const { params } = useLogo();
  const labels: Record<Variant, string> = {
    'negative-space': 'NEG SPACE',
    'green-channel': 'GREEN CH',
    'grid-color': 'GRID',
    'interlocking': 'INTERLOCK',
    'lattice-grid': 'LATTICE',
    'app-windows': 'APP WIN',
  };
  return { label: labels[params.variant], color: 'emerald' as const };
}

'use client';

import { ShaperMinimap } from './components/ShaperMinimap';
import { useShaper } from './ShaperProvider';

export function ShaperLeftFooter() {
  const { showEditor } = useShaper();
  if (!showEditor) return null;
  return <ShaperMinimap />;
}

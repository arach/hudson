'use client';

import { useEffect, useState } from 'react';

export type PointerState = { x: number; y: number; present: boolean };

export function usePointer(): PointerState {
  const [p, setP] = useState<PointerState>({ x: -9999, y: -9999, present: false });
  useEffect(() => {
    let raf = 0;
    let pending: PointerState | null = null;
    const onMove = (e: PointerEvent) => {
      pending = { x: e.clientX, y: e.clientY, present: true };
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          if (pending) setP(pending);
        });
      }
    };
    const onLeave = () => setP((p) => ({ ...p, present: false }));
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return p;
}

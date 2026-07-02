'use client';

import { Caliper } from './Caliper';
import { DraftingCursor } from './DraftingCursor';
import { LensMagnifier } from './LensMagnifier';

export { FxProvider, useFx, FX_DEFAULTS, type FxState, type FxContextValue } from './FxContext';
export { InlineDraftingToolbar } from './InlineDraftingToolbar';
export { PlotterReveal, type PlotterRevealProps } from './PlotterReveal';
export { ToolShelf } from './ToolShelf';

export function DraftingFxLayers() {
  return (
    <>
      <LensMagnifier />
      <DraftingCursor />
      <Caliper />
    </>
  );
}

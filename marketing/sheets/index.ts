import type { ComponentType } from 'react';
import { Sheet01Hero } from './Sheet01Hero';
import { Sheet02Possession } from './Sheet02Possession';
import { Sheet02HalfPlotter } from './Sheet02HalfPlotter';
import { Sheet03Voice } from './Sheet03Voice';
import { Sheet04Surfaces } from './Sheet04Surfaces';
import { Sheet05Apps } from './Sheet05Apps';
import { Sheet06Primitives } from './Sheet06Primitives';
import { Sheet07Quickstart } from './Sheet07Quickstart';

export type SheetEntry = {
  id: string;
  label: string;
  Component: ComponentType;
};

export const sheets: SheetEntry[] = [
  { id: 'hero', label: 'Hero', Component: Sheet01Hero },
  { id: 'possession', label: 'Live Workspace', Component: Sheet02Possession },
  { id: 'plotter', label: 'The Plotter', Component: Sheet02HalfPlotter },
  { id: 'voice', label: 'Voice Loop', Component: Sheet03Voice },
  { id: 'surfaces', label: 'Multi-Surface', Component: Sheet04Surfaces },
  { id: 'apps', label: 'Apps Gallery', Component: Sheet05Apps },
  { id: 'primitives', label: 'Primitives', Component: Sheet06Primitives },
  { id: 'quickstart', label: 'Quickstart', Component: Sheet07Quickstart },
];

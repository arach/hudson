/**
 * Inspect context — live embeds read selected region + report clicks.
 */

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import type { PaperSelection } from "./inspect";

export type PaperInspectContextValue = {
  /** Page currently being inspected (active map selection). */
  pageId: string | null;
  /** When true, pointer on the embed picks regions instead of pan/zoom. */
  inspectMode: boolean;
  selection: PaperSelection | null;
  selectRegion: (args: {
    pageId?: string;
    regionId: string;
    label: string;
    role: string | null;
    note: string | null;
    text: string | null;
  }) => void;
};

const PaperInspectContext = createContext<PaperInspectContextValue | null>(
  null,
);

export function PaperInspectProvider({
  value,
  children,
}: {
  value: PaperInspectContextValue;
  children: ReactNode;
}) {
  return (
    <PaperInspectContext.Provider value={value}>
      {children}
    </PaperInspectContext.Provider>
  );
}

export function usePaperInspect(): PaperInspectContextValue | null {
  return useContext(PaperInspectContext);
}

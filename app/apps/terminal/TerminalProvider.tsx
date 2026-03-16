'use client';

import { createContext, useContext, type ReactNode } from 'react';

interface TerminalState {
  label: string;
}

const Ctx = createContext<TerminalState>({ label: 'Terminal' });

export const useTerminal = () => useContext(Ctx);

export function TerminalProvider({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={{ label: 'Terminal' }}>{children}</Ctx.Provider>;
}

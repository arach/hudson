'use client';

import { createContext, useContext } from 'react';

export interface ShellLayout {
  leftWidth: number;
  rightWidth: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  isTerminalOpen: boolean;
  terminalHeight: number;
  isTerminalMaximized: boolean;
}

const ShellLayoutContext = createContext<ShellLayout>({
  leftWidth: 260,
  rightWidth: 280,
  leftCollapsed: false,
  rightCollapsed: false,
  isTerminalOpen: false,
  terminalHeight: 320,
  isTerminalMaximized: false,
});

export const ShellLayoutProvider = ShellLayoutContext.Provider;
export const useShellLayout = () => useContext(ShellLayoutContext);

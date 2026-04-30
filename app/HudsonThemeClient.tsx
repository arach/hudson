'use client';

import { ThemeProvider } from 'hudsonkit/theme';

export function HudsonThemeClient({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider storageKey="hudson.settings">
      {children}
    </ThemeProvider>
  );
}

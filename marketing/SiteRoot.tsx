import type { CSSProperties } from 'react';
import { GlobalAnimations } from '@/marketing/lib/animate';
import { DraftingFxLayers, FxProvider } from '@/marketing/lib/fx';
import { sheets } from '@/marketing/sheets';
import { StudioConsole } from '@/marketing/StudioConsole';
import { DEFAULTS, type StudioState } from '@/marketing/theme/defaults';
import { StudioProvider } from '@/marketing/theme/StudioContext';

interface SiteRootProps {
  themeStyle?: CSSProperties;
  initialState?: StudioState;
}

export function SiteRoot({ themeStyle, initialState }: SiteRootProps) {
  const paperId = initialState?.paper ?? DEFAULTS.paper;
  return (
    <StudioProvider initial={initialState}>
      <FxProvider>
        <main
          className="hudson-site"
          data-paper={paperId}
          style={themeStyle}
          suppressHydrationWarning
        >
          {sheets.map(({ id, Component }) => (
            <Component key={id} />
          ))}
          <StudioConsole />
          <GlobalAnimations />
          <DraftingFxLayers />
        </main>
      </FxProvider>
    </StudioProvider>
  );
}

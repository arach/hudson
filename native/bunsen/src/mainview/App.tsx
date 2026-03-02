import { lazy, Suspense } from 'react';
import { PlatformProvider } from '@hudson/sdk';
import type { PlatformAdapter } from '@hudson/sdk';

const ELECTROBUN: PlatformAdapter = {
  titleBarInset: 38,
  dragRegionProps: { className: 'electrobun-webkit-app-region-drag' },
  onInteractiveMouseDown: (e) => e.stopPropagation(),
  isSSR: false,
};

/**
 * Lazy-load the workspace shell + apps via dynamic import to break
 * a circular ESM chain (intent-explorer → registry → intent-explorer)
 * that causes TDZ errors with synchronous imports.
 */
const LazyShell = lazy(async () => {
  const [{ WorkspaceShell }, { hudsonDocsApp }, { intentExplorerApp }, { logoDesignerApp }] =
    await Promise.all([
      import('@hudson/shell/WorkspaceShell'),
      import('@hudson/apps/hudson-docs'),
      import('@hudson/apps/intent-explorer'),
      import('@hudson/apps/logo-designer'),
    ]);

  const workspace = {
    id: 'hudson-os',
    name: 'Hudson OS',
    mode: 'canvas' as const,
    apps: [
      { app: hudsonDocsApp, canvasMode: 'native' as const },
      {
        app: intentExplorerApp,
        canvasMode: 'windowed' as const,
        defaultWindowBounds: { x: 200, y: -200, w: 680, h: 500 },
      },
      {
        app: logoDesignerApp,
        canvasMode: 'windowed' as const,
        defaultWindowBounds: { x: 100, y: -200, w: 900, h: 700 },
      },
    ],
    defaultFocusedAppId: 'hudson-docs',
  };

  return {
    default: () => (
      <WorkspaceShell
        workspaces={[workspace]}
        defaultWorkspaceId="hudson-os"
        bootMode="full"
      />
    ),
  };
});

export default function App() {
  return (
    <PlatformProvider adapter={ELECTROBUN}>
      <Suspense>
        <LazyShell />
      </Suspense>
    </PlatformProvider>
  );
}

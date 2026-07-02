import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AppShell } from '../src/components/AppShell';
import {
  WorkspaceHostRoutesProvider,
  useWorkspaceHostRoutes,
  type WorkspaceHostRoutes,
} from '../src/workspace/hostRoutes';
import { defineApp } from '../src/lib/defineApp';

afterEach(() => {
  cleanup();
});

/** Build a minimal HudsonApp whose Content slot probes the host-routes hook
 *  from inside the shell (same context position as the Assistant / app code). */
function makeProbeApp(id: string) {
  const captured: { routes: WorkspaceHostRoutes | null } = { routes: null };
  function Content() {
    // eslint-disable-next-line react-hooks/immutability -- test probe: capturing the hook value into a spy record during render is the point of this fixture
    captured.routes = useWorkspaceHostRoutes();
    return <div data-testid={`content-${id}`}>probe</div>;
  }
  const app = defineApp({ id, name: `Probe ${id}`, slots: { Content } });
  return { app, captured };
}

describe('AppShell environment (host routes)', () => {
  it('provides environment.routes to components inside the shell', () => {
    const { app, captured } = makeProbeApp('env-routes');
    const routes: WorkspaceHostRoutes = {
      aiChat: '/api/ai/chat',
      speech: '/api/speech',
    };

    render(<AppShell app={app} managedTheme={false} environment={{ routes }} />);

    expect(screen.getByTestId('content-env-routes')).toBeInTheDocument();
    expect(captured.routes).toEqual({ aiChat: '/api/ai/chat', speech: '/api/speech' });
  });

  it('inherits an outer WorkspaceHostRoutesProvider when no environment prop is passed', () => {
    const { app, captured } = makeProbeApp('outer-provider');

    render(
      <WorkspaceHostRoutesProvider routes={{ aiChat: '/outer/ai/chat', services: '/outer/services' }}>
        <AppShell app={app} managedTheme={false} />
      </WorkspaceHostRoutesProvider>,
    );

    expect(captured.routes).toEqual({ aiChat: '/outer/ai/chat', services: '/outer/services' });
  });

  it('environment.routes wins over an outer provider for the shell subtree', () => {
    const { app, captured } = makeProbeApp('prop-wins');

    render(
      <WorkspaceHostRoutesProvider routes={{ aiChat: '/outer/ai/chat' }}>
        <AppShell
          app={app}
          managedTheme={false}
          environment={{ routes: { aiChat: '/inner/ai/chat' } }}
        />
      </WorkspaceHostRoutesProvider>,
    );

    expect(captured.routes).toEqual({ aiChat: '/inner/ai/chat' });
  });

  it('defaults to the empty route map with no prop and no provider (unconfigured host)', () => {
    const { app, captured } = makeProbeApp('no-config');

    render(<AppShell app={app} managedTheme={false} />);

    // The context default is {} — every route undefined, so server-backed
    // features (e.g. Assistant chat) report themselves unconfigured.
    expect(captured.routes).toEqual({});
    expect(captured.routes?.aiChat).toBeUndefined();
  });
});

import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  WorkspaceShell,
  type WorkspaceDeveloperTool,
  type WorkspaceShellEnvironment,
} from '../../../../packages/web/hudsonkit/src/workspace';
import {
  installShellDomPolyfills,
  installWorkspaceFetchMock,
  makeTestWorkspace,
  resetShellEnvironment,
  type WorkspaceFetchMock,
} from '../helpers/workspaceShellFixture';

installShellDomPolyfills();

const developerTools: readonly WorkspaceDeveloperTool[] = [
  {
    id: 'network',
    label: 'Network',
    render: () => <div data-testid="network-tool">network diagnostics</div>,
  },
];

function useTestDeveloperTools() {
  return developerTools;
}

const environment: WorkspaceShellEnvironment = {
  useDeveloperTools: useTestDeveloperTools,
};

let fetchMock: WorkspaceFetchMock | null = null;

beforeEach(() => {
  resetShellEnvironment();
  fetchMock = installWorkspaceFetchMock();
});

afterEach(() => {
  cleanup();
  fetchMock?.restore();
  fetchMock = null;
});

async function mountShell() {
  const fixture = makeTestWorkspace();
  render(
    <WorkspaceShell
      workspaces={[fixture.workspace]}
      defaultWorkspaceId="test"
      bootMode="none"
      persistSession={false}
      environment={environment}
    />,
  );
  await act(async () => {});
}

describe('WorkspaceShell developer tools', () => {
  it('renders host tools inside the shared console drawer', async () => {
    await mountShell();

    fireEvent.click(screen.getByTitle('Toggle Console (Ctrl+`)'));
    const networkTab = screen.getByRole('button', { name: 'Network' });
    expect(networkTab).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(networkTab);
    expect(networkTab).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('network-tool')).toHaveTextContent('network diagnostics');

    fireEvent.click(screen.getByRole('button', { name: 'LOGS' }));
    expect(screen.queryByTestId('network-tool')).not.toBeInTheDocument();
  });

  it('routes the existing log status item into the console Logs tab', async () => {
    await mountShell();

    fireEvent.click(screen.getByRole('button', { name: 'Open Agent Actions' }));
    expect(screen.getByRole('button', { name: 'LOGS' })).toHaveAttribute('aria-pressed', 'true');
  });
});

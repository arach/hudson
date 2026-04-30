import { describe, expect, it } from 'vitest';
import { loadToolset } from '@/app/api/ai/toolsets';

describe('workspace toolset', () => {
  it('exposes generalized workspace-control tools', () => {
    const { tools, toolPrompt } = loadToolset('workspace', {});

    expect(Object.keys(tools)).toEqual(expect.arrayContaining([
      'run_command',
      'set_app_setting',
      'set_shell_setting',
      'set_app_state',
      'service_action',
      'set_environment_variable',
      'delete_environment_variable',
      'push_pipe',
      'delete_pipe',
      'create_pipe',
    ]));

    expect(toolPrompt).toContain('### run_command');
    expect(toolPrompt).toContain('### set_environment_variable');
  });

  it('renders live commands, settings, services, and pipes into the system prompt', () => {
    const { system } = loadToolset('workspace', {
      workspace: {
        id: 'hudson-os',
        name: 'HudsonKit',
        mode: 'canvas',
        focusedAppId: 'logo-designer',
        visibleAppIds: ['logo-designer'],
        disabledAppIds: ['intent-explorer'],
        availableWorkspaces: [
          { id: 'hudson-os', name: 'HudsonKit', current: true },
          { id: 'docs', name: 'Docs' },
        ],
      },
      apps: [
        {
          id: 'logo-designer',
          name: 'Logo Designer',
          mode: 'panel',
          canvasMode: 'windowed',
          visible: true,
          disabled: false,
          focused: true,
          ports: {
            inputs: [{ id: 'template' }],
            outputs: [{ id: 'svg' }],
          },
          tools: [{ id: 'grid', name: 'Grid' }],
          status: { label: 'READY', color: 'emerald' },
          services: [{ serviceId: 'vox' }],
        },
      ],
      commands: [
        {
          id: 'shell:environment',
          label: 'Environment',
          scope: 'shell',
          description: 'Open Hudson\'s environment panel.',
        },
        {
          id: 'logo:variant',
          label: 'Switch Variant',
          scope: 'app',
          appId: 'logo-designer',
          appName: 'Logo Designer',
          description: 'Switch the active logo variant.',
        },
      ],
      appSettings: [
        {
          appId: 'logo-designer',
          appName: 'Logo Designer',
          sections: [
            {
              label: 'Layout',
              fields: [
                {
                  key: 'gapWidth',
                  label: 'Gap Width',
                  type: 'slider',
                  current: 24,
                  default: 20,
                  min: 0,
                  max: 80,
                  step: 1,
                },
              ],
            },
          ],
        },
      ],
      shellSettings: {
        aiMode: 'api',
        voice: {
          autoSend: true,
          speakReplies: true,
        },
      },
      services: [
        {
          id: 'vox',
          name: 'Vox',
          description: 'Speech service',
          status: 'running',
        },
      ],
      pipes: [
        {
          name: 'Fetch -> Logo',
          enabled: true,
          source: { appId: 'fetch', portId: 'image' },
          sink: { appId: 'logo-designer', portId: 'template' },
        },
      ],
      environment: {
        manageable: true,
        path: '.env.local',
      },
    });

    expect(system).toContain('## Workspace');
    expect(system).toContain('## Apps');
    expect(system).toContain('## Live Commands');
    expect(system).toContain('shell:environment');
    expect(system).toContain('## App Settings');
    expect(system).toContain('gapWidth');
    expect(system).toContain('## Shell Settings');
    expect(system).toContain('## Services');
    expect(system).toContain('## Pipes');
    expect(system).toContain('Fetch -> Logo');
    expect(system).toContain('## Environment');
  });
});

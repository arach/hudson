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
        focusedAppId: 'document-lab',
        visibleAppIds: ['document-lab'],
        disabledAppIds: ['intent-explorer'],
        availableWorkspaces: [
          { id: 'hudson-os', name: 'HudsonKit', current: true },
          { id: 'docs', name: 'Docs' },
        ],
      },
      apps: [
        {
          id: 'document-lab',
          name: 'Document Lab',
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
          id: 'document-lab:preview',
          label: 'Toggle Preview',
          scope: 'app',
          appId: 'document-lab',
          appName: 'Document Lab',
          description: 'Toggle the active document preview.',
        },
      ],
      appSettings: [
        {
          appId: 'document-lab',
          appName: 'Document Lab',
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
          name: 'Fetch -> Document',
          enabled: true,
          source: { appId: 'fetch', portId: 'image' },
          sink: { appId: 'document-lab', portId: 'markdown' },
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
    expect(system).toContain('Fetch -> Document');
    expect(system).toContain('## Environment');
  });
});

export interface HudsonAIPromptPreset {
  id: string;
  title: string;
  description: string;
  text: string;
}

export interface HudsonAIActionDescriptor {
  id: string;
  label: string;
  description: string;
}

export const HUDSON_AI_PROMPT_PRESETS: HudsonAIPromptPreset[] = [
  {
    id: 'workspace-sweep',
    title: 'Workspace Sweep',
    description: 'Summarize the current workspace, visible apps, and the highest-leverage next actions.',
    text: 'Audit the current workspace for me. Summarize the visible apps, key capabilities, and the top three useful actions you can take right now.',
  },
  {
    id: 'capability-audit',
    title: 'Capability Audit',
    description: 'Inspect the live commands, settings, services, and pipes Hudson AI has ingested.',
    text: 'List the live commands, app settings, services, and pipes currently available to you. Group them by app and call out any obvious gaps.',
  },
  {
    id: 'layout-review',
    title: 'Layout Review',
    description: 'Ask Hudson AI to analyze the current workspace arrangement and improve it.',
    text: 'Review the current workspace layout and visible apps. Suggest a cleaner arrangement, then apply it if the actions are available to you.',
  },
  {
    id: 'voice-review',
    title: 'Voice Review',
    description: 'Check the current voice + spoken-reply setup and explain what is configured.',
    text: 'Review the current Hudson AI voice configuration, reply model, and spoken-reply behavior. Explain what is configured and what you would improve.',
  },
  {
    id: 'app-walkthrough',
    title: 'App Walkthrough',
    description: 'Have Hudson AI explain what each current app can do based on the ingested commands and settings.',
    text: 'Walk me through the currently ingested workspace apps. For each one, summarize what you understand it can do from its commands, settings, tools, and ports.',
  },
];

export const HUDSON_AI_ACTIONS: HudsonAIActionDescriptor[] = [
  {
    id: 'run-command',
    label: 'Run Commands',
    description: 'Invoke any live shell or app command that Hudson has ingested from the workspace.',
  },
  {
    id: 'edit-settings',
    label: 'Edit Settings',
    description: 'Change app settings and shell settings through the same bridges used by Hudson itself.',
  },
  {
    id: 'manage-apps',
    label: 'Manage Apps',
    description: 'Show, hide, focus, or disable apps inside the current workspace.',
  },
  {
    id: 'operate-services',
    label: 'Operate Services',
    description: 'Check, start, stop, or install workspace services when the service bridge is available.',
  },
  {
    id: 'work-pipes',
    label: 'Work Pipes',
    description: 'Inspect, create, push, and delete pipes that move data between Hudson apps.',
  },
  {
    id: 'manage-env',
    label: 'Manage Environment',
    description: 'Set or remove local .env.local values through Hudson’s environment surface.',
  },
  {
    id: 'generate-assets',
    label: 'Generate Assets',
    description: 'Generate images or create logo templates when those tool paths are available.',
  },
];

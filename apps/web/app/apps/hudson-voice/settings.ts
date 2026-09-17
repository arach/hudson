import type { AppSettingsConfig } from 'hudsonkit';

// Every AppSettingField type renders a writable control, so this config only
// carries preferences the view actually honors. Provider, model, voice, and
// credentials are server-owned (environment-configured) and are surfaced
// read-only inside the app's session readiness card — never as an input here.
export const hudsonVoiceSettings: AppSettingsConfig = {
  sections: [
    {
      label: 'Conversation Surface',
      fields: [
        {
          key: 'showToolActivity',
          label: 'Tool Activity',
          description:
            'Show tool calls in a rail beside the transcript. Interrupting playback never cancels a running tool.',
          type: 'toggle',
          default: true,
        },
        {
          key: 'followTranscript',
          label: 'Follow Transcript',
          description: 'Keep the newest turn in view while a session is live.',
          type: 'toggle',
          default: true,
        },
      ],
    },
  ],
};

import type { HudWorkflowDocument, HudWorkflowFixture, HudWorkflowSchema } from './types';

const input = (id = 'in', label = 'In') => ({ id, label, role: 'input' as const });
const output = (id = 'out', label = 'Out') => ({ id, label, role: 'output' as const });

export const hudWorkflowBasicSchema: HudWorkflowSchema = {
  nodeTypes: [
    {
      id: 'input',
      label: 'Input',
      category: 'Source',
      tint: 'cyan',
      defaultInputs: [],
      defaultOutputs: [output()],
      fields: [
        { id: 'source', label: 'Source', type: 'string' },
      ],
    },
    {
      id: 'llm',
      label: 'LLM',
      category: 'AI',
      tint: 'teal',
      defaultInputs: [input()],
      defaultOutputs: [output()],
      fields: [
        { id: 'provider', label: 'Provider', type: 'string' },
        { id: 'modelId', label: 'Model', type: 'string' },
        { id: 'prompt', label: 'Prompt', type: 'text' },
        { id: 'temperature', label: 'Temperature', type: 'number' },
      ],
    },
    {
      id: 'transcribe',
      label: 'Transcribe',
      category: 'Media',
      tint: 'blue',
      defaultInputs: [input()],
      defaultOutputs: [output()],
      fields: [
        { id: 'qualityTier', label: 'Quality tier', type: 'picker' },
        { id: 'fallbackStrategy', label: 'Fallback strategy', type: 'picker' },
      ],
    },
    {
      id: 'conditional',
      label: 'Conditional',
      category: 'Logic',
      tint: 'amber',
      defaultInputs: [input()],
      defaultOutputs: [output('true', 'True'), output('false', 'False')],
      fields: [
        { id: 'expression', label: 'Expression', type: 'text' },
      ],
    },
    {
      id: 'appleReminders',
      label: 'Apple Reminders',
      category: 'Action',
      tint: 'emerald',
      defaultInputs: [input()],
      defaultOutputs: [output()],
      fields: [
        { id: 'listName', label: 'List', type: 'string' },
      ],
    },
    {
      id: 'iOSPush',
      label: 'iOS Push',
      category: 'Action',
      tint: 'emerald',
      defaultInputs: [input()],
      fields: [
        { id: 'title', label: 'Title', type: 'string' },
        { id: 'body', label: 'Body', type: 'text' },
      ],
    },
    {
      id: 'cloudUpload',
      label: 'Cloud Upload',
      category: 'Action',
      tint: 'blue',
      defaultInputs: [input()],
      defaultOutputs: [output()],
      fields: [
        { id: 'bucket', label: 'Bucket', type: 'string' },
        { id: 'includeTranscript', label: 'Include transcript', type: 'boolean' },
      ],
    },
  ],
};

function linearConnection(
  sourceNodeID: string,
  targetNodeID: string,
  sourcePortID = 'out',
  targetPortID = 'in',
  label?: string,
) {
  return {
    id: `${sourceNodeID}:${sourcePortID}->${targetNodeID}:${targetPortID}`,
    sourceNodeID,
    sourcePortID,
    targetNodeID,
    targetPortID,
    label,
  };
}

export const quickSummaryWorkflow: HudWorkflowDocument = {
  id: 'fixture.quick-summary',
  title: 'Quick Summary',
  metadata: {
    sourceFormat: 'fixture',
    slug: 'quick-summary',
    description: 'Generate a concise executive summary from a transcript.',
    icon: 'list.bullet.clipboard',
    color: 'blue',
    isEnabled: true,
    isPinned: true,
    autoRun: false,
  },
  viewport: { pan: { x: 0, y: 0 }, scale: 1 },
  nodes: [
    {
      id: 'transcript',
      typeID: 'input',
      title: 'Transcript',
      subtitle: 'Memo text input',
      position: { x: 40, y: 160 },
      size: { width: 220, height: 122 },
      inputs: [],
      outputs: [output()],
      fieldValues: { source: 'TRANSCRIPT' },
    },
    {
      id: 'summary',
      typeID: 'llm',
      title: 'Summarize',
      subtitle: 'Gemini quick pass',
      position: { x: 360, y: 140 },
      size: { width: 250, height: 150 },
      outputKey: 'summary',
      fieldValues: {
        provider: 'gemini',
        modelId: 'gemini-2.0-flash',
        prompt: 'Summarize: {{TRANSCRIPT}}',
        temperature: 0.2,
      },
    },
  ],
  connections: [linearConnection('transcript', 'summary')],
};

export const brainDumpProcessorWorkflow: HudWorkflowDocument = {
  id: 'fixture.brain-dump-processor',
  title: 'Brain Dump Processor',
  metadata: {
    sourceFormat: 'fixture',
    slug: 'brain-dump-processor',
    description: 'Turn an unstructured memo into summary, actions, and reminders.',
    icon: 'brain.head.profile',
    color: 'teal',
    isEnabled: true,
    isPinned: true,
    autoRun: true,
    autoRunOrder: 20,
  },
  viewport: { pan: { x: -80, y: 0 }, scale: 0.95 },
  nodes: [
    {
      id: 'memo',
      typeID: 'input',
      title: 'Memo',
      subtitle: 'Raw voice capture',
      position: { x: 40, y: 220 },
      size: { width: 220, height: 122 },
      inputs: [],
      outputs: [output()],
      fieldValues: { source: 'MEMO' },
    },
    {
      id: 'extract',
      typeID: 'llm',
      title: 'Extract Structure',
      subtitle: 'Summary + task candidates',
      position: { x: 350, y: 90 },
      size: { width: 260, height: 154 },
      outputKey: 'structuredNotes',
      fieldValues: {
        provider: 'openai',
        modelId: 'gpt-5.1-mini',
        prompt: 'Extract summary, decisions, and todos from {{MEMO}}.',
        temperature: 0.1,
      },
    },
    {
      id: 'has-actions',
      typeID: 'conditional',
      title: 'Has Actions?',
      subtitle: 'Runtime currently remains linear',
      position: { x: 700, y: 190 },
      size: { width: 250, height: 142 },
      condition: 'structuredNotes.todos.length > 0',
      fieldValues: {
        expression: 'structuredNotes.todos.length > 0',
        thenSteps: ['reminders'],
        elseSteps: ['notify'],
      },
      outputs: [output('true', 'True'), output('false', 'False')],
    },
    {
      id: 'reminders',
      typeID: 'appleReminders',
      title: 'Create Reminders',
      subtitle: 'Only if todos exist',
      position: { x: 1040, y: 70 },
      size: { width: 250, height: 132 },
      outputKey: 'createdReminderIDs',
      condition: 'structuredNotes.todos.length > 0',
      fieldValues: {
        listName: 'Hudson',
        items: ['{{structuredNotes.todos}}'],
      },
    },
    {
      id: 'notify',
      typeID: 'iOSPush',
      title: 'Notify',
      subtitle: 'Summary ready',
      position: { x: 1040, y: 320 },
      size: { width: 250, height: 132 },
      fieldValues: {
        title: 'Brain dump processed',
        body: '{{structuredNotes.summary}}',
      },
    },
  ],
  connections: [
    linearConnection('memo', 'extract'),
    linearConnection('extract', 'has-actions'),
    linearConnection('has-actions', 'reminders', 'true', 'in', 'thenSteps'),
    linearConnection('has-actions', 'notify', 'false', 'in', 'elseSteps'),
  ],
};

export const voiceAssistantWorkflow: HudWorkflowDocument = {
  id: 'fixture.voice-assistant',
  title: 'Voice Assistant',
  metadata: {
    sourceFormat: 'fixture',
    slug: 'voice-assistant',
    description: 'Route a spoken request into a short response and optional phone notification.',
    icon: 'waveform',
    color: 'cyan',
    isEnabled: true,
    isPinned: false,
    autoRun: true,
    autoRunOrder: 10,
  },
  viewport: { pan: { x: -20, y: 0 }, scale: 1 },
  nodes: [
    {
      id: 'audio',
      typeID: 'input',
      title: 'Audio Capture',
      subtitle: 'Wake phrase session',
      position: { x: 40, y: 130 },
      size: { width: 220, height: 122 },
      inputs: [],
      outputs: [output()],
      fieldValues: { source: 'AUDIO' },
    },
    {
      id: 'transcribe',
      typeID: 'transcribe',
      title: 'Transcribe',
      subtitle: 'Quality tier + fallback',
      position: { x: 340, y: 130 },
      size: { width: 240, height: 136 },
      outputKey: 'transcript',
      fieldValues: {
        qualityTier: 'balanced',
        fallbackStrategy: 'local-then-cloud',
      },
    },
    {
      id: 'reply',
      typeID: 'llm',
      title: 'Draft Reply',
      subtitle: 'Short spoken response',
      position: { x: 660, y: 115 },
      size: { width: 250, height: 150 },
      outputKey: 'replyText',
      fieldValues: {
        provider: 'openai',
        modelId: 'gpt-5.1-mini',
        prompt: 'Answer conversationally in two sentences: {{transcript}}',
        temperature: 0.4,
      },
    },
    {
      id: 'push',
      typeID: 'iOSPush',
      title: 'Push Follow-up',
      subtitle: 'Disabled fixture node',
      position: { x: 980, y: 115 },
      size: { width: 240, height: 136 },
      isEnabled: false,
      fieldValues: {
        title: 'Voice reply',
        body: '{{replyText}}',
      },
    },
  ],
  connections: [
    linearConnection('audio', 'transcribe'),
    linearConnection('transcribe', 'reply'),
    linearConnection('reply', 'push'),
  ],
};

export const transcribeWorkflow: HudWorkflowDocument = {
  id: 'fixture.transcribe',
  title: 'Transcribe',
  metadata: {
    sourceFormat: 'fixture',
    slug: 'transcribe',
    description: 'Transcribe an audio memo and upload transcript plus source metadata.',
    icon: 'text.bubble',
    color: 'emerald',
    isEnabled: true,
    isPinned: false,
    autoRun: false,
  },
  viewport: { pan: { x: 0, y: 0 }, scale: 1 },
  nodes: [
    {
      id: 'audio-file',
      typeID: 'input',
      title: 'Audio File',
      subtitle: 'Local recording',
      position: { x: 40, y: 160 },
      size: { width: 220, height: 122 },
      inputs: [],
      outputs: [output()],
      fieldValues: { source: 'AUDIO_FILE' },
    },
    {
      id: 'transcribe',
      typeID: 'transcribe',
      title: 'Transcribe',
      subtitle: 'High quality',
      position: { x: 360, y: 145 },
      size: { width: 250, height: 144 },
      outputKey: 'transcript',
      fieldValues: {
        qualityTier: 'high',
        fallbackStrategy: 'cloud-only',
      },
    },
    {
      id: 'upload',
      typeID: 'cloudUpload',
      title: 'Upload Transcript',
      subtitle: 'Transcript archive',
      position: { x: 700, y: 145 },
      size: { width: 250, height: 144 },
      outputKey: 'uploadURL',
      fieldValues: {
        bucket: 'voice-transcripts',
        includeTranscript: true,
        metadata: {
          workflow: 'transcribe',
          source: 'macos',
        },
      },
    },
  ],
  connections: [
    linearConnection('audio-file', 'transcribe'),
    linearConnection('transcribe', 'upload'),
  ],
};

export const hudWorkflowFixtures: HudWorkflowFixture[] = [
  {
    id: 'quick-summary',
    label: 'Quick Summary',
    description: 'Linear LLM workflow with a load-bearing output key.',
    document: quickSummaryWorkflow,
  },
  {
    id: 'brain-dump-processor',
    label: 'Brain Dump Processor',
    description: 'Conditional declarations and action branches without runtime execution claims.',
    document: brainDumpProcessorWorkflow,
  },
  {
    id: 'voice-assistant',
    label: 'Voice Assistant',
    description: 'Transcription, spoken reply, and a disabled notification node.',
    document: voiceAssistantWorkflow,
  },
  {
    id: 'transcribe',
    label: 'Transcribe',
    description: 'Current transcribe config vocabulary with typed upload fields.',
    document: transcribeWorkflow,
  },
];

import type { DecorationItem } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Build-sequence seed for the `hudson-os` workspace.
// Mirrors the schematic in marketing/sheets/Sheet02Possession.tsx (the mock
// embed) so the live workspace opens with the same beat.
// ─────────────────────────────────────────────────────────────────────────────

export const HUDSON_OS_SEED: DecorationItem[] = [
  {
    id: 'seed-eyebrow',
    type: 'text',
    subtype: 'eyebrow',
    text: '— Hudson app',
    x: -520,
    y: -640,
    w: 720,
    h: 28,
  },
  {
    id: 'seed-title',
    type: 'text',
    subtype: 'display-title',
    text: 'This component is a Hudson embed.',
    accent: 'Hudson embed.',
    x: -520,
    y: -600,
    w: 720,
    h: 80,
  },
  {
    id: 'seed-body',
    type: 'text',
    subtype: 'body',
    text:
      'Everything you see around this text — nav, panels, status, the chrome — is a real Hudson primitive. Same shell any app inherits.',
    x: -520,
    y: -510,
    w: 720,
    h: 60,
  },
  {
    id: 'seed-divider',
    type: 'text',
    subtype: 'divider',
    text: 'BUILD SEQUENCE  ·  DECLARE → WIRE → COMPOSE → RUN',
    x: -520,
    y: -440,
    w: 720,
    h: 24,
  },
  {
    id: 'seed-step-1',
    type: 'step-card',
    step: '01',
    verb: 'DECLARE',
    body: 'typed manifest',
    code: "{ id: 'talkie',\n  mode: 'canvas' }",
    x: -520,
    y: -400,
    w: 350,
    h: 180,
  },
  {
    id: 'seed-step-2',
    type: 'step-card',
    step: '02',
    verb: 'WIRE',
    body: 'intents indexed',
    code: '→ ⌘K\n→ voice',
    x: -150,
    y: -400,
    w: 350,
    h: 180,
  },
  {
    id: 'seed-step-3',
    type: 'step-card',
    step: '03',
    verb: 'COMPOSE',
    body: 'drop primitives',
    code: '<Frame>\n  <Nav/>\n</Frame>',
    x: -520,
    y: -200,
    w: 350,
    h: 180,
  },
  {
    id: 'seed-step-4',
    type: 'step-card',
    step: '04',
    verb: 'RUN',
    body: 'standard dev',
    code: '$ bun dev',
    x: -150,
    y: -200,
    w: 350,
    h: 180,
  },
];

export const SEED_BY_WORKSPACE: Record<string, DecorationItem[]> = {
  'hudson-os': HUDSON_OS_SEED,
};

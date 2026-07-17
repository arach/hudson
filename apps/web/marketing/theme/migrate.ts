import { ACCENT_IDS, DEFAULTS, type StudioState } from './defaults';

/* The console persists a full snapshot. Exact former defaults and the former
   Ink preset are safe to advance to the new baked baseline; any deviation is
   a real user choice and remains untouched. */
const LEGACY_EMERALD_DEFAULTS: StudioState = {
  display: 'cormorant',
  body: 'space-grotesk',
  mono: 'jetbrains',
  accent: 'emerald',
  paper: 'slate',
  gridMinor: 0.18,
  gridMajor: 0.3,
  strokeW: 1.5,
  radiusUI: 0,
  radiusCard: 0,
  bodyWeight: 300,
  audio: false,
  audioUI: true,
  audioCount: true,
  audioType: true,
  audioPage: false,
  snap: false,
  grain: false,
};

const LEGACY_AZURE_DEFAULTS: StudioState = {
  ...LEGACY_EMERALD_DEFAULTS,
  accent: 'azure',
};

const LEGACY_INK_PRESET: StudioState = {
  ...LEGACY_EMERALD_DEFAULTS,
  display: 'newsreader',
  accent: 'amber',
};

const REPLACED_BASELINES = [
  LEGACY_EMERALD_DEFAULTS,
  LEGACY_AZURE_DEFAULTS,
  LEGACY_INK_PRESET,
] as const;

function matchesSnapshot(state: Partial<StudioState>, snapshot: StudioState): boolean {
  const keys = Object.keys(snapshot) as (keyof StudioState)[];
  return keys.every((key) => state[key] === snapshot[key]);
}

export function migrateStudioState(parsed: Partial<StudioState>): {
  state: Partial<StudioState>;
  changed: boolean;
} {
  const state: Partial<StudioState> = { ...parsed };
  let changed = false;

  if (REPLACED_BASELINES.some((baseline) => matchesSnapshot(state, baseline))) {
    return { state: { ...DEFAULTS }, changed: true };
  }

  /* Accents removed from the catalog (e.g. violet) — normalize to the
     current default instead of leaving a dangling id that every renderer
     falls back on independently. */
  if (state.accent !== undefined && !ACCENT_IDS.includes(state.accent)) {
    state.accent = DEFAULTS.accent;
    changed = true;
  }

  return { state, changed };
}

---
title: Settings
description: Declarative app-level settings schema with persisted values via useAppSettings
order: 9
---

# Settings

## Overview

App-level settings are declared as a schema of typed fields organized into named sections. Attach the schema to your `HudsonApp` via `settings?: AppSettingsConfig` so it travels with the app definition (and is available to any consumer rendering a settings UI). Values are persisted to localStorage per app and read back via the `useAppSettings` hook inside your `Provider`. Rendering the actual settings UI is your call — pair the schema with the `Param*` controls from [`hudsonkit/controls`](./controls.md) for a quick match.

## Declaring settings

```ts
// app/notepad/settings.ts
import type { AppSettingsConfig } from 'hudsonkit';

export const notepadSettings: AppSettingsConfig = {
  sections: [
    {
      label: 'Appearance',
      fields: [
        {
          key: 'fontFamily',
          label: 'Font family',
          type: 'select',
          default: 'mono',
          options: [
            { value: 'mono', label: 'Monospace' },
            { value: 'sans', label: 'Sans-serif' },
            { value: 'serif', label: 'Serif' },
          ],
        },
        {
          key: 'fontSize',
          label: 'Font size',
          type: 'slider',
          default: 14,
          min: 10,
          max: 32,
          step: 1,
          format: v => `${v}px`,
        },
        {
          key: 'lineSpacing',
          label: 'Line spacing',
          type: 'segment',
          default: 'normal',
          options: [
            { value: 'compact', label: 'Compact' },
            { value: 'normal', label: 'Normal' },
            { value: 'relaxed', label: 'Relaxed' },
          ],
        },
        {
          key: 'darkMode',
          label: 'Dark mode',
          type: 'toggle',
          default: false,
        },
      ],
    },
    {
      label: 'Behavior',
      fields: [
        {
          key: 'autosaveInterval',
          label: 'Autosave interval (s)',
          type: 'number',
          default: 30,
          min: 5,
          max: 300,
          step: 5,
        },
        {
          key: 'defaultTitle',
          label: 'Default note title',
          type: 'text',
          default: 'Untitled',
        },
      ],
    },
  ],
};
```

Attach to the app:

```ts
// app/notepad/index.tsx
import { notepadSettings } from './settings';

export const notepadApp: HudsonApp = {
  id: 'notepad',
  name: 'Notepad',
  mode: 'panel',
  Provider: NotepadProvider,
  slots: { Content: NotepadContent },
  hooks: { useCommands, useStatus },
  settings: notepadSettings,
};
```

## AppSettingField shape

| name | type | required | applies to |
|---|---|---|---|
| `key` | `string` | yes | all |
| `label` | `string` | yes | all |
| `type` | `'text' \| 'number' \| 'toggle' \| 'slider' \| 'segment' \| 'select'` | yes | all |
| `default` | `string \| number \| boolean` | yes | all |
| `options` | `{ value: string; label: string }[]` | no | `segment`, `select` |
| `min` | `number` | no | `slider`, `number` |
| `max` | `number` | no | `slider`, `number` |
| `step` | `number` | no | `slider`, `number` |
| `format` | `(v: number) => string` | no | `slider` |

## useAppSettings

```ts
import { useAppSettings } from 'hudsonkit';

const [values, update, reset] = useAppSettings(appId, config);
```

- `values` — merged record of all setting keys; stored values overlay defaults, so fields added to the schema after first run automatically receive their `default`.
- `update(patch)` — shallow-merges `patch` into stored values. Unmentioned keys are unchanged.
- `reset()` — replaces stored values with defaults.

Use it inside your `Provider`:

```tsx
'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAppSettings } from 'hudsonkit';
import type { AppSettingsValues } from 'hudsonkit';
import { notepadSettings } from './settings';

const Ctx = createContext<{
  settings: AppSettingsValues;
  updateSetting: (patch: Partial<AppSettingsValues>) => void;
} | null>(null);

export const useNotepad = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('outside NotepadProvider');
  return ctx;
};

export function NotepadProvider({ children }: { children: ReactNode }) {
  const [settings, updateSetting] = useAppSettings('notepad', notepadSettings);
  const value = useMemo(() => ({ settings, updateSetting }), [settings, updateSetting]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
```

Then read values anywhere inside the tree:

```tsx
function NotepadContent() {
  const { settings } = useNotepad();
  return (
    <textarea
      style={{ fontSize: settings.fontSize as number }}
      placeholder={settings.defaultTitle as string}
    />
  );
}
```

## Storage key

Values are stored under:

```
hudson.app.${appId}.settings
```

For the notepad example that's `hudson.app.notepad.settings`. The key is stable, so you can read it directly from `localStorage` if needed outside of React.

## Resetting

Call `reset()` to overwrite stored values with schema defaults:

```tsx
const [, , reset] = useAppSettings('notepad', notepadSettings);

<button onClick={reset}>Restore defaults</button>
```

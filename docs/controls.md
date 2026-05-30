---
title: Controls
description: Parameter controls and code components for inspectors
order: 8
---

# Controls

## Overview

`hudsonkit/controls` provides two categories of components for building inspector and settings panels: a suite of typed parameter controls (`ParamSlider`, `ParamToggle`, `ParamColor`, `ParamEnum`, `ParamText`, `ParamRepeatable`, `ParamGrid`) and text/code surfaces (`CodeViewer`, `CodeEditor`, `TextDocumentSurface`, `TextDiffSurface`). All components are styled to match the active Hudson theme and template via the shared token surface.

`hudsonkit/controls` is a client entry. In React Server Component apps, import these controls from a Client Component boundary.

### Optional editor peers

The heavier editor/markdown/diff runtimes are BYO optional peers and are loaded dynamically only by the components that need them:

- `CodeEditor`: `@codemirror/*`, `@lezer/highlight`
- `TextDocumentSurface` markdown preview: `react-markdown`, `remark-gfm`
- `TextDiffSurface`: `@pierre/diffs`

Install those packages in the consuming app when you use the corresponding control. Param controls and `CodeViewer` do not need them.

## Param controls

### ParamSection

Collapsible labeled group. Wrap related controls to let users expand or collapse a category.

| name | type | required | description |
|---|---|---|---|
| `label` | `string` | yes | Section heading text (rendered uppercase) |
| `defaultExpanded` | `boolean` | no | Initial expanded state |
| `children` | `ReactNode` | yes | Control components to render inside |

```tsx
'use client';

import { useState } from 'react';
import { ParamSection, ParamSlider } from 'hudsonkit/controls';

export function TypographyInspector() {
  const [size, setSize] = useState(16);

  return (
    <ParamSection label="Typography" defaultExpanded>
      <ParamSlider label="Font size" value={size} min={8} max={72} step={1} onChange={setSize} />
    </ParamSection>
  );
}
```

---

### ParamSlider

Numeric range input with a live value readout.

| name | type | required | description |
|---|---|---|---|
| `label` | `string` | yes | Field label |
| `value` | `number` | yes | Current value |
| `min` | `number` | yes | Minimum value |
| `max` | `number` | yes | Maximum value |
| `step` | `number` | yes | Step increment |
| `onChange` | `(v: number) => void` | yes | Called with the new value |
| `format` | `(v: number) => string` | no | Custom display formatter |

```tsx
import { useState } from 'react';
import { ParamSlider } from 'hudsonkit/controls';

export function OpacityControl() {
  const [opacity, setOpacity] = useState(1);

  return (
    <ParamSlider
      label="Opacity"
      value={opacity}
      min={0}
      max={1}
      step={0.01}
      onChange={setOpacity}
      format={v => `${Math.round(v * 100)}%`}
    />
  );
}
```

---

### ParamToggle

Boolean switch with label on the left and a pill toggle on the right.

| name | type | required | description |
|---|---|---|---|
| `label` | `string` | yes | Field label |
| `value` | `boolean` | yes | Current state |
| `onChange` | `(v: boolean) => void` | yes | Called with the new state |

```tsx
import { useState } from 'react';
import { ParamToggle } from 'hudsonkit/controls';

export function VisibilityToggle() {
  const [visible, setVisible] = useState(true);
  return <ParamToggle label="Visible" value={visible} onChange={setVisible} />;
}
```

---

### ParamColor

Hex color picker with a swatch and a hex readout. When `value` starts with `rgba`, the picker is suppressed and the raw string is displayed.

| name | type | required | description |
|---|---|---|---|
| `label` | `string` | yes | Field label |
| `value` | `string` | yes | Hex or rgba color string |
| `onChange` | `(v: string) => void` | yes | Called with the new color string |

```tsx
import { useState } from 'react';
import { ParamColor } from 'hudsonkit/controls';

export function FillControl() {
  const [color, setColor] = useState('#6366f1');
  return <ParamColor label="Fill" value={color} onChange={setColor} />;
}
```

---

### ParamEnum

`<select>` dropdown for a fixed set of string options.

| name | type | required | description |
|---|---|---|---|
| `label` | `string` | yes | Field label |
| `value` | `string` | yes | Currently selected option |
| `options` | `string[]` | yes | Available options |
| `onChange` | `(v: string) => void` | yes | Called with the selected value |

```tsx
import { useState } from 'react';
import { ParamEnum } from 'hudsonkit/controls';

export function BlendModeControl() {
  const [mode, setMode] = useState('normal');
  return (
    <ParamEnum
      label="Blend mode"
      value={mode}
      options={['normal', 'multiply', 'screen', 'overlay']}
      onChange={setMode}
    />
  );
}
```

---

### ParamText

Single-line text input.

| name | type | required | description |
|---|---|---|---|
| `label` | `string` | yes | Field label |
| `value` | `string` | yes | Current text value |
| `placeholder` | `string` | no | Input placeholder |
| `onChange` | `(v: string) => void` | yes | Called on every keystroke |

```tsx
import { useState } from 'react';
import { ParamText } from 'hudsonkit/controls';

export function LabelControl() {
  const [label, setLabel] = useState('');
  return <ParamText label="Layer name" value={label} placeholder="Untitled" onChange={setLabel} />;
}
```

---

## ParamRepeatable

Variable-length list of structured field rows. Each row is rendered from a `ParamRepeatableField` schema. Users can add rows with **+ Add** and remove individual rows.

### ParamRepeatableField

Schema for a single field within each repeatable row.

| name | type | required | description |
|---|---|---|---|
| `key` | `string` | yes | Property key on the row object |
| `label` | `string` | yes | Field label |
| `type` | `'number' \| 'color' \| 'toggle' \| 'enum' \| 'text'` | yes | Control type to render |
| `default` | `number \| string \| boolean` | yes | Initial value for new rows |
| `min` | `number` | no | For `number` type |
| `max` | `number` | no | For `number` type |
| `step` | `number` | no | For `number` type |
| `options` | `string[]` | no | For `enum` type |
| `placeholder` | `string` | no | For `text` type |

### ParamRepeatableProps

| name | type | required | description |
|---|---|---|---|
| `label` | `string` | yes | Section label above the list |
| `value` | `Record<string, unknown>[]` | yes | Current array of row objects |
| `itemFields` | `ParamRepeatableField[]` | no | Field schema for each row |
| `itemTemplate` | `Record<string, unknown>` | no | Object merged into new rows on add |
| `onChange` | `(v: Record<string, unknown>[]) => void` | yes | Called with the updated array |

```tsx
import { useState } from 'react';
import { ParamRepeatable } from 'hudsonkit/controls';
import type { ParamRepeatableField } from 'hudsonkit/controls';

const fields: ParamRepeatableField[] = [
  { key: 'label', label: 'Label', type: 'text', default: '', placeholder: 'Step name' },
  { key: 'color', label: 'Color', type: 'color', default: '#6366f1' },
  { key: 'weight', label: 'Weight', type: 'number', default: 1, min: 0, max: 10, step: 0.5 },
];

const template = { label: '', color: '#6366f1', weight: 1 };

export function StepsControl() {
  const [steps, setSteps] = useState<Record<string, unknown>[]>([]);

  return (
    <ParamRepeatable
      label="Steps"
      value={steps}
      itemFields={fields}
      itemTemplate={template}
      onChange={setSteps}
    />
  );
}
```

---

## ParamGrid

Schema-driven panel that auto-renders a flat array of `ParamDefinition` objects, grouping them into `ParamSection` wrappers when a `group` field is set.

### ParamDefinition

| name | type | required | description |
|---|---|---|---|
| `key` | `string` | yes | Value lookup key |
| `label` | `string` | yes | Displayed label |
| `type` | `'number' \| 'color' \| 'toggle' \| 'enum' \| 'text' \| 'repeatable'` | yes | Control type |
| `default` | `number \| string \| boolean \| Record<string, unknown>[]` | yes | Fallback when key is absent from `values` |
| `min` | `number` | no | For `number` |
| `max` | `number` | no | For `number` |
| `step` | `number` | no | For `number` |
| `options` | `string[]` | no | For `enum` |
| `placeholder` | `string` | no | For `text` |
| `group` | `string` | no | Groups this param under a named `ParamSection` |
| `itemTemplate` | `Record<string, unknown>` | no | For `repeatable` |
| `itemFields` | `ParamRepeatableField[]` | no | For `repeatable` |

### ParamGridProps

| name | type | required | description |
|---|---|---|---|
| `params` | `ParamDefinition[]` | yes | Ordered schema array |
| `values` | `Record<string, unknown>` | yes | Current values keyed by `ParamDefinition.key` |
| `onChange` | `(key: string, value: unknown) => void` | yes | Called with the changed key and new value |
| `flatUngrouped` | `boolean` | no | When `true`, params with no `group` render without a section wrapper |
| `defaultExpanded` | `boolean` | no | Initial expanded state for generated sections |

```tsx
import { useState } from 'react';
import { ParamGrid } from 'hudsonkit/controls';
import type { ParamDefinition } from 'hudsonkit/controls';

const params: ParamDefinition[] = [
  { key: 'opacity',   label: 'Opacity',    type: 'number', default: 1,         min: 0, max: 1, step: 0.01, group: 'Appearance' },
  { key: 'fill',      label: 'Fill',       type: 'color',  default: '#6366f1',                             group: 'Appearance' },
  { key: 'visible',   label: 'Visible',    type: 'toggle', default: true,                                  group: 'Appearance' },
  { key: 'blendMode', label: 'Blend mode', type: 'enum',   default: 'normal',  options: ['normal', 'multiply', 'screen'], group: 'Appearance' },
  { key: 'label',     label: 'Label',      type: 'text',   default: '',        placeholder: 'Untitled' },
];

export function LayerInspector() {
  const [values, setValues] = useState<Record<string, unknown>>({});

  return (
    <ParamGrid
      params={params}
      values={values}
      onChange={(key, value) => setValues(prev => ({ ...prev, [key]: value }))}
    />
  );
}
```

---

## CodeViewer

Read-only syntax-highlighted code block. Supports line numbers, line highlighting, a filename header, and a copy button. Built-in tokenizer covers TypeScript, JavaScript, JSON, CSS, HTML, and shell.

### CodeLanguage

```ts
type CodeLanguage = 'typescript' | 'javascript' | 'json' | 'css' | 'html' | 'shell' | 'plain';
```

### CodeViewerProps

| name | type | required | description |
|---|---|---|---|
| `code` | `string` | yes | Source text to display |
| `language` | `CodeLanguage` | no | Tokenizer to apply |
| `filename` | `string` | no | Shown in the header bar |
| `startLine` | `number` | no | Line number offset for the gutter |
| `highlightLines` | `number[]` | no | Line numbers to highlight |
| `maxHeight` | `string \| number` | no | CSS max-height for the scroll container |
| `showCopy` | `boolean` | no | Render the copy button |
| `showLineNumbers` | `boolean` | no | Render the line number gutter |
| `className` | `string` | no | Extra classes on the root element |

```tsx
import { CodeViewer } from 'hudsonkit/controls';

const snippet = `const greet = (name: string) => \`Hello, \${name}!\`;`;

export function SnippetPanel() {
  return (
    <CodeViewer
      code={snippet}
      language="typescript"
      filename="greet.ts"
      highlightLines={[1]}
      showCopy
    />
  );
}
```

---

## CodeEditor

Editable CodeMirror-backed code input.

- `Tab` uses the CodeMirror indent binding.
- `Cmd+S` / `Ctrl+S` calls `onSave` and clears the dirty indicator.

### CodeEditorProps

| name | type | required | description |
|---|---|---|---|
| `code` | `string` | yes | Initial source text |
| `language` | `CodeLanguage` | no | Tokenizer to apply |
| `filename` | `string` | no | Shown in the header bar; also enables the dirty indicator |
| `onSave` | `(content: string) => void` | no | Called on `Cmd+S` / `Ctrl+S` |
| `onChange` | `(content: string) => void` | no | Called on every keystroke |
| `showLineNumbers` | `boolean` | no | Render the line number gutter |
| `readOnly` | `boolean` | no | Disable editing while keeping the editor surface |
| `className` | `string` | no | Extra classes on the root element |

```tsx
import { useState } from 'react';
import { CodeEditor } from 'hudsonkit/controls';

export function ScriptEditor() {
  const [saved, setSaved] = useState('const x = 1;');

  return (
    <CodeEditor
      code={saved}
      language="typescript"
      filename="script.ts"
      onSave={setSaved}
      className="h-64"
    />
  );
}
```

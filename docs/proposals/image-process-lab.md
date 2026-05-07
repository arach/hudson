# Image Process Lab

## Summary

Hudson should grow a generalized image-processing app that sits beside Assets, Shaper, and Logo Designer. The app takes a strong source image, runs it through a named programmable visual treatment, exposes real controls, and exports both the final image and the processing recipe.

Working name: **Image Process Lab**.

This generalizes the current Logo Designer / LogoZap mental model from "make a logo or process a logo shape" to "turn any hero, header, OG, product, or decorative image into a system-styled Hudson/Talkie asset."

## Why

The Talkie workflow hero exposed the need:

1. Start with a high-quality source image.
2. Avoid using it raw, because raw generated/editorial art can feel pasted on.
3. Run it through a repeatable programmatic proxy so it inherits a unified visual language.
4. Tune the effect visually with controls.
5. Export a processed artifact plus a manifest/recipe so the result is reproducible.

The important artifact is not only the PNG. It is:

```text
source image + named program + parameter set + processed output + manifest
```

That lets future headers, hero images, social cards, and product illustrations share the same visible system.

## Product Shape

Image Process Lab should be a Hudson app, not a one-off script.

It should feel like a production version of a small image shader bench:

- Drop/paste/select an image from Assets.
- Pick a processing program.
- Tune the parameters live.
- Preview before/after or split view.
- Export PNG/WebP/AVIF plus a JSON manifest.
- Save presets for reuse across projects.

## First Preset: Signal Mosaic

The first useful preset for Talkie is a mosaic/dither filter with emerald signal highlights.

Desired look:

- Preserve the beautiful source material.
- Add a visible, programmatic layer on top.
- Use a constrained palette: parchment, soft ink, sage/emerald.
- Add pixelized or mosaic structure.
- Add greenish highlights, routing marks, packet traces, or edge-derived marks.
- Make the output clearly processed, not just mildly color-corrected.

Avoid:

- Full rainbow color.
- Purple.
- Generic halftone posterization that loses the original art.
- A filter that is so subtle it reads as a normal exported image.

## Controls

Minimum viable controls:

| Control | Type | Purpose |
| --- | --- | --- |
| Program | Select | Signal Mosaic, Ordered Dither, Edge Trace, Halftone, Glitch Grid |
| Strength | Slider | Overall processing intensity |
| Mosaic Cell Size | Slider | Pixel/mosaic chunk size |
| Palette Mix | Slider | How far source pixels are pulled toward the design palette |
| Trace Density | Slider | Amount of green signal marks |
| Trace Boost | Slider | Visibility of emerald highlights |
| Edge Sensitivity | Slider | How many source edges get marked |
| Route Overlay | Toggle | Whether explicit Bezier routing lanes are drawn |
| Seed | Number/Text | Deterministic variation |
| Output Width | Number | Export size |
| Format | Segment | PNG, WebP, AVIF |

Good second-pass controls:

- Palette editor with swatches.
- Before/after split slider.
- Zoom/pan preview.
- Export manifest toggle.
- Copy CLI command.
- Save preset.
- Load preset.

## Hudson App Integration

Suggested app id:

```ts
id: 'image-process-lab'
name: 'Image Process'
```

Ports:

```ts
ports: {
  inputs: [
    {
      id: 'image',
      name: 'Source Image',
      dataType: 'image',
      description: 'Source bitmap or data URL to process',
    },
    {
      id: 'preset',
      name: 'Processing Preset',
      dataType: 'json',
      description: 'Optional saved program + parameter set',
    },
  ],
  outputs: [
    {
      id: 'processed-image',
      name: 'Processed Image',
      dataType: 'image',
      description: 'Processed image as data URL or asset reference',
    },
    {
      id: 'manifest',
      name: 'Processing Manifest',
      dataType: 'json',
      description: 'Program name, parameters, source hash, output hash',
    },
    {
      id: 'preset',
      name: 'Preset',
      dataType: 'json',
      description: 'Reusable visual program settings',
    },
  ],
}
```

Workspace flow:

```text
Assets -> Image Process Lab -> Assets
Assets -> Image Process Lab -> Logo Designer background
Shaper -> Image Process Lab -> Logo Designer
Image Process Lab -> web project export folder
```

This app should live naturally in the `logo-pipeline` workspace alongside `assets`, `shaper`, and `logo-designer`.

## Data Model

```ts
interface ImageProcessProgram {
  id: string;
  name: string;
  version: string;
  description: string;
  parameters: ImageProcessParameter[];
}

interface ImageProcessParameter {
  key: string;
  label: string;
  type: 'slider' | 'number' | 'toggle' | 'select' | 'color' | 'text';
  default: string | number | boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ label: string; value: string }>;
}

interface ImageProcessPreset {
  id: string;
  name: string;
  programId: string;
  programVersion: string;
  parameters: Record<string, string | number | boolean>;
  createdAt: number;
  updatedAt: number;
}

interface ImageProcessManifest {
  program: {
    id: string;
    name: string;
    version: string;
  };
  input: {
    assetId?: string;
    path?: string;
    sha256: string;
    width: number;
    height: number;
  };
  output: {
    assetId?: string;
    path?: string;
    sha256: string;
    width: number;
    height: number;
    format: 'png' | 'webp' | 'avif';
  };
  preset: ImageProcessPreset;
  stages: string[];
}
```

## Implementation Notes

The processing engine should probably be shared between UI and CLI:

```text
app/apps/image-process-lab/
  ImageProcessProvider.tsx
  ImageProcessContent.tsx
  ImageProcessInspector.tsx
  programs/
    signalMosaic.ts
    orderedDither.ts
    edgeTrace.ts
  ports.ts
  types.ts

scripts/
  process-image.ts
```

The first version can use Canvas 2D in the browser for live preview and a Node/Sharp path for deterministic file export. If keeping parity is painful, start with Canvas-only export from the app and add CLI parity once the visual language settles.

## Signal Mosaic Algorithm

Starter stages:

1. Normalize source to working dimensions.
2. Compute luminance and local edge field.
3. Quantize or mix toward a constrained palette.
4. Apply mosaic cells or ordered dither at a configurable cell size.
5. Add deterministic emerald marks based on:
   - source edges,
   - seeded random field,
   - optional user-authored routing curves.
6. Export final image and manifest.

The Talkie script prototype currently approximates this with:

- ordered 8x8 matrix,
- palette mix,
- edge-derived dashes,
- deterministic packet field,
- Bezier routing lanes,
- manifest with input/output hashes.

That script should be treated as a prototype preset, not the final app architecture.

## Acceptance Criteria

1. User can load an image from Assets or paste/drop one directly.
2. User can select `Signal Mosaic`.
3. User can tune at least strength, mosaic size, palette mix, trace density, trace boost, edge sensitivity, and seed.
4. Preview updates interactively.
5. User can export processed image.
6. User can export or save the manifest/recipe.
7. Running the same source + preset + seed produces the same output.
8. The effect is strong enough to be visibly processed at page scale.
9. Presets can be reused for future hero/header/OG images.

## Talkie Use Case

Source:

```text
usetalkie.com/public/images/workflows/voice-in-drafts-tasks-files-source.png
```

Desired export:

```text
usetalkie.com/public/images/workflows/voice-in-drafts-tasks-files-processed.png
```

Preset direction:

```json
{
  "programId": "signal-mosaic",
  "strength": 0.75,
  "mosaicCellSize": 3,
  "paletteMix": 0.6,
  "traceDensity": 0.45,
  "traceBoost": 1.7,
  "edgeSensitivity": 0.55,
  "routeOverlay": true,
  "seed": "talkie-workflows-hero"
}
```

The output should feel like a beautiful source image passed through a Talkie/Hudson visual instrument.

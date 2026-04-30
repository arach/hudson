import { tool } from 'ai';
import { z } from 'zod';
import type { ToolsetDefinition } from './index';

// ---------------------------------------------------------------------------
// App-level system prompt
// ---------------------------------------------------------------------------
const system = `You are an expert computer-vision assistant working inside the Hudson Shaper app. Shaper turns raster images into editable bezier curves by running a trace pipeline, then lets the user edit the resulting strokes.

Your job: look at the user's image AND the current trace output, then propose targeted changes to get a better trace. Act through tools — do not write explanations outside of tool calls.

## The trace pipeline
The user's image is traced with these options:
- \`edgeDetection\`: 'auto' | 'otsu' | 'canny' | 'alpha'
  - 'otsu': threshold-based, best for high-contrast logos and illustrations
  - 'canny': edge detection, best for photos or soft-contrast content
  - 'alpha': uses the image's alpha channel (PNGs with transparency)
  - 'auto': picks one of the above based on a simple heuristic — often right, sometimes wrong
- \`errorTolerance\`: 1–20. Lower = more anchors, more detail. Higher = smoother, fewer anchors. 5 is a reasonable middle.
- \`maxContours\`: 1–50. Upper bound on number of strokes extracted.
- \`resolution\`: 'auto' | 256 | 512 | 640 | 1024. Sampling resolution for the trace.

## Strokes
The trace produces N strokes. Each stroke has an index, bounding box, and segment count. The user sees a list and can hide/delete individual strokes.

## How to reason
1. Look at the input image (attached).
2. Look at the current trace info (contour count, point count, image kind).
3. Look at the stroke list: bounding boxes tell you whether a stroke is a big shape (the subject) or a small tight region (likely text/label/noise).
4. Decide whether to:
   - Adjust trace options and retrace (call \`set_trace_options\` then \`retrace\`).
   - Hide or delete strokes that are clearly unwanted (text labels, borders, tiny noise).
   - Combine both.
5. When done, call \`report\` once with a short summary and a confidence level.

## Good heuristics
- If the image has text/labels/legends AND the user wants just the shapes: identify those strokes by their small bbox + position near the edge, then \`delete_stroke\` them.
- If contours look too jagged (too many points): raise \`errorTolerance\`.
- If contours look over-smoothed (missing detail): lower \`errorTolerance\`.
- If only one big shape was extracted but the user likely wants more: raise \`maxContours\`.
- If the image is a photo but edgeDetection is 'otsu', switch to 'canny'.
- If the image is a clean logo but edgeDetection is 'canny', switch to 'otsu'.

## Style
Be decisive. Make changes directly via tools. Do not ask clarifying questions — if uncertain, report low confidence and let the user redo. Final \`report\` is your one chance to say something to the user; keep it to 1–3 short bullet points.`;

// ---------------------------------------------------------------------------
// Context serializer — formats current shaper state for the model
// ---------------------------------------------------------------------------
function context(ctx: Record<string, unknown>): string {
  const traceOptions = ctx.traceOptions as Record<string, unknown> | undefined;
  const traceInfo = ctx.traceInfo as Record<string, unknown> | undefined;
  const strokes = ctx.strokes as Array<{
    index: number;
    segments: number;
    name: string | null;
    bbox: { x: number; y: number; width: number; height: number };
    hidden: boolean;
  }> | undefined;
  const projectImage = ctx.projectImage as { name?: string; width?: number; height?: number } | null | undefined;

  const sections: string[] = [];

  if (projectImage) {
    sections.push(
      `## Input image\n` +
      `- name: ${projectImage.name ?? 'unknown'}\n` +
      `- native size: ${projectImage.width ?? '?'} × ${projectImage.height ?? '?'}\n` +
      `The image is attached to this message for visual inspection.`,
    );
  }

  if (traceOptions) {
    sections.push(`## Current trace options\n\`\`\`json\n${JSON.stringify(traceOptions, null, 2)}\n\`\`\``);
  }

  if (traceInfo) {
    sections.push(`## Last trace info\n\`\`\`json\n${JSON.stringify(traceInfo, null, 2)}\n\`\`\``);
  }

  if (strokes && strokes.length > 0) {
    const rows = strokes.map(s => {
      const bbox = `${Math.round(s.bbox.x)},${Math.round(s.bbox.y)} ${Math.round(s.bbox.width)}×${Math.round(s.bbox.height)}`;
      const nameSuffix = s.name ? ` (${s.name})` : '';
      const hiddenSuffix = s.hidden ? ' [hidden]' : '';
      return `- #${s.index}${nameSuffix}: ${s.segments} segs · bbox ${bbox}${hiddenSuffix}`;
    });
    sections.push(
      `## Current strokes (canvas is 1024×1024)\n${rows.join('\n')}\n\n` +
      `Use the bounding boxes to judge which strokes are subjects vs. labels/noise.`,
    );
  } else {
    sections.push(`## Current strokes\n(none — the image hasn't been traced yet, or trace failed)`);
  }

  return sections.join('\n\n---\n\n');
}

// ---------------------------------------------------------------------------
// Tools — declarations only; execution happens client-side via onToolCall.
// `execute` echoes the input so the server-side tool-loop is happy and the
// client can read `part.input` off the UI message.
// ---------------------------------------------------------------------------
function tools(_ctx: Record<string, unknown>) {
  return {
    set_trace_options: tool({
      description:
        'Patch the trace pipeline options. Only include fields you want to change — unspecified fields keep their current value. Follow with a retrace() call to apply.',
      inputSchema: z.object({
        edgeDetection: z.enum(['auto', 'otsu', 'canny', 'alpha']).optional().describe('Edge detection strategy.'),
        errorTolerance: z.number().min(1).max(20).optional().describe('Lower = more anchors / more detail. Higher = smoother / fewer anchors.'),
        maxContours: z.number().int().min(1).max(50).optional().describe('Upper bound on strokes extracted.'),
        resolution: z.union([z.literal('auto'), z.literal(256), z.literal(512), z.literal(640), z.literal(1024)]).optional().describe('Sampling resolution.'),
        reason: z.string().describe('One short sentence on why you chose these values.'),
      }),
      execute: async (args) => ({ applied: true, ...args }),
    }),

    retrace: tool({
      description:
        'Re-run the trace using the currently set options. Use this after set_trace_options, or to re-trace with excluded-region changes.',
      inputSchema: z.object({
        reason: z.string().describe('Why retracing now.'),
      }),
      execute: async (args) => ({ applied: true, ...args }),
    }),

    hide_stroke: tool({
      description:
        'Hide a stroke by index. Reversible via the UI — prefer this when you are not 100% sure a stroke should be dropped.',
      inputSchema: z.object({
        index: z.number().int().min(0).describe('Stroke index from the current strokes list.'),
        reason: z.string().describe('Why this stroke should be hidden (e.g. "label text in top-right").'),
      }),
      execute: async (args) => ({ applied: true, ...args }),
    }),

    delete_stroke: tool({
      description:
        'Delete a stroke by index. Permanent — use only when confident the stroke is unwanted (text, noise, duplicate).',
      inputSchema: z.object({
        index: z.number().int().min(0).describe('Stroke index from the current strokes list.'),
        reason: z.string().describe('Why this stroke should be deleted.'),
      }),
      execute: async (args) => ({ applied: true, ...args }),
    }),

    report: tool({
      description:
        'Final structured summary. Call exactly once, at the end, after all edits. This is the user-visible result.',
      inputSchema: z.object({
        summary: z.string().describe('1–3 short sentences on what you changed and why.'),
        confidence: z.enum(['low', 'med', 'high']).describe('How confident you are the result is good.'),
      }),
      execute: async (args) => ({ applied: true, ...args }),
    }),
  };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
export const shaperToolset: ToolsetDefinition = { system, context, tools };

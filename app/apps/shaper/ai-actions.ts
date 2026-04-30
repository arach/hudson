import { Wand2, Eraser, Minimize2, Maximize2, type LucideIcon } from 'lucide-react';

// ---------------------------------------------------------------------------
// AI preset actions for Shaper. Each preset produces a user-message prompt
// that targets a specific kind of trace improvement. The current image is
// attached automatically by useShaperAI; the prompt only adds intent.
// ---------------------------------------------------------------------------

export type ShaperAiActionId = 'enhance' | 'clean-up' | 'simplify' | 'refine';

export interface ShaperAiAction {
  id: ShaperAiActionId;
  label: string;
  desc: string;
  icon: LucideIcon;
  color: string;
  prompt: string;
}

export const SHAPER_AI_ACTIONS: ShaperAiAction[] = [
  {
    id: 'enhance',
    label: 'Enhance',
    desc: 'Tune trace params for the best overall result',
    icon: Wand2,
    color: 'text-emerald-400',
    prompt:
      'Look at the attached image and the current trace output (see strokes list and trace info in the system context). ' +
      'Judge whether the trace options are right for this image — edgeDetection, errorTolerance, maxContours. ' +
      'If you see improvements: call set_trace_options with the fields you want to change, then retrace. ' +
      'If obvious noise strokes exist (tiny fragments far from the subject), delete_stroke them after the retrace. ' +
      'Finish by calling report with a short summary and your confidence.',
  },
  {
    id: 'clean-up',
    label: 'Clean up',
    desc: 'Remove text, labels, and noise strokes',
    icon: Eraser,
    color: 'text-amber-400',
    prompt:
      'Look at the attached image. Identify any strokes that represent text, labels, legends, watermarks, borders, ' +
      'or obvious noise (not part of the main subject). Use the bounding boxes in the strokes list to match visual ' +
      'regions to stroke indices. For each unwanted stroke: call delete_stroke with a clear reason. ' +
      'Do not adjust trace options unless the trace is fundamentally broken. ' +
      'Finish with report summarizing what you removed and why.',
  },
  {
    id: 'simplify',
    label: 'Simplify',
    desc: 'Smoother curves, fewer anchors',
    icon: Minimize2,
    color: 'text-cyan-400',
    prompt:
      'The user wants a cleaner, simpler trace. Raise errorTolerance (try +2 to +5 from the current value, capped at 20) ' +
      'and consider lowering maxContours if many small fragments exist. Call set_trace_options then retrace. ' +
      'If fragments remain after retracing, delete_stroke the smallest noise contours. ' +
      'Finish with report.',
  },
  {
    id: 'refine',
    label: 'Add detail',
    desc: 'More anchors, finer curves',
    icon: Maximize2,
    color: 'text-violet-400',
    prompt:
      'The user wants more detail in the trace. Lower errorTolerance (try -2 to -3 from the current value, minimum 1) ' +
      'and consider switching edgeDetection if the current mode is missing fine features (canny for soft edges, otsu for ' +
      'high-contrast logos). Call set_trace_options then retrace. Finish with report.',
  },
];

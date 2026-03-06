'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Clock, Zap, Wrench, MessageSquare, Brain } from 'lucide-react';
import { useTrace } from './TraceProvider';

// ---------------------------------------------------------------------------
// Collapsible section
// ---------------------------------------------------------------------------
function Section({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="border-b border-white/[0.06]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left cursor-pointer hover:bg-white/[0.04] transition-colors"
      >
        {open ? <ChevronDown size={12} className="text-neutral-400" /> : <ChevronRight size={12} className="text-neutral-400" />}
        <span className="font-mono text-[12px] text-neutral-300 uppercase tracking-wider">{title}</span>
      </button>
      {open && (
        <div className="px-3 pb-3">
          {children}
        </div>
      )}
    </div>
  );
}

function DataBlock({ data }: { data: unknown }) {
  if (data === undefined || data === null) {
    return <span className="font-mono text-[12px] text-neutral-500 italic">empty</span>;
  }
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return (
    <pre className="font-mono text-[12px] text-neutral-200 bg-white/[0.04] rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-words max-h-[300px] overflow-y-auto leading-relaxed">
      {text}
    </pre>
  );
}

const TYPE_ICON: Record<string, React.FC<{ size: number; className?: string }>> = {
  tool_call: Wrench,
  message: MessageSquare,
  thinking: Brain,
};

const TYPE_LABEL: Record<string, string> = {
  tool_call: 'Tool Call',
  message: 'Message',
  thinking: 'Thinking',
};

const STATUS_STYLES: Record<string, string> = {
  success: 'text-emerald-400 bg-emerald-500/[0.12]',
  error: 'text-red-400 bg-red-500/[0.12]',
  skipped: 'text-neutral-400 bg-neutral-500/[0.12]',
};

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function TraceInspector() {
  const { selectedTrace, selectedStepIndex } = useTrace();

  if (!selectedTrace || selectedStepIndex === null) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-500 font-mono text-[13px]">
        Select a step to inspect
      </div>
    );
  }

  const step = selectedTrace.steps[selectedStepIndex];
  if (!step) return null;

  const Icon = TYPE_ICON[step.type] ?? Wrench;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Step header */}
      <div className="shrink-0 px-3 py-3.5 border-b border-white/[0.08] space-y-2">
        <div className="flex items-center gap-2.5">
          <Icon size={14} className="text-neutral-300" />
          <span className="font-mono text-[14px] font-semibold text-white">
            {step.tool ?? TYPE_LABEL[step.type] ?? step.type}
          </span>
          <span className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${STATUS_STYLES[step.status] ?? ''}`}>
            {step.status}
          </span>
        </div>
        <p className="font-mono text-[12px] text-neutral-300 leading-relaxed">{step.summary}</p>
        <div className="flex items-center gap-3 text-[11px] font-mono text-neutral-500">
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {formatMs(step.durationMs)}
          </span>
          {step.tokens && (
            <span className="flex items-center gap-1">
              <Zap size={10} />
              {(step.tokens.input + step.tokens.output).toLocaleString()} tok
            </span>
          )}
          <span className="px-1.5 py-0.5 rounded bg-white/[0.06] text-neutral-400">
            Step {step.index + 1}
          </span>
        </div>
      </div>

      {/* Input */}
      {step.input !== undefined && (
        <Section title="Input" defaultOpen>
          <DataBlock data={step.input} />
        </Section>
      )}

      {/* Output */}
      {step.output !== undefined && (
        <Section title="Output" defaultOpen>
          <DataBlock data={step.output} />
        </Section>
      )}
    </div>
  );
}

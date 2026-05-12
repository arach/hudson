'use client';

import type { ReactNode } from 'react';
import { useWorkflowLab } from './WorkflowLabProvider';

export function WorkflowLabInspector() {
  const { activeDocument, activeFixture, selectedNode, schema } = useWorkflowLab();
  const selectedType = selectedNode
    ? schema.nodeTypes.find(nodeType => nodeType.id === selectedNode.typeID)
    : null;
  const outputKeyCount = activeDocument.nodes.filter(node => node.outputKey).length;
  const disabledCount = activeDocument.nodes.filter(node => node.isEnabled === false).length;
  const conditionCount = activeDocument.nodes.filter(node => node.condition).length;
  const hasLabeledConnection = activeDocument.connections.some(edge => edge.label);

  return (
    <div className="h-full overflow-auto bg-card p-3 text-foreground">
      <div className="space-y-4">
        <Section title="Workflow">
          <div className="rounded border border-accent/24 bg-accent/8 px-2.5 py-2.5">
            <div className="flex items-center gap-2">
              <div className="truncate text-[12px] font-semibold text-foreground/86">{activeDocument.title}</div>
              <span className="ml-auto rounded border border-success/22 bg-success/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-success">
                parity
              </span>
            </div>
            <div className="mt-1 line-clamp-2 text-[10px] leading-snug text-muted-foreground/76">{activeFixture.description}</div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Metric label="Nodes" value={activeDocument.nodes.length} />
            <Metric label="Edges" value={activeDocument.connections.length} />
            <Metric label="Outputs" value={outputKeyCount} />
            <Metric label="Disabled" value={disabledCount} warn={disabledCount > 0 || conditionCount > 0} />
          </div>
        </Section>

        {selectedNode ? (
          <>
          <Section title="Selected Node">
            <KV label="ID" value={selectedNode.id} />
            <KV label="Type" value={selectedType?.label ?? selectedNode.typeID} />
            <KV label="Title" value={selectedNode.title} />
            {selectedNode.outputKey && <KV label="Output Key" value={selectedNode.outputKey} accent />}
            {selectedNode.condition && <KV label="Condition" value={selectedNode.condition} warn />}
            {selectedNode.isEnabled === false && <KV label="Enabled" value="false" warn />}
          </Section>
          <Section title="Field Values">
            <ValueMap value={selectedNode.fieldValues ?? {}} />
          </Section>
          </>
        ) : (
          <>
          <Section title="Document">
            <KV label="ID" value={activeDocument.id} />
            <KV label="Title" value={activeDocument.title} />
            <KV label="Source" value={activeDocument.metadata?.sourceFormat ?? 'fixture'} />
            {activeDocument.metadata?.slug && <KV label="Slug" value={activeDocument.metadata.slug} accent />}
            <KV label="Nodes" value={`${activeDocument.nodes.length}`} />
            <KV label="Edges" value={`${activeDocument.connections.length}`} />
          </Section>
          <Section title="Metadata">
            <ValueMap value={(activeDocument.metadata ?? {}) as unknown as Record<string, unknown>} />
          </Section>
          </>
        )}

        <Section title="Parity Contract">
          <ParityRow label="Document metadata" active={Boolean(activeDocument.metadata?.slug && activeDocument.metadata?.sourceFormat)} />
          <ParityRow label="Typed field values" active />
          <ParityRow label="Output keys" active={outputKeyCount > 0} />
          <ParityRow label="Disabled states" active={disabledCount > 0 || activeDocument.id !== 'fixture.quick-summary'} />
          <ParityRow label="Condition summaries" active={conditionCount > 0 || hasLabeledConnection} />
        </Section>

        <Section title="Runtime Caveat">
          <div className="rounded border border-warning/18 bg-warning/8 px-2.5 py-2 text-[11px] leading-relaxed text-warning">
            Conditional edges are visualized as declarations. Talkie runtime parity still needs to be confirmed before branches imply execution flow.
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function KV({
  label,
  value,
  accent = false,
  warn = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="rounded border border-border/70 bg-background/45 px-2.5 py-2">
      <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/68">{label}</div>
      <div className={`mt-0.5 break-words text-[11px] leading-snug ${
        warn ? 'text-warning' : accent ? 'text-accent' : 'text-foreground/72'
      }`}>
        {value}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div className={`rounded border px-2.5 py-2 ${warn ? 'border-warning/18 bg-warning/8' : 'border-border/70 bg-background/45'}`}>
      <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/68">{label}</div>
      <div className={`mt-0.5 font-mono text-[13px] font-semibold ${warn ? 'text-warning' : 'text-foreground/78'}`}>
        {value}
      </div>
    </div>
  );
}

function ParityRow({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded border border-border/70 bg-background/45 px-2.5 py-2">
      <span className="text-[11px] text-foreground/70">{label}</span>
      <span className={`h-2 w-2 rounded-full ${active ? 'bg-success' : 'bg-muted-foreground/24'}`} />
    </div>
  );
}

function ValueMap({ value }: { value: Record<string, unknown> }) {
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return (
      <div className="rounded border border-border/70 bg-background/45 px-2.5 py-2 text-[11px] text-muted-foreground/72">
        No values captured.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {entries.map(([key, item]) => (
        <KV key={key} label={key} value={formatValue(item)} />
      ))}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value, null, 2);
}

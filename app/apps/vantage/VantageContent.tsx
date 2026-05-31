'use client';

import { useMemo } from 'react';
import { useVantage } from './VantageProvider';
import { VantageCompanionCard } from './VantageCompanionCard';
import { EmptyPanel, SectionLabel } from './components';

function NodeCard({
  node,
  selected,
  onSelect,
}: {
  node: {
    id: string;
    title?: string;
    subtitle?: string;
    selected?: boolean;
    runtimeKind?: string;
    tag?: string;
  };
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 ${
        selected
          ? 'border-cyan-500/30 bg-cyan-500/10'
          : 'border-border/50 bg-muted/10 hover:border-border hover:bg-muted/20'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[12px] font-medium text-foreground/90">
          {node.title ?? node.id.slice(0, 8)}
        </span>
        {node.selected && (
          <span className="shrink-0 rounded bg-cyan-500/12 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-cyan-300">
            selected
          </span>
        )}
      </div>
      {node.subtitle && (
        <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground/75">{node.subtitle}</p>
      )}
      {(node.runtimeKind || node.tag) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {node.runtimeKind && (
            <span className="rounded border border-border/60 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
              {node.runtimeKind}
            </span>
          )}
          {node.tag && (
            <span className="rounded border border-border/60 bg-muted/20 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
              {node.tag}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

export function VantageContent() {
  const { nodes, selectedNodeId, setSelectedNodeId, status, phase } = useVantage();

  const sortedNodes = useMemo(
    () => [...nodes].sort((a, b) => (a.title ?? a.id).localeCompare(b.title ?? b.id)),
    [nodes],
  );

  return (
    <div className="flex h-full flex-col gap-5 overflow-auto p-4">
      <VantageCompanionCard />

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3 px-0.5">
          <div className="min-w-0">
            <SectionLabel label="Workspace" />
            <p className="px-2.5 truncate text-sm text-foreground/85">
              {status?.workspaceID ?? 'No workspace'}
              {status?.nodeCount != null ? ` · ${status.nodeCount} nodes` : ''}
            </p>
          </div>
        </div>

        {sortedNodes.length === 0 ? (
          <EmptyPanel
            title={phase === 'online' ? 'No nodes reported yet' : 'Companion offline'}
            subtitle={
              phase === 'online'
                ? 'The host is reachable but has not returned any runtime nodes.'
                : 'Launch the native Vantage app to populate this view.'
            }
          />
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {sortedNodes.map(node => (
              <NodeCard
                key={node.id}
                node={node}
                selected={selectedNodeId === node.id}
                onSelect={() => setSelectedNodeId(node.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

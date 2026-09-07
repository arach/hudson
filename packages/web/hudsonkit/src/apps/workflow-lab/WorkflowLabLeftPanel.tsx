'use client';

import { Database, Layers3 } from 'lucide-react';
import { useWorkflowLab } from './WorkflowLabProvider';

export function WorkflowLabLeftPanel() {
  const { fixtures, activeFixtureId, selectFixture, schema } = useWorkflowLab();

  return (
    <div className="flex h-full flex-col bg-card p-3 text-foreground">
      <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Fixture Workflows
      </div>
      <div className="mt-2 space-y-1.5">
        {fixtures.map(fixture => {
          const active = fixture.id === activeFixtureId;
          return (
            <button
              key={fixture.id}
              type="button"
              onClick={() => selectFixture(fixture.id)}
              className={`w-full rounded border px-3 py-2 text-left transition-colors ${
                active
                  ? 'border-accent/35 bg-accent/10 text-accent'
                  : 'border-border/70 bg-background/45 text-muted-foreground hover:bg-muted/65 hover:text-foreground/82'
              }`}
            >
              <span className="block truncate text-[12px] font-medium">{fixture.label}</span>
              <span className="mt-0.5 block line-clamp-2 text-[10px] leading-snug text-muted-foreground/72">
                {fixture.description}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <Layers3 size={12} />
        Schema
      </div>
      <div className="mt-2 space-y-1.5 overflow-auto pr-1">
        {schema.nodeTypes.map(nodeType => (
          <div key={nodeType.id} className="rounded border border-border/70 bg-background/45 px-2.5 py-2">
            <div className="flex items-center gap-2">
              <Database size={11} className="text-accent/62" />
              <span className="truncate text-[11px] font-medium text-foreground/76">{nodeType.label}</span>
              <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-muted-foreground/62">{nodeType.id}</span>
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground/72">{nodeType.category}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

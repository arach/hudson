'use client';

import { ArrowDown, ArrowUp, Check, Circle, Plus, RotateCcw } from 'lucide-react';
import { formatDuration, type ScheduleBlock, useDayStack } from './DayStackProvider';

function BlockNavItem({ block, active }: { block: ScheduleBlock; active: boolean }) {
  const { setActiveBlock, toggleDone, moveBlock } = useDayStack();

  return (
    <div
      className={`group border-l-2 px-3 py-2 transition-colors ${
        active
          ? 'border-l-accent bg-accent/10'
          : block.done
            ? 'border-l-success/40 bg-success/[0.06]'
            : 'border-l-transparent hover:bg-muted/60'
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={() => toggleDone(block.id)}
          className={`mt-0.5 rounded p-0.5 transition-colors ${
            block.done ? 'text-success' : 'text-muted-foreground/45 hover:text-success'
          }`}
          title={block.done ? 'Mark open' : 'Mark done'}
        >
          {block.done ? <Check size={13} /> : <Circle size={13} />}
        </button>

        <button onClick={() => setActiveBlock(block.id)} className="min-w-0 flex-1 text-left">
          <div className="font-mono text-[10px] text-muted-foreground/70">
            {block.start}-{block.end} · {formatDuration(block.minutes)}
          </div>
          <div className={`mt-0.5 truncate text-[12px] font-medium ${block.done ? 'text-muted-foreground/55 line-through' : 'text-foreground/78'}`}>
            {block.project}
          </div>
          {block.note && (
            <div className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-muted-foreground/72">
              {block.note}
            </div>
          )}
        </button>

        <div className="flex flex-col opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => moveBlock(block.id, -1)}
            className="rounded p-0.5 text-muted-foreground/35 hover:bg-muted hover:text-foreground/70"
            title="Move up"
          >
            <ArrowUp size={11} />
          </button>
          <button
            onClick={() => moveBlock(block.id, 1)}
            className="rounded p-0.5 text-muted-foreground/35 hover:bg-muted hover:text-foreground/70"
            title="Move down"
          >
            <ArrowDown size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function DayStackLeftPanel() {
  const { blocks, activeBlock, addHourBlock, resetToday, doneMinutes, totalMinutes } = useDayStack();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border/70 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-medium text-foreground/78">Today</div>
            <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
              {formatDuration(doneMinutes)} / {formatDuration(totalMinutes)}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={addHourBlock}
              className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-accent"
              title="Add hour block"
            >
              <Plus size={13} />
            </button>
            <button
              onClick={resetToday}
              className="rounded p-1.5 text-muted-foreground/65 transition-colors hover:bg-muted hover:text-foreground/75"
              title="Reset sample day"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {blocks.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-[11px] text-muted-foreground">
            Add schedule lines from the inspector.
          </div>
        ) : (
          blocks.map(block => (
            <BlockNavItem key={block.id} block={block} active={activeBlock?.id === block.id} />
          ))
        )}
      </div>
    </div>
  );
}

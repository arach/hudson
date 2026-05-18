'use client';

import { Check, Circle, Plus, SkipForward } from 'lucide-react';
import { formatDuration, useDayStack } from './DayStackProvider';

function FieldLabel({ children }: { children: string }) {
  return <label className="text-[10px] font-medium uppercase text-muted-foreground">{children}</label>;
}

export function DayStackRightPanel() {
  const {
    activeBlock,
    source,
    setSource,
    addHourBlock,
    completeAndAdvance,
    focusNext,
    toggleDone,
    updateBlock,
  } = useDayStack();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {activeBlock ? (
          <div className="space-y-4">
            <div className="rounded-md border border-border/70 bg-card/70 p-3">
              <div className="font-mono text-[10px] uppercase text-cyan-700/70 dark:text-cyan-200/55">
                {activeBlock.start}-{activeBlock.end} · {formatDuration(activeBlock.minutes)}
              </div>
              <div className="mt-1 text-[14px] font-medium text-foreground/84">{activeBlock.project}</div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => toggleDone(activeBlock.id)}
                  className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] transition-colors ${
                    activeBlock.done
                      ? 'border-emerald-600/30 dark:border-emerald-400/24 bg-emerald-700/10 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-200'
                      : 'border-border bg-background text-muted-foreground hover:text-emerald-700 dark:hover:text-emerald-200'
                  }`}
                >
                  {activeBlock.done ? <Check size={13} /> : <Circle size={13} />}
                  {activeBlock.done ? 'Done' : 'Open'}
                </button>
                <button
                  onClick={completeAndAdvance}
                  className="flex items-center gap-1.5 rounded-md border border-emerald-600/25 dark:border-emerald-400/20 bg-emerald-700/10 dark:bg-emerald-400/8 px-2.5 py-1.5 text-[11px] text-emerald-700 dark:text-emerald-200 transition-colors hover:bg-emerald-700/15 dark:hover:bg-emerald-400/14"
                >
                  <Check size={13} />
                  Done + Next
                </button>
                <button
                  onClick={focusNext}
                  className="rounded-md border border-cyan-700/20 dark:border-cyan-400/18 bg-cyan-700/10 dark:bg-cyan-400/8 p-1.5 text-cyan-700 dark:text-cyan-200 transition-colors hover:bg-cyan-700/15 dark:hover:bg-cyan-400/14"
                  title="Focus next"
                >
                  <SkipForward size={13} />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <FieldLabel>Start</FieldLabel>
                  <input
                    type="time"
                    value={activeBlock.start}
                    onChange={event => updateBlock(activeBlock.id, { start: event.target.value })}
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[12px] text-foreground/78 outline-none focus:border-cyan-700/40 dark:focus:border-cyan-300/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>End</FieldLabel>
                  <input
                    type="time"
                    value={activeBlock.end}
                    onChange={event => updateBlock(activeBlock.id, { end: event.target.value })}
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[12px] text-foreground/78 outline-none focus:border-cyan-700/40 dark:focus:border-cyan-300/40"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <FieldLabel>Project</FieldLabel>
                <input
                  value={activeBlock.project}
                  onChange={event => updateBlock(activeBlock.id, { project: event.target.value })}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[12px] text-foreground/78 outline-none focus:border-cyan-700/40 dark:focus:border-cyan-300/40"
                />
              </div>

              <div className="space-y-1.5">
                <FieldLabel>Intention</FieldLabel>
                <textarea
                  value={activeBlock.note}
                  onChange={event => updateBlock(activeBlock.id, { note: event.target.value })}
                  rows={4}
                  className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-[12px] leading-5 text-foreground/78 outline-none focus:border-cyan-700/40 dark:focus:border-cyan-300/40"
                  placeholder="What would make this block count?"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-md border border-border/70 bg-card/70 text-center">
            <div className="text-[12px] text-muted-foreground">No selected block.</div>
            <button
              onClick={addHourBlock}
              className="flex items-center gap-2 rounded-md border border-cyan-700/20 dark:border-cyan-400/18 bg-cyan-700/10 dark:bg-cyan-400/8 px-3 py-2 text-[12px] text-cyan-700 dark:text-cyan-200 transition-colors hover:bg-cyan-700/15 dark:hover:bg-cyan-400/14"
            >
              <Plus size={14} />
              Add block
            </button>
          </div>
        )}

        <div className="mt-5 space-y-2">
          <div>
            <div className="text-[10px] font-medium uppercase text-muted-foreground">Plan source</div>
            <div className="mt-0.5 text-[10px] text-muted-foreground/72">
              Lines parse as time, project, and intention.
            </div>
          </div>
          <textarea
            value={source}
            onChange={event => setSource(event.target.value)}
            spellCheck={false}
            className="h-44 w-full resize-none rounded-md border border-border bg-background p-2 font-mono text-[10px] leading-4 text-foreground/68 outline-none focus:border-cyan-700/40 dark:focus:border-cyan-300/35"
            placeholder="- [ ] 09:00-10:00 | Project | Intention"
          />
        </div>
      </div>
    </div>
  );
}

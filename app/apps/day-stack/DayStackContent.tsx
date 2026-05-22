'use client';

import { Check, Clock, PanelLeftOpen, PanelRightOpen, Plus, RotateCcw, SkipForward, TimerReset } from 'lucide-react';
import { formatDuration, useDayStack } from './DayStackProvider';

function progressPercent(doneMinutes: number, totalMinutes: number): number {
  if (totalMinutes <= 0) return 0;
  return Math.round((doneMinutes / totalMinutes) * 100);
}

function toggleShellPanel(side: 'left' | 'right') {
  window.dispatchEvent(new CustomEvent('hudson:set-panel-collapsed', {
    detail: { side, collapsed: 'toggle' },
  }));
}

function PanelHint({ side, label }: { side: 'left' | 'right'; label: string }) {
  const Icon = side === 'left' ? PanelLeftOpen : PanelRightOpen;
  return (
    <button
      onClick={() => toggleShellPanel(side)}
      className={`absolute top-1/2 z-10 flex -translate-y-1/2 items-center gap-1.5 rounded-md border border-border/70 bg-card/85 px-2 py-1.5 font-mono text-[10px] uppercase text-muted-foreground shadow-sm backdrop-blur transition-colors hover:border-cyan-700/30 hover:bg-cyan-700/10 hover:text-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30 dark:hover:border-cyan-300/30 dark:hover:bg-cyan-300/10 dark:hover:text-cyan-100 dark:focus-visible:ring-cyan-300/35 ${
        side === 'left' ? 'left-3' : 'right-3'
      }`}
      title={side === 'left' ? 'Toggle today panel' : 'Toggle details panel'}
    >
      <Icon size={13} />
      <span>{label}</span>
    </button>
  );
}

export function DayStackContent() {
  const {
    activeBlock,
    blocks,
    totalMinutes,
    doneMinutes,
    remainingCount,
    addHourBlock,
    completeAndAdvance,
    focusNext,
    resetToday,
  } = useDayStack();
  const percent = progressPercent(doneMinutes, totalMinutes);
  const nextBlocks = activeBlock
    ? blocks.slice(blocks.findIndex(block => block.id === activeBlock.id) + 1).filter(block => !block.done).slice(0, 3)
    : blocks.filter(block => !block.done).slice(0, 3);
  const totalCount = blocks.length;
  const doneCount = blocks.filter(block => block.done).length;

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      <PanelHint side="left" label="Today" />
      <PanelHint side="right" label="Details" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_50%_0%,oklch(var(--accent)/0.14),transparent_58%)]" />
      <div className="flex min-h-[100dvh] flex-1 items-start justify-center px-6 pb-20 pt-20 sm:px-8">
        <div className="relative w-full max-w-[720px]">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-cyan-700/75 dark:text-cyan-200/70">
                <Clock size={13} />
                Current focus
              </div>
              <div className="mt-2 text-[13px] text-muted-foreground">
                Personal Stacks
              </div>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase text-muted-foreground/78">
              <span className="rounded-md border border-border bg-card/75 px-2 py-1">{doneCount}/{totalCount} done</span>
              <span className="rounded-md border border-border bg-card/75 px-2 py-1">{formatDuration(totalMinutes)} planned</span>
            </div>
          </div>

          {activeBlock ? (
            <>
              <div className="overflow-hidden rounded-lg border border-cyan-800/20 bg-card/82 shadow-[0_18px_44px_-32px_oklch(var(--foreground)/0.45)] dark:border-cyan-300/18 dark:bg-card/76">
                <div className="flex items-center justify-between gap-3 border-b border-cyan-800/12 bg-cyan-700/[0.045] px-5 py-3 dark:border-cyan-300/12 dark:bg-cyan-300/[0.045]">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-cyan-700/20 bg-background text-cyan-700 dark:border-cyan-300/20 dark:text-cyan-200">
                      <TimerReset size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-cyan-800/72 dark:text-cyan-100/68">
                        {activeBlock.start}-{activeBlock.end}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                        {formatDuration(activeBlock.minutes)} focus block
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 rounded-full border border-cyan-700/18 bg-background px-2.5 py-1 font-mono text-[10px] uppercase text-cyan-800/72 dark:border-cyan-300/16 dark:text-cyan-100/70">
                    {activeBlock.done ? 'Done' : 'Open'}
                  </div>
                </div>

                <div className="px-5 py-6 sm:px-6 sm:py-7">
                  <h1 className={`text-[32px] font-semibold leading-tight tracking-normal text-foreground/94 sm:text-[38px] ${activeBlock.done ? 'line-through opacity-45' : ''}`}>
                    {activeBlock.project}
                  </h1>
                  {activeBlock.note && (
                    <p className="mt-4 max-w-2xl text-[15px] leading-7 text-foreground/68">
                      {activeBlock.note}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-card/68 p-2 shadow-sm">
                <button
                  onClick={completeAndAdvance}
                  className="flex min-h-9 items-center gap-2 rounded-md border border-emerald-700/25 bg-emerald-700/10 px-4 text-[13px] font-medium text-emerald-700 transition-colors hover:bg-emerald-700/15 dark:border-emerald-400/22 dark:bg-emerald-400/10 dark:text-emerald-200 dark:hover:bg-emerald-400/16"
                >
                  <Check size={15} />
                  Done + Next
                </button>
                <button
                  onClick={focusNext}
                  className="flex min-h-9 items-center gap-2 rounded-md border border-cyan-700/20 bg-cyan-700/10 px-4 text-[13px] text-cyan-700 transition-colors hover:bg-cyan-700/15 dark:border-cyan-400/18 dark:bg-cyan-400/8 dark:text-cyan-200 dark:hover:bg-cyan-400/14"
                >
                  <SkipForward size={15} />
                  Next
                </button>
                <div className="mx-1 hidden h-6 w-px bg-border sm:block" />
                <button
                  onClick={addHourBlock}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Add hour block"
                >
                  <Plus size={15} />
                </button>
                <button
                  onClick={resetToday}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
                  title="Reset sample day"
                >
                  <RotateCcw size={15} />
                </button>
                <div className="ml-auto hidden font-mono text-[10px] uppercase text-muted-foreground/65 sm:block">
                  {remainingCount} open
                </div>
              </div>
            </>
          ) : (
            <div className="mt-5 rounded-md border border-border/70 bg-card/70 p-7 text-center">
              <Clock size={24} className="mx-auto text-muted-foreground/30" />
              <div className="mt-3 text-[14px] text-muted-foreground">No focus blocks yet.</div>
              <button
                onClick={addHourBlock}
                className="mx-auto mt-4 flex items-center gap-2 rounded-md border border-cyan-700/20 bg-cyan-700/10 px-3 py-2 text-[12px] text-cyan-700 transition-colors hover:bg-cyan-700/15 dark:border-cyan-400/18 dark:bg-cyan-400/8 dark:text-cyan-200 dark:hover:bg-cyan-400/14"
              >
                <Plus size={14} />
                Add block
              </button>
            </div>
          )}

          <div className="mt-5 rounded-lg border border-border/65 bg-card/45 px-4 py-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted/75">
              <div
                className="h-full rounded-full bg-cyan-600/70 transition-[width] dark:bg-cyan-300/70"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-4 font-mono text-[10px] uppercase text-muted-foreground/70">
              <span>{percent}% complete</span>
              <span>{remainingCount} open · {formatDuration(totalMinutes)} planned</span>
            </div>
          </div>

          {nextBlocks.length > 0 && (
            <div className="mt-6">
              <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Up next</div>
              <div className="grid gap-2 sm:grid-cols-3">
                {nextBlocks.map(block => (
                  <div key={block.id} className="group rounded-lg border border-border/70 bg-card/58 p-3 transition-colors hover:border-cyan-700/24 hover:bg-card/82 dark:hover:border-cyan-300/20">
                    <div className="flex items-center justify-between gap-2 font-mono text-[10px] text-muted-foreground/65">
                      <span>{block.start}-{block.end}</span>
                      <span>{formatDuration(block.minutes)}</span>
                    </div>
                    <div className="mt-1 truncate text-[12px] font-medium text-foreground/78">{block.project}</div>
                    {block.note && (
                      <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-muted-foreground/70">
                        {block.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

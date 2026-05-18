'use client';

import {
  createContext,
  type Dispatch,
  type SetStateAction,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAppSettings, usePersistentState, type AppSettingsValues, type HudsonAIChat } from 'hudsonkit';
import { dayStackSettings } from './settings';
import { useDayStackAI, type DayStackAIActivityEntry } from './useDayStackAI';

export interface ScheduleBlock {
  id: string;
  lineIndex: number;
  start: string;
  end: string;
  project: string;
  note: string;
  done: boolean;
  minutes: number;
}

export interface ScheduleBlockUpdate {
  start?: string;
  end?: string;
  project?: string;
  note?: string;
  done?: boolean;
}

interface DayStackContextValue {
  source: string;
  blocks: ScheduleBlock[];
  activeBlock: ScheduleBlock | null;
  totalMinutes: number;
  doneMinutes: number;
  remainingCount: number;
  aiChat: HudsonAIChat;
  aiActivity: DayStackAIActivityEntry[];
  aiError: string | null;
  appSettings: AppSettingsValues;
  setSource: Dispatch<SetStateAction<string>>;
  appendIntake: (text: string) => void;
  addHourBlock: () => void;
  resetToday: () => void;
  setActiveBlock: (id: string) => void;
  toggleDone: (id: string) => void;
  updateBlock: (id: string, patch: ScheduleBlockUpdate) => void;
  appendBlock: (block: AppendScheduleBlockInput) => void;
  completeAndAdvance: () => void;
  focusNext: () => void;
  moveBlock: (id: string, direction: -1 | 1) => void;
}

export interface AppendScheduleBlockInput {
  start?: string;
  end?: string;
  project?: string;
  note?: string;
  done?: boolean;
  durationMinutes?: number;
}

const DayStackContext = createContext<DayStackContextValue | null>(null);

const DEFAULT_SOURCE = `# Today

- [ ] 09:00-10:00 | Project One | Define the smallest useful outcome
- [ ] 10:15-11:15 | Project Two | One focused hour, no context drift
- [ ] 13:00-14:00 | Project Three | Move the important piece forward
- [ ] 14:15-15:15 | Project Four | Close with a shippable next step`;

function normalizeTime(raw: string): string | null {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function minutesFromTime(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function timeFromMinutes(value: number): string {
  const minutesInDay = 24 * 60;
  const normalized = ((value % minutesInDay) + minutesInDay) % minutesInDay;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function blockId(start: string, end: string, project: string, lineIndex: number): string {
  return `${start}-${end}-${project.trim().toLowerCase() || 'focus'}-${lineIndex}`;
}

function parseSchedule(source: string): ScheduleBlock[] {
  return source
    .split('\n')
    .map((line, lineIndex) => {
      const match = line.match(
        /^\s*(?:[-*]\s*)?(?:\[([ xX])\]\s*)?(\d{1,2}:\d{2})\s*(?:-|to|–|—)\s*(\d{1,2}:\d{2})\s*(?:\|\s*([^|\n]+))?(?:\|\s*(.*))?$/,
      );
      if (!match) return null;

      const [, doneToken, rawStart, rawEnd, rawProject, rawNote] = match;
      const start = normalizeTime(rawStart);
      const end = normalizeTime(rawEnd);
      if (!start || !end) return null;

      const startMinutes = minutesFromTime(start);
      const endMinutes = minutesFromTime(end);
      const minutes = Math.max(0, endMinutes - startMinutes);
      const project = rawProject?.trim() || 'Focus block';

      return {
        id: blockId(start, end, project, lineIndex),
        lineIndex,
        start,
        end,
        project,
        note: rawNote?.trim() || '',
        done: doneToken?.toLowerCase() === 'x',
        minutes,
      };
    })
    .filter((block): block is ScheduleBlock => block !== null);
}

function setLineDone(line: string, done: boolean): string {
  const nextToken = done ? '[x]' : '[ ]';
  if (/\[[ xX]\]/.test(line)) {
    return line.replace(/\[[ xX]\]/, nextToken);
  }
  return line.replace(/^(\s*(?:[-*]\s*)?)/, `$1${nextToken} `);
}

function formatBlockLine(block: ScheduleBlock): string {
  const checkbox = block.done ? '[x]' : '[ ]';
  const note = block.note.trim();
  const suffix = note ? ` | ${note}` : '';
  return `- ${checkbox} ${block.start}-${block.end} | ${block.project.trim() || 'Focus block'}${suffix}`;
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return 'open';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export function useDayStack() {
  const ctx = useContext(DayStackContext);
  if (!ctx) throw new Error('useDayStack must be used inside DayStackProvider');
  return ctx;
}

export function DayStackProvider({ children }: { children: ReactNode }) {
  const [source, setSource] = usePersistentState('day-stack.source', DEFAULT_SOURCE);
  const [appSettings] = useAppSettings('day-stack', dayStackSettings);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);

  const blocks = useMemo(() => parseSchedule(source), [source]);
  const activeBlock = useMemo(() => {
    const selected = blocks.find(block => block.id === activeBlockId);
    return selected ?? blocks.find(block => !block.done) ?? blocks[0] ?? null;
  }, [activeBlockId, blocks]);

  const totalMinutes = useMemo(
    () => blocks.reduce((total, block) => total + block.minutes, 0),
    [blocks],
  );
  const doneMinutes = useMemo(
    () => blocks.reduce((total, block) => total + (block.done ? block.minutes : 0), 0),
    [blocks],
  );
  const remainingCount = useMemo(
    () => blocks.filter(block => !block.done).length,
    [blocks],
  );

  const updateLine = useCallback((id: string, update: (line: string) => string) => {
    const block = blocks.find(candidate => candidate.id === id);
    if (!block) return;
    setSource(prev => {
      const lines = prev.split('\n');
      lines[block.lineIndex] = update(lines[block.lineIndex] ?? '');
      return lines.join('\n');
    });
  }, [blocks, setSource]);

  const toggleDone = useCallback((id: string) => {
    const block = blocks.find(candidate => candidate.id === id);
    if (!block) return;
    updateLine(id, line => setLineDone(line, !block.done));
  }, [blocks, updateLine]);

  const updateBlock = useCallback((id: string, patch: ScheduleBlockUpdate) => {
    const block = blocks.find(candidate => candidate.id === id);
    if (!block) return;

    const nextStart = patch.start !== undefined ? normalizeTime(patch.start) : block.start;
    const nextEnd = patch.end !== undefined ? normalizeTime(patch.end) : block.end;
    if (!nextStart || !nextEnd) return;

    const nextBlock: ScheduleBlock = {
      ...block,
      start: nextStart,
      end: nextEnd,
      project: patch.project !== undefined ? patch.project : block.project,
      note: patch.note !== undefined ? patch.note : block.note,
      done: patch.done !== undefined ? patch.done : block.done,
      minutes: Math.max(0, minutesFromTime(nextEnd) - minutesFromTime(nextStart)),
    };

    setSource(prev => {
      const lines = prev.split('\n');
      lines[block.lineIndex] = formatBlockLine(nextBlock);
      return lines.join('\n');
    });
    setActiveBlockId(blockId(nextBlock.start, nextBlock.end, nextBlock.project, nextBlock.lineIndex));
  }, [blocks, setSource]);

  const appendBlock = useCallback((input: AppendScheduleBlockInput) => {
    const last = blocks.at(-1);
    const normalizedStart = input.start ? normalizeTime(input.start) : null;
    const normalizedEnd = input.end ? normalizeTime(input.end) : null;
    const duration = typeof input.durationMinutes === 'number' && input.durationMinutes > 0
      ? input.durationMinutes
      : 60;
    const start = normalizedStart
      ?? (last ? timeFromMinutes(minutesFromTime(last.end) + 15) : timeFromMinutes(new Date().getHours() * 60));
    const end = normalizedEnd ?? timeFromMinutes(minutesFromTime(start) + duration);
    const project = input.project?.trim() || 'Focus block';
    const note = input.note?.trim() || 'One focused outcome';
    const done = Boolean(input.done);

    setSource(prev => `${prev.trimEnd()}\n${formatBlockLine({
      id: '',
      lineIndex: 0,
      start,
      end,
      project,
      note,
      done,
      minutes: Math.max(0, minutesFromTime(end) - minutesFromTime(start)),
    })}`);
  }, [blocks, setSource]);

  const focusNext = useCallback(() => {
    if (blocks.length === 0) return;
    const currentIndex = activeBlock
      ? blocks.findIndex(block => block.id === activeBlock.id)
      : -1;
    const next = blocks
      .slice(currentIndex + 1)
      .find(block => !block.done)
      ?? blocks.find(block => !block.done)
      ?? blocks[(currentIndex + 1 + blocks.length) % blocks.length];
    if (next) setActiveBlockId(next.id);
  }, [activeBlock, blocks]);

  const completeAndAdvance = useCallback(() => {
    if (!activeBlock) return;
    updateLine(activeBlock.id, line => setLineDone(line, true));
    const currentIndex = blocks.findIndex(block => block.id === activeBlock.id);
    const next = blocks.slice(currentIndex + 1).find(block => !block.done);
    if (next) setActiveBlockId(next.id);
  }, [activeBlock, blocks, updateLine]);

  const addHourBlock = useCallback(() => {
    appendBlock({ project: 'New Project', note: 'One focused outcome' });
  }, [appendBlock]);

  const appendIntake = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSource(prev => `${prev.trimEnd()}\n\n## Intake\n${trimmed}`);
  }, [setSource]);

  const resetToday = useCallback(() => {
    setSource(DEFAULT_SOURCE);
    setActiveBlockId(null);
  }, [setSource]);

  const moveBlock = useCallback((id: string, direction: -1 | 1) => {
    const block = blocks.find(candidate => candidate.id === id);
    if (!block) return;
    const orderedLineIndexes = blocks.map(candidate => candidate.lineIndex);
    const position = orderedLineIndexes.indexOf(block.lineIndex);
    const targetLineIndex = orderedLineIndexes[position + direction];
    if (targetLineIndex === undefined) return;

    setSource(prev => {
      const lines = prev.split('\n');
      const currentLine = lines[block.lineIndex];
      lines[block.lineIndex] = lines[targetLineIndex] ?? '';
      lines[targetLineIndex] = currentLine ?? '';
      return lines.join('\n');
    });
    setActiveBlockId(blockId(block.start, block.end, block.project, targetLineIndex));
  }, [blocks, setSource]);

  const { aiChat, aiActivity, aiError } = useDayStackAI({
    source,
    blocks,
    activeBlock,
    setSource,
    appendBlock,
    updateBlock,
    completeAndAdvance,
    focusNext,
    resetToday,
    appSettings,
  });

  const value = useMemo<DayStackContextValue>(() => ({
    source,
    blocks,
    activeBlock,
    totalMinutes,
    doneMinutes,
    remainingCount,
    aiChat,
    aiActivity,
    aiError,
    appSettings,
    setSource,
    appendIntake,
    addHourBlock,
    resetToday,
    setActiveBlock: setActiveBlockId,
    toggleDone,
    updateBlock,
    appendBlock,
    completeAndAdvance,
    focusNext,
    moveBlock,
  }), [
    source,
    blocks,
    activeBlock,
    totalMinutes,
    doneMinutes,
    remainingCount,
    aiChat,
    aiActivity,
    aiError,
    appSettings,
    setSource,
    appendIntake,
    addHourBlock,
    resetToday,
    toggleDone,
    updateBlock,
    appendBlock,
    completeAndAdvance,
    focusNext,
    moveBlock,
  ]);

  return (
    <DayStackContext.Provider value={value}>
      {children}
    </DayStackContext.Provider>
  );
}

export { formatDuration };

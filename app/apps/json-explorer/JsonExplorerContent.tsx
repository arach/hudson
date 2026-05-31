'use client';

import { useCallback, useRef } from 'react';
import {
  ChevronRight, ChevronDown, Braces, Brackets, Type, Hash,
  ToggleLeft, CircleDot, Clipboard, Upload, X, Search, ChevronsUpDown, ChevronsDownUp,
} from 'lucide-react';
import { useJsonExplorer } from './JsonExplorerProvider';
import { getNodeType, getChildCount, getPreview, TYPE_COLORS, TYPE_BADGES } from './types';
import type { JsonNodeType } from './types';

// ---------------------------------------------------------------------------
// Type Icon
// ---------------------------------------------------------------------------

const TYPE_ICONS: Record<JsonNodeType, React.FC<{ size: number; className?: string }>> = {
  object: Braces,
  array: Brackets,
  string: Type,
  number: Hash,
  boolean: ToggleLeft,
  null: CircleDot,
};

// ---------------------------------------------------------------------------
// Tree Node
// ---------------------------------------------------------------------------

function TreeNode({
  keyName,
  value,
  path,
  depth,
  filter,
}: {
  keyName: string;
  value: unknown;
  path: string;
  depth: number;
  filter: string;
}) {
  const { expandedPaths, togglePath, selectedPath, setSelectedPath } = useJsonExplorer();
  const type = getNodeType(value);
  const childCount = getChildCount(value);
  const isExpandable = type === 'object' || type === 'array';
  const isExpanded = expandedPaths.has(path);
  const isSelected = selectedPath === path;
  const Icon = TYPE_ICONS[type];

  // Filter matching
  const matchesFilter = !filter || keyName.toLowerCase().includes(filter.toLowerCase());
  const childEntries = isExpandable
    ? (Array.isArray(value)
        ? value.map((v, i) => [String(i), v] as const)
        : Object.entries(value as object))
    : [];

  // Check if any descendant matches
  const hasMatchingDescendant = filter
    ? childEntries.some(([k]) => k.toLowerCase().includes(filter.toLowerCase()))
    : true;

  if (filter && !matchesFilter && !hasMatchingDescendant && !isExpandable) {
    return null;
  }

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 py-0.5 px-2 cursor-pointer transition-colors group ${
          isSelected ? 'bg-cyan-500/10' : 'hover:bg-accent/8'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => {
          setSelectedPath(path);
          if (isExpandable) togglePath(path);
        }}
      >
        {/* Expand arrow */}
        <span className="w-3 shrink-0">
          {isExpandable && (
            isExpanded
              ? <ChevronDown size={10} className="text-muted-foreground/70" />
              : <ChevronRight size={10} className="text-muted-foreground/70" />
          )}
        </span>

        {/* Type icon */}
        <Icon size={11} className={TYPE_COLORS[type]} />

        {/* Key name */}
        <span className={`text-[12px] font-mono shrink-0 ${
          filter && matchesFilter ? 'text-cyan-300/90 font-bold' : 'text-foreground/76'
        }`}>
          {keyName}
        </span>

        {/* Separator */}
        {!isExpandable && <span className="text-muted-foreground/60 text-[11px]">:</span>}

        {/* Value preview */}
        {!isExpandable && (
          <span className={`text-[12px] font-mono truncate ${TYPE_COLORS[type]}`}>
            {getPreview(value)}
          </span>
        )}

        {/* Child count badge */}
        {isExpandable && childCount !== undefined && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${TYPE_BADGES[type]}`}>
            {childCount}
          </span>
        )}

        {/* Copy button */}
        <button
          onClick={e => {
            e.stopPropagation();
            navigator.clipboard.writeText(
              typeof value === 'string' ? value : JSON.stringify(value, null, 2)
            );
          }}
          className="ml-auto opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-foreground/74 transition-all"
        >
          <Clipboard size={10} />
        </button>
      </div>

      {/* Children */}
      {isExpandable && isExpanded && (
        <div>
          {childEntries.map(([k, v]) => (
            <TreeNode
              key={k}
              keyName={k}
              value={v}
              path={`${path}.${k}`}
              depth={depth + 1}
              filter={filter}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Content
// ---------------------------------------------------------------------------

export function JsonExplorerContent() {
  const {
    rawInput, parsedData, parseError, loadJson, clear,
    filter, setFilter, expandAll, collapseAll,
    nodeCount, depth,
  } = useJsonExplorer();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handlePaste = useCallback(() => {
    navigator.clipboard.readText().then(text => {
      if (text.trim()) loadJson(text);
    });
  }, [loadJson]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') loadJson(reader.result);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [loadJson]);

  // No data loaded — show input view
  if (parsedData === null && !parseError) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
          <div className="text-muted-foreground/70 text-[13px] mb-2">Paste or load JSON to explore</div>
          <div className="flex gap-2">
            <button
              onClick={handlePaste}
              className="px-4 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/15 text-cyan-400 text-[12px] font-medium hover:bg-cyan-500/20 transition-colors flex items-center gap-2"
            >
              <Clipboard size={13} /> Paste from clipboard
            </button>
            <label className="px-4 py-2 rounded-lg bg-card/88 border border-border/70 text-muted-foreground text-[12px] font-medium hover:bg-accent/8 transition-colors flex items-center gap-2 cursor-pointer">
              <Upload size={13} /> Load file
              <input type="file" accept=".json,.jsonl" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
          <div className="w-full max-w-lg mt-4">
            <textarea
              ref={textareaRef}
              placeholder='{"paste": "json here"}'
              className="w-full h-[140px] px-3 py-2 rounded-lg bg-card/85 border border-border/70 text-[12px] text-foreground/76 font-mono outline-none focus:border-cyan-500/30 transition-colors resize-none"
              spellCheck={false}
              onKeyDown={e => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  const val = textareaRef.current?.value ?? '';
                  if (val.trim()) loadJson(val);
                }
              }}
            />
            <div className="flex justify-between mt-2">
              <span className="text-[10px] text-muted-foreground/60">Cmd+Enter to load</span>
              <button
                onClick={() => {
                  const val = textareaRef.current?.value ?? '';
                  if (val.trim()) loadJson(val);
                }}
                className="px-3 py-1 rounded bg-cyan-500/15 text-cyan-400 text-[11px] font-medium hover:bg-cyan-500/25 transition-colors"
              >
                Parse
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-2 border-b border-border/70 flex items-center gap-2">
        <div className="flex-1 relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter keys"
            className="w-full pl-8 pr-3 py-1.5 rounded bg-card/85 border border-border/70 text-[12px] text-foreground/78 font-mono outline-none focus:border-cyan-500/30 transition-colors"
          />
        </div>
        <button onClick={expandAll} className="p-1.5 rounded hover:bg-accent/8 text-muted-foreground/70 hover:text-foreground/80 transition-colors" title="Expand all">
          <ChevronsUpDown size={13} />
        </button>
        <button onClick={collapseAll} className="p-1.5 rounded hover:bg-accent/8 text-muted-foreground/70 hover:text-foreground/80 transition-colors" title="Collapse all">
          <ChevronsDownUp size={13} />
        </button>
        <button onClick={clear} className="p-1.5 rounded hover:bg-accent/8 text-muted-foreground/70 hover:text-red-400/70 transition-colors" title="Clear">
          <X size={13} />
        </button>
      </div>

      {/* Stats bar */}
      <div className="px-4 py-1.5 border-b border-border/50 flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
        <span>{nodeCount} nodes</span>
        <span className="text-muted-foreground/60">|</span>
        <span>depth {depth}</span>
      </div>

      {/* Parse error */}
      {parseError && (
        <div className="px-4 py-2 text-[11px] text-red-400 bg-red-500/5 border-b border-red-500/10">
          Parse error: {parseError}
        </div>
      )}

      {/* Tree */}
      <div className="flex-1 overflow-auto py-1">
        {parsedData !== null && (
          <TreeNode
            keyName="$"
            value={parsedData}
            path="$"
            depth={0}
            filter={filter}
          />
        )}
      </div>
    </div>
  );
}

'use client';

import { useMemo } from 'react';
import { Clipboard } from '../../icons';
import { useJsonExplorer } from './JsonExplorerProvider';
import { getNodeType, TYPE_BADGES } from './types';

// ---------------------------------------------------------------------------
// Resolve a dot-path like $.data.items.0 to its value
// ---------------------------------------------------------------------------
function resolvePath(data: unknown, path: string): unknown {
  if (path === '$') return data;
  const parts = path.slice(2).split('.'); // strip "$."
  let current = data;
  for (const part of parts) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// ---------------------------------------------------------------------------
// Inspector
// ---------------------------------------------------------------------------

export function JsonExplorerInspector() {
  const { parsedData, selectedPath, nodeCount, depth, dataLabel } = useJsonExplorer();

  const selectedValue = useMemo(() => {
    if (!selectedPath || parsedData === null) return undefined;
    return resolvePath(parsedData, selectedPath);
  }, [parsedData, selectedPath]);

  const selectedType = selectedValue !== undefined ? getNodeType(selectedValue) : null;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Data overview */}
      <div className="px-3 py-3 border-b border-white/[0.04]">
        <div className="text-[10px] font-medium text-white/30 uppercase tracking-wider mb-2">Data</div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-white/30">Type</span>
            <span className="text-[12px] font-mono text-white/60">{dataLabel || 'None'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-white/30">Nodes</span>
            <span className="text-[12px] font-mono text-white/60">{nodeCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-white/30">Depth</span>
            <span className="text-[12px] font-mono text-white/60">{depth}</span>
          </div>
        </div>
      </div>

      {/* Selected node */}
      {selectedPath && selectedValue !== undefined && (
        <div className="px-3 py-3 border-b border-white/[0.04]">
          <div className="text-[10px] font-medium text-white/30 uppercase tracking-wider mb-2">Selected</div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/30">Path</span>
              <span className="text-[11px] font-mono text-cyan-400/60 truncate max-w-[160px]" title={selectedPath}>
                {selectedPath}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/30">Type</span>
              {selectedType && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${TYPE_BADGES[selectedType]}`}>
                  {selectedType}
                </span>
              )}
            </div>
          </div>

          {/* Value preview */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-white/20">Value</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    typeof selectedValue === 'string' ? selectedValue : JSON.stringify(selectedValue, null, 2)
                  );
                }}
                className="text-white/10 hover:text-white/30 transition-colors"
              >
                <Clipboard size={10} />
              </button>
            </div>
            <pre className="text-[11px] font-mono text-white/50 bg-white/[0.02] rounded p-2 max-h-[200px] overflow-auto whitespace-pre-wrap break-all border border-white/[0.04]">
              {typeof selectedValue === 'string'
                ? selectedValue
                : JSON.stringify(selectedValue, null, 2)
              }
            </pre>
          </div>
        </div>
      )}

      {!selectedPath && parsedData !== null && (
        <div className="px-3 py-6 text-center text-[11px] text-white/15">
          Click a node to inspect
        </div>
      )}
    </div>
  );
}

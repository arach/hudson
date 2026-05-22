'use client';

import { useMemo, type CSSProperties } from 'react';
import type {
  HudWorkflowConnection,
  HudWorkflowDocument,
  HudWorkflowNode,
  HudWorkflowNodeTypeSchema,
  HudWorkflowSchema,
  HudWorkflowTint,
} from './types';

const NODE_WIDTH = 240;
const NODE_HEIGHT = 132;
const PADDING = 80;

const tintClasses: Record<HudWorkflowTint, {
  color: string;
  line: string;
}> = {
  cyan: {
    color: '#0891b2',
    line: '#67e8f9',
  },
  blue: {
    color: '#0284c7',
    line: '#7dd3fc',
  },
  teal: {
    color: '#0f766e',
    line: '#5eead4',
  },
  emerald: {
    color: '#059669',
    line: '#6ee7b7',
  },
  amber: {
    color: '#b45309',
    line: '#fcd34d',
  },
  neutral: {
    color: '#64748b',
    line: '#94a3b8',
  },
};

export interface HudWorkflowGraphProps {
  document: HudWorkflowDocument;
  schema: HudWorkflowSchema;
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string | null) => void;
  className?: string;
}

export function HudWorkflowGraph({
  document,
  schema,
  selectedNodeId,
  onSelectNode,
  className = '',
}: HudWorkflowGraphProps) {
  const nodeTypes = useMemo(() => new Map(schema.nodeTypes.map(nodeType => [nodeType.id, nodeType])), [schema]);
  const bounds = useMemo(() => getGraphBounds(document.nodes), [document.nodes]);

  return (
    <div
      data-hudson-workflow-graph
      className={`relative h-full min-h-[520px] overflow-auto bg-background ${className}`}
      onClick={() => onSelectNode?.(null)}
    >
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage: [
            'radial-gradient(circle, var(--hud-canvas-dot-minor) 1px, transparent 1px)',
            'radial-gradient(circle, var(--hud-canvas-dot-major) 1px, transparent 1px)',
          ].join(', '),
          backgroundSize: '24px 24px, 120px 120px',
        }}
      />
      <div
        className="relative"
        style={{
          width: bounds.width,
          height: bounds.height,
        }}
      >
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
          {document.connections.map(connection => (
            <WorkflowConnectionPath
              key={connection.id}
              connection={connection}
              nodes={document.nodes}
              nodeTypes={nodeTypes}
            />
          ))}
        </svg>
        {document.nodes.map(node => (
          <WorkflowNodeCard
            key={node.id}
            node={node}
            nodeType={nodeTypes.get(node.typeID)}
            selected={selectedNodeId === node.id}
            onSelect={() => onSelectNode?.(node.id)}
          />
        ))}
      </div>
    </div>
  );
}

function WorkflowNodeCard({
  node,
  nodeType,
  selected,
  onSelect,
}: {
  node: HudWorkflowNode;
  nodeType?: HudWorkflowNodeTypeSchema;
  selected: boolean;
  onSelect: () => void;
}) {
  const tint = nodeType?.tint ?? 'neutral';
  const tone = tintClasses[tint] ?? tintClasses.neutral;
  const width = node.size?.width ?? NODE_WIDTH;
  const height = node.size?.height ?? NODE_HEIGHT;
  const disabled = node.isEnabled === false;
  const style = {
    left: node.position.x + PADDING,
    top: node.position.y + PADDING,
    width,
    height,
    '--workflow-node-border': `color-mix(in oklab, ${tone.color} 36%, transparent)`,
    '--workflow-node-bg': `color-mix(in oklab, ${tone.color} 10%, oklch(var(--card) / 0.72))`,
    '--workflow-node-text': `color-mix(in oklab, ${tone.color} 70%, var(--hud-ink))`,
    '--workflow-node-dot': `color-mix(in oklab, ${tone.color} 82%, var(--hud-ink))`,
  } as CSSProperties & Record<
    '--workflow-node-border' | '--workflow-node-bg' | '--workflow-node-text' | '--workflow-node-dot',
    string
  >;

  return (
    <button
      type="button"
      className={`absolute rounded border border-[color:var(--workflow-node-border)] bg-[var(--workflow-node-bg)] p-3 text-left text-foreground shadow-[0_18px_40px_rgba(17,24,39,0.10)] transition ${
        selected ? 'ring-2 ring-accent/45' : 'hover:-translate-y-0.5 hover:border-foreground/20'
      } ${disabled ? 'opacity-48 grayscale' : ''}`}
      style={style}
      onClick={event => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'var(--workflow-node-dot)' }} />
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--workflow-node-text)' }}>
          {nodeType?.label ?? node.typeID}
        </span>
        <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-muted-foreground/68">
          {nodeType?.category ?? 'Node'}
        </span>
      </div>
      <div className="mt-3 truncate text-[14px] font-semibold text-foreground/88">
        {node.title}
      </div>
      {node.subtitle && (
        <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground/78">
          {node.subtitle}
        </div>
      )}
      <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
        {node.outputKey && (
          <span className="min-w-0 truncate rounded border border-accent/20 bg-accent/10 px-1.5 py-0.5 font-mono text-[9px] text-accent">
            {node.outputKey}
          </span>
        )}
        {node.condition && (
          <span className="min-w-0 truncate rounded border border-warning/20 bg-warning/10 px-1.5 py-0.5 font-mono text-[9px] text-warning">
            condition
          </span>
        )}
        {disabled && (
          <span className="ml-auto rounded border border-border/70 bg-muted/60 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            disabled
          </span>
        )}
      </div>
    </button>
  );
}

function WorkflowConnectionPath({
  connection,
  nodes,
  nodeTypes,
}: {
  connection: HudWorkflowConnection;
  nodes: HudWorkflowNode[];
  nodeTypes: Map<string, HudWorkflowNodeTypeSchema>;
}) {
  const source = nodes.find(node => node.id === connection.sourceNodeID);
  const target = nodes.find(node => node.id === connection.targetNodeID);
  if (!source || !target) return null;

  const sourceWidth = source.size?.width ?? NODE_WIDTH;
  const sourceHeight = source.size?.height ?? NODE_HEIGHT;
  const targetHeight = target.size?.height ?? NODE_HEIGHT;
  const start = {
    x: source.position.x + sourceWidth + PADDING,
    y: source.position.y + sourceHeight / 2 + PADDING,
  };
  const end = {
    x: target.position.x + PADDING,
    y: target.position.y + targetHeight / 2 + PADDING,
  };
  const reversed = end.x < start.x;
  const dx = Math.max(90, Math.abs(end.x - start.x) * 0.42);
  const c1 = { x: start.x + (reversed ? -dx : dx), y: start.y };
  const c2 = { x: end.x - (reversed ? -dx : dx), y: end.y };
  const sourceType = nodeTypes.get(source.typeID);
  const tone = tintClasses[sourceType?.tint ?? 'neutral'] ?? tintClasses.neutral;
  const labelX = (start.x + end.x) / 2;
  const labelY = (start.y + end.y) / 2 - 10;

  return (
    <g>
      <path
        d={`M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`}
        fill="none"
        stroke="oklch(var(--muted-foreground) / 0.22)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d={`M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`}
        fill="none"
        stroke={tone.line}
        strokeOpacity="0.72"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx={start.x} cy={start.y} r="4" fill={tone.line} opacity="0.72" />
      <circle cx={end.x} cy={end.y} r="4" fill="oklch(var(--muted-foreground) / 0.74)" />
      {connection.label && (
        <g>
          <rect
            x={labelX - connection.label.length * 3.6 - 8}
            y={labelY - 9}
            width={connection.label.length * 7.2 + 16}
            height="18"
            rx="5"
            fill="oklch(var(--card) / 0.88)"
            stroke="oklch(var(--border) / 0.95)"
          />
          <text
            x={labelX}
            y={labelY + 4}
            textAnchor="middle"
            fill="oklch(var(--muted-foreground) / 0.84)"
            className="font-mono text-[10px]"
          >
            {connection.label}
          </text>
        </g>
      )}
    </g>
  );
}

function getGraphBounds(nodes: HudWorkflowNode[]) {
  const maxX = Math.max(...nodes.map(node => node.position.x + (node.size?.width ?? NODE_WIDTH)), 900);
  const maxY = Math.max(...nodes.map(node => node.position.y + (node.size?.height ?? NODE_HEIGHT)), 520);
  return {
    width: maxX + PADDING * 2,
    height: maxY + PADDING * 2,
  };
}

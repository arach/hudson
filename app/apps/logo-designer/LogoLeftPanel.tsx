'use client';
import { useMemo, useState } from 'react';
import { X, RotateCcw, ChevronRight, GitBranch } from 'lucide-react';
import { useLogo } from './LogoProvider';
import { isBuiltinVariant, type LogoTemplate } from './types';

// ---------------------------------------------------------------------------
// Left panel — variant selection + presets (navigation only)
// ---------------------------------------------------------------------------

interface TemplateNode {
  template: LogoTemplate;
  children: TemplateNode[];
}

/**
 * Build a tree of templates by parentId. Roots are templates with no parent
 * (or whose parent is missing/discarded). Children are recursively nested.
 * Stable order: roots in their original `templates` order; children in their
 * original order under each parent.
 */
function buildTree(templates: LogoTemplate[]): TemplateNode[] {
  const byId = new Map(templates.map(t => [t.id, t]));
  const childrenByParent = new Map<string, LogoTemplate[]>();
  const roots: LogoTemplate[] = [];
  for (const t of templates) {
    if (t.parentId && byId.has(t.parentId)) {
      const list = childrenByParent.get(t.parentId) ?? [];
      list.push(t);
      childrenByParent.set(t.parentId, list);
    } else {
      roots.push(t);
    }
  }
  const toNode = (t: LogoTemplate): TemplateNode => ({
    template: t,
    children: (childrenByParent.get(t.id) ?? []).map(toNode),
  });
  return roots.map(toNode);
}

export function LogoLeftPanel() {
  const {
    params, setParam, setVariant, resetDefaults, presets,
    templates, discardTemplate, restoreTemplate, discardedIds,
  } = useLogo();

  const [showDiscarded, setShowDiscarded] = useState(false);
  const [collapsedRoots, setCollapsedRoots] = useState<Set<string>>(new Set());

  const activeTemplates = useMemo(
    () => templates.filter(t => !discardedIds.has(t.id)),
    [templates, discardedIds],
  );
  const tree = useMemo(() => buildTree(activeTemplates), [activeTemplates]);
  const discardedTemplates = templates.filter(t => discardedIds.has(t.id));

  const toggleCollapsed = (id: string) => {
    setCollapsedRoots(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-4 p-3 text-sm overflow-y-auto h-full">
      {/* Template picker — rendered as a tree by parentId */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Variant</span>
        {templates.length === 0 && (
          <div className="text-[11px] text-muted-foreground px-2 py-3 text-center border border-dashed border-border/60 rounded-lg">
            Loading templates...
          </div>
        )}
        {tree.map(node => (
          <TemplateTreeNode
            key={node.template.id}
            node={node}
            depth={0}
            activeId={params.variant}
            collapsed={collapsedRoots}
            onToggleCollapsed={toggleCollapsed}
            onSetVariant={setVariant}
            onDiscard={discardTemplate}
          />
        ))}
      </div>

      {/* Discarded templates (collapsible) */}
      {discardedTemplates.length > 0 && (
        <div className="flex flex-col gap-1">
          <button
            onClick={() => setShowDiscarded(v => !v)}
            className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground/80 hover:text-foreground/80 transition-colors"
          >
            <ChevronRight size={10} className={`transition-transform ${showDiscarded ? 'rotate-90' : ''}`} />
            Discarded ({discardedTemplates.length})
          </button>
          {showDiscarded && (
            <div className="flex flex-col gap-1 pl-1">
              {discardedTemplates.map(t => (
                <div key={t.id} className="flex items-center gap-1.5 px-2 py-1.5 rounded border border-border/60 bg-muted/20 text-muted-foreground">
                  <span className="flex-1 text-[11px] truncate">{t.name}</span>
                  <button
                    onClick={() => restoreTemplate(t.id)}
                    className="p-0.5 rounded text-muted-foreground/80 hover:text-accent hover:bg-accent/10 transition-colors"
                    title="Restore template"
                  >
                    <RotateCcw size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Presets */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Presets</span>
        <div className="flex flex-wrap gap-1">
          {presets.map(p => (
            <button
              key={p.label}
              onClick={() => { Object.entries(p.params).forEach(([k, v]) => setParam(k as keyof typeof params, v as never)); }}
              className="px-2 py-1 rounded text-[10px] border border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground/80 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reset */}
      <button
        onClick={resetDefaults}
        className="mt-2 px-3 py-1.5 rounded-lg border border-border/60 bg-muted/20 text-[11px] text-muted-foreground hover:bg-muted/40 hover:text-foreground/80 transition-colors"
      >
        Reset defaults
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recursive tree row — renders one template plus its children indented under it.
// AI-spawned variants (templates with `parentId`) nest under their source.
// ---------------------------------------------------------------------------

interface TemplateTreeNodeProps {
  node: TemplateNode;
  depth: number;
  activeId: string;
  collapsed: Set<string>;
  onToggleCollapsed: (id: string) => void;
  onSetVariant: (id: string) => void;
  onDiscard: (id: string) => void;
}

function TemplateTreeNode({
  node, depth, activeId, collapsed, onToggleCollapsed, onSetVariant, onDiscard,
}: TemplateTreeNodeProps) {
  const t = node.template;
  const isActive = activeId === t.id;
  const isBuiltin = isBuiltinVariant(t.id);
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed.has(t.id);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-stretch gap-1">
        {hasChildren ? (
          <button
            onClick={() => onToggleCollapsed(t.id)}
            className="flex items-center px-1 rounded text-muted-foreground/70 hover:text-foreground/80 hover:bg-muted/30 transition-colors"
            title={isCollapsed ? `Show ${node.children.length} variant${node.children.length === 1 ? '' : 's'}` : 'Collapse'}
          >
            <ChevronRight size={11} className={`transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
          </button>
        ) : depth > 0 ? (
          <span className="w-[18px] shrink-0" aria-hidden="true" />
        ) : null}
        <button
          onClick={() => onSetVariant(t.id)}
          className={`flex-1 text-left px-2.5 py-2 rounded-lg border text-[12px] transition-colors ${
            isActive
              ? 'border-accent/40 bg-accent/10 text-foreground'
              : 'border-border/60 bg-muted/20 text-foreground/70 hover:bg-muted/40'
          }`}
        >
          <div className="flex items-center gap-1.5">
            {depth > 0 && (
              <GitBranch size={9} className="text-muted-foreground/60 shrink-0" aria-hidden="true" />
            )}
            <span className="font-medium truncate">{t.name}</span>
            {isBuiltin && (
              <span className="text-[8px] px-1 py-0.5 rounded bg-muted/40 text-muted-foreground uppercase tracking-wider shrink-0">built-in</span>
            )}
            {hasChildren && (
              <span className="ml-auto text-[9px] tabular-nums text-muted-foreground/70 shrink-0">
                {node.children.length}
              </span>
            )}
          </div>
          {t.description && (
            <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{t.description}</div>
          )}
        </button>
        {!isBuiltin && (
          <button
            onClick={() => onDiscard(t.id)}
            className="flex items-center px-1.5 rounded-lg border border-border/60 bg-muted/20 text-muted-foreground/80 hover:text-warning hover:bg-warning/10 hover:border-warning/30 transition-colors"
            title="Discard template (recoverable for 7 days)"
          >
            <X size={12} />
          </button>
        )}
      </div>
      {hasChildren && !isCollapsed && (
        <div className="flex flex-col gap-1 pl-3.5 ml-[7px] border-l border-border/40">
          {node.children.map(child => (
            <TemplateTreeNode
              key={child.template.id}
              node={child}
              depth={depth + 1}
              activeId={activeId}
              collapsed={collapsed}
              onToggleCollapsed={onToggleCollapsed}
              onSetVariant={onSetVariant}
              onDiscard={onDiscard}
            />
          ))}
        </div>
      )}
    </div>
  );
}

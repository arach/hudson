'use client';

import { Type, Image as ImageIcon, Globe, Hash, Trash2 } from 'hudsonkit/icons';
import { useWorkspaceDecor } from 'hudsonkit/workspace';
import type { DecorationItem } from 'hudsonkit/workspace';

const ICONS: Record<DecorationItem['type'], React.ComponentType<{ size?: number }>> = {
  text: Type,
  image: ImageIcon,
  web: Globe,
  'step-card': Hash,
};

function itemLabel(item: DecorationItem): string {
  switch (item.type) {
    case 'text':
      return item.text || `<${item.subtype}>`;
    case 'image':
      return item.alt || item.caption || item.src || 'Image';
    case 'web':
      return item.title || item.url;
    case 'step-card':
      return `${item.step} · ${item.verb}`;
  }
}

function itemSubtype(item: DecorationItem): string {
  switch (item.type) {
    case 'text':
      return item.subtype;
    case 'image':
      return 'image';
    case 'web':
      return 'web';
    case 'step-card':
      return 'step';
  }
}

export function StageDesignLeftPanel() {
  const decor = useWorkspaceDecor();

  if (decor.items.length === 0) {
    return (
      <div className="px-3 py-4 text-[11px] text-[var(--hud-ink-2)] font-mono">
        No items placed.
        <div className="mt-2 text-[var(--hud-ink-3)]">
          Use the + buttons in the navigation bar to add text, images, or web embeds to the canvas.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {decor.items.map((item) => {
        const Icon = ICONS[item.type];
        const isSelected = decor.selectedId === item.id;
        return (
          <div
            key={item.id}
            className={
              'group flex items-center border-l-2 ' +
              (isSelected
                ? 'border-l-[var(--hud-accent,#f59e0b)] bg-[var(--hud-accent-soft)] text-[var(--hud-ink)]'
                : 'border-l-transparent hover:bg-[var(--hud-accent-soft)] text-[var(--hud-ink-2)] hover:text-[var(--hud-ink)]')
            }
          >
            <button
              type="button"
              onClick={() => decor.selectItem(item.id)}
              className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-[12px]"
            >
              <Icon size={12} />
              <div className="min-w-0 flex-1">
                <div className="truncate">{itemLabel(item)}</div>
                <div className="text-[9px] uppercase tracking-[0.18em] text-[var(--hud-ink-3)] mt-0.5">
                  {itemSubtype(item)}
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                decor.removeItem(item.id);
              }}
              className="opacity-0 group-hover:opacity-100 text-[var(--hud-ink-3)] hover:text-[var(--hud-ink)]"
              aria-label="Remove"
            >
              <Trash2 size={11} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

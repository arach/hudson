'use client';

import { Type, Image as ImageIcon, Globe, Hash, Eye, EyeOff, LoaderCircle, Save } from 'lucide-react';
import { useWorkspaceDecor } from '../../shell/decor/WorkspaceDecorContext';
import type { DecorationType } from '../../shell/decor/types';

const BTN =
  'inline-flex items-center justify-center w-7 h-7 rounded-[3px] text-white/50 hover:text-white/90 hover:bg-white/[0.06] transition-colors';

interface AddButtonProps {
  type: DecorationType;
  icon: React.ReactNode;
  label: string;
}

function AddButton({ type, icon, label }: AddButtonProps) {
  const decor = useWorkspaceDecor();
  return (
    <button
      type="button"
      onClick={() => decor.addItem(type, { x: 0, y: 0 })}
      className={BTN}
      title={`Add ${label}`}
      aria-label={`Add ${label}`}
    >
      {icon}
    </button>
  );
}

/** Right-side nav actions: the + tools + visibility toggle. */
export function StageDesignHeaderActions() {
  const decor = useWorkspaceDecor();
  const saveTitle = decor.saveError
    ? `Save failed: ${decor.saveError}`
    : decor.lastSavedAt
      ? `Saved ${new Date(decor.lastSavedAt).toLocaleTimeString()}`
      : 'Save stage snapshot';
  return (
    <div className="flex items-center gap-0.5">
      <AddButton type="text" icon={<Type size={13} />} label="text" />
      <AddButton type="image" icon={<ImageIcon size={13} />} label="image" />
      <AddButton type="web" icon={<Globe size={13} />} label="web embed" />
      <AddButton type="step-card" icon={<Hash size={13} />} label="step card" />
      <span className="mx-1.5 w-px h-4 bg-white/10" />
      <button
        type="button"
        onClick={() => { void decor.saveSnapshot(); }}
        className={BTN}
        title={saveTitle}
        aria-label="Save stage snapshot"
        disabled={decor.isSaving}
      >
        {decor.isSaving ? <LoaderCircle size={13} className="animate-spin" /> : <Save size={13} />}
      </button>
      <button
        type="button"
        onClick={() => decor.setVisible(!decor.visible)}
        className={BTN}
        title={decor.visible ? 'Hide all decorations' : 'Show all decorations'}
        aria-label={decor.visible ? 'Hide all decorations' : 'Show all decorations'}
      >
        {decor.visible ? <Eye size={13} /> : <EyeOff size={13} />}
      </button>
    </div>
  );
}

/** Center label so users know what they're staging. */
export function StageDesignNavCenter() {
  const decor = useWorkspaceDecor();
  const saveState = decor.isSaving ? 'saving' : decor.saveError ? 'save failed' : decor.lastSavedAt ? 'saved' : 'local';
  return (
    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-mono text-white/40">
      <span>Stage</span>
      <span className="opacity-30">·</span>
      <span>{decor.items.length} placed</span>
      <span className="opacity-30">·</span>
      <span className={decor.saveError ? 'text-red-300/70' : undefined}>{saveState}</span>
      {!decor.visible ? <span className="text-amber-300/70">· hidden</span> : null}
    </div>
  );
}

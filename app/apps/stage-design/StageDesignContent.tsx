'use client';

import { useWorkspaceDecor } from '../../shell/decor/WorkspaceDecorContext';
import type {
  DecorationItem,
  ImageDecor,
  StepCardDecor,
  TextDecor,
  WebDecor,
} from '../../shell/decor/types';
import { SIZING_PRESETS } from '../../shell/decor/types';

const FIELD_LABEL =
  'block text-[10px] uppercase tracking-[0.18em] text-[var(--hud-ink-3)] font-mono mb-1.5';
const FIELD_INPUT =
  'w-full bg-[var(--hud-bg-2)] border border-[var(--hud-line)] rounded-[3px] px-2 py-1.5 text-[13px] text-[var(--hud-ink)] font-mono outline-none placeholder:text-[var(--hud-ink-3)] focus:border-[var(--hud-accent,#f59e0b)] transition-colors';
const FIELD_TEXTAREA = FIELD_INPUT + ' resize-y min-h-[64px]';
const SECTION_HEAD =
  'text-[10px] uppercase tracking-[0.22em] text-[var(--hud-ink-3)] font-mono mb-3';
const SUBTLE_LINK =
  'text-[var(--hud-ink-2)] hover:text-[var(--hud-ink)] underline-offset-2 hover:underline disabled:opacity-40';
const CAN_SAVE_SNAPSHOTS = process.env.NODE_ENV === 'development';

export function StageDesignContent() {
  const decor = useWorkspaceDecor();

  const selected = decor.items.find((it) => it.id === decor.selectedId) ?? null;

  if (!selected) {
    return (
      <div className="h-full overflow-auto p-6 max-w-2xl">
        <div className={SECTION_HEAD}>Stage</div>
        <h1 className="text-[24px] font-display italic text-[var(--hud-ink)] mb-4">
          The workspace canvas, set.
        </h1>
        <p className="text-[13px] text-[var(--hud-ink-2)] leading-relaxed mb-6 max-w-[60ch]">
          Stage Design manages the read-only placards on this workspace canvas
          — text, images, and web embeds that live behind your app windows. Use
          the + buttons up top to place an item, then select it from the left to
          edit its content here.
        </p>

        <div className="flex items-center gap-3 text-[11px] font-mono text-[var(--hud-ink-2)]">
          <span>{decor.items.length} placed</span>
          <span className="opacity-30">·</span>
          <span>{decor.visible ? 'visible' : 'hidden'}</span>
          {CAN_SAVE_SNAPSHOTS ? (
            <>
              <span className="opacity-30">·</span>
              <button
                type="button"
                onClick={() => { void decor.saveSnapshot(); }}
                className={SUBTLE_LINK}
                disabled={decor.isSaving}
              >
                {decor.isSaving ? 'saving' : 'save snapshot'}
              </button>
            </>
          ) : null}
          {decor.items.length > 0 ? (
            <>
              <span className="opacity-30">·</span>
              <button
                type="button"
                onClick={decor.resetToSeed}
                className={SUBTLE_LINK}
              >
                reset to seed
              </button>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6 max-w-2xl">
      <div className={SECTION_HEAD}>Selected · {selected.type}</div>
      <ItemEditor item={selected} />

      <div className="mt-8 pt-4 border-t border-[var(--hud-line)] flex items-center justify-between">
        <button
          type="button"
          onClick={() => decor.removeItem(selected.id)}
          className="text-[11px] font-mono text-red-300/70 hover:text-red-300 transition-colors"
        >
          Delete item
        </button>
        <button
          type="button"
          onClick={() => decor.selectItem(null)}
          className="text-[11px] font-mono text-[var(--hud-ink-3)] hover:text-[var(--hud-ink)] transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function ItemEditor({ item }: { item: DecorationItem }) {
  switch (item.type) {
    case 'text':
      return <TextEditor item={item} />;
    case 'image':
      return <ImageEditor item={item} />;
    case 'web':
      return <WebEditor item={item} />;
    case 'step-card':
      return <StepCardEditor item={item} />;
  }
}

// ── Position + size shared section ─────────────────────────────────────────

function PositionRow({ item }: { item: DecorationItem }) {
  const { updateItem } = useWorkspaceDecor();
  return (
    <div className="grid grid-cols-4 gap-2 mt-4">
      <div>
        <label className={FIELD_LABEL}>X</label>
        <input
          type="number"
          className={FIELD_INPUT}
          value={Math.round(item.x)}
          onChange={(e) => updateItem(item.id, { x: Number(e.target.value) })}
        />
      </div>
      <div>
        <label className={FIELD_LABEL}>Y</label>
        <input
          type="number"
          className={FIELD_INPUT}
          value={Math.round(item.y)}
          onChange={(e) => updateItem(item.id, { y: Number(e.target.value) })}
        />
      </div>
      <div>
        <label className={FIELD_LABEL}>W</label>
        <input
          type="number"
          className={FIELD_INPUT}
          value={Math.round(item.w)}
          onChange={(e) => updateItem(item.id, { w: Number(e.target.value) })}
        />
      </div>
      <div>
        <label className={FIELD_LABEL}>H</label>
        <input
          type="number"
          className={FIELD_INPUT}
          value={Math.round(item.h)}
          onChange={(e) => updateItem(item.id, { h: Number(e.target.value) })}
        />
      </div>
    </div>
  );
}

function SizingRow({ item }: { item: DecorationItem }) {
  const { updateItem } = useWorkspaceDecor();
  const presets = ['small', 'medium', 'large', 'full'] as const;
  return (
    <div className="mt-4">
      <label className={FIELD_LABEL}>Sizing preset</label>
      <div className="flex gap-1.5">
        {presets.map((p) => {
          const isActive = item.sizing === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => {
                const dim = SIZING_PRESETS[p];
                updateItem(item.id, { sizing: p, w: dim.w, h: dim.h });
              }}
              className={
                'px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] font-mono border rounded-[3px] transition-colors ' +
                (isActive
                  ? 'border-[var(--hud-accent,#f59e0b)] text-[var(--hud-accent,#f59e0b)]'
                  : 'border-[var(--hud-line)] text-[var(--hud-ink-2)] hover:text-[var(--hud-ink)] hover:border-[var(--hud-line-strong)]')
              }
            >
              {p}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Text editor ────────────────────────────────────────────────────────────

function TextEditor({ item }: { item: TextDecor }) {
  const { updateItem } = useWorkspaceDecor();
  const subtypes: TextDecor['subtype'][] = ['eyebrow', 'display-title', 'body', 'divider'];

  return (
    <div className="space-y-1">
      <label className={FIELD_LABEL}>Treatment</label>
      <div className="flex gap-1.5 mb-4">
        {subtypes.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => updateItem(item.id, { subtype: s })}
            className={
              'px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] font-mono border rounded-[3px] transition-colors ' +
              (item.subtype === s
                ? 'border-[var(--hud-accent,#f59e0b)] text-[var(--hud-accent,#f59e0b)]'
                : 'border-[var(--hud-line)] text-[var(--hud-ink-2)] hover:text-[var(--hud-ink)] hover:border-[var(--hud-line-strong)]')
            }
          >
            {s}
          </button>
        ))}
      </div>

      <label className={FIELD_LABEL}>Text</label>
      <textarea
        className={FIELD_TEXTAREA}
        value={item.text}
        onChange={(e) => updateItem(item.id, { text: e.target.value })}
      />

      {item.subtype === 'display-title' ? (
        <div className="mt-3">
          <label className={FIELD_LABEL}>
            Accent word (italicized + accent color)
          </label>
          <input
            type="text"
            className={FIELD_INPUT}
            placeholder="e.g. Hudson embed."
            value={item.accent ?? ''}
            onChange={(e) => updateItem(item.id, { accent: e.target.value || undefined })}
          />
        </div>
      ) : null}

      <PositionRow item={item} />
    </div>
  );
}

// ── Image editor ───────────────────────────────────────────────────────────

function ImageEditor({ item }: { item: ImageDecor }) {
  const { updateItem } = useWorkspaceDecor();
  return (
    <div className="space-y-1">
      <label className={FIELD_LABEL}>Image URL</label>
      <input
        type="text"
        className={FIELD_INPUT}
        placeholder="https://…"
        value={item.src}
        onChange={(e) => updateItem(item.id, { src: e.target.value })}
      />

      <div className="mt-3">
        <label className={FIELD_LABEL}>Alt text</label>
        <input
          type="text"
          className={FIELD_INPUT}
          value={item.alt ?? ''}
          onChange={(e) => updateItem(item.id, { alt: e.target.value })}
        />
      </div>

      <div className="mt-3">
        <label className={FIELD_LABEL}>Caption</label>
        <input
          type="text"
          className={FIELD_INPUT}
          value={item.caption ?? ''}
          onChange={(e) => updateItem(item.id, { caption: e.target.value })}
        />
      </div>

      <SizingRow item={item} />
      <PositionRow item={item} />
    </div>
  );
}

// ── Web editor ─────────────────────────────────────────────────────────────

function WebEditor({ item }: { item: WebDecor }) {
  const { updateItem } = useWorkspaceDecor();
  return (
    <div className="space-y-1">
      <label className={FIELD_LABEL}>URL</label>
      <input
        type="text"
        className={FIELD_INPUT}
        placeholder="https://…"
        value={item.url}
        onChange={(e) => updateItem(item.id, { url: e.target.value })}
      />

      <div className="mt-3">
        <label className={FIELD_LABEL}>Title</label>
        <input
          type="text"
          className={FIELD_INPUT}
          value={item.title ?? ''}
          onChange={(e) => updateItem(item.id, { title: e.target.value })}
        />
      </div>

      <SizingRow item={item} />
      <PositionRow item={item} />

      <div className="mt-4 text-[11px] font-mono text-[var(--hud-ink-3)] leading-relaxed">
        Many sites block iframe embedding (X-Frame-Options). When that happens,
        the placard renders a link card with the hostname and title instead.
      </div>
    </div>
  );
}

// ── Step card editor ───────────────────────────────────────────────────────

function StepCardEditor({ item }: { item: StepCardDecor }) {
  const { updateItem } = useWorkspaceDecor();
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={FIELD_LABEL}>Step</label>
          <input
            type="text"
            className={FIELD_INPUT}
            placeholder="01"
            value={item.step}
            onChange={(e) => updateItem(item.id, { step: e.target.value })}
          />
        </div>
        <div>
          <label className={FIELD_LABEL}>Verb</label>
          <input
            type="text"
            className={FIELD_INPUT}
            placeholder="DECLARE"
            value={item.verb}
            onChange={(e) => updateItem(item.id, { verb: e.target.value.toUpperCase() })}
          />
        </div>
      </div>

      <div className="mt-3">
        <label className={FIELD_LABEL}>Body</label>
        <input
          type="text"
          className={FIELD_INPUT}
          placeholder="typed manifest"
          value={item.body}
          onChange={(e) => updateItem(item.id, { body: e.target.value })}
        />
      </div>

      <div className="mt-3">
        <label className={FIELD_LABEL}>Code (optional)</label>
        <textarea
          className={FIELD_TEXTAREA}
          placeholder="{ id: 'talkie' }"
          value={item.code ?? ''}
          onChange={(e) => updateItem(item.id, { code: e.target.value })}
        />
      </div>

      <PositionRow item={item} />
    </div>
  );
}

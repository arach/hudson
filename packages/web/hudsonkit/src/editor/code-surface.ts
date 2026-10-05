import { EditorSelection, EditorState, StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, drawSelection, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import { syntaxHighlighting } from '@codemirror/language';
import { hudsonEditorTheme, hudsonHighlightStyle } from './code-theme';
import type { SourceRange } from './subject-store';
const setHighlights = StateEffect.define<readonly SourceRange[]>();
const highlights = StateField.define({
  create: () => Decoration.none,
  update(value, transaction) {
    value = value.map(transaction.changes);
    for (const effect of transaction.effects) if (effect.is(setHighlights)) {
      value = Decoration.set(effect.value.filter(r => r.from < r.to).map(r =>
        Decoration.mark({ class: 'hk-code-selection' }).range(r.from, r.to)), true);
    }
    return value;
  },
  provide: field => EditorView.decorations.from(field),
});
export function createReadOnlyCodeSurface(host: HTMLElement, options: {
  text: string; onSelect?: (ranges: SourceRange[]) => void;
}) {
  let applying = false;
  let revealRange: SourceRange | undefined;
  const view = new EditorView({ parent: host, state: EditorState.create({ doc: options.text, extensions: [
    EditorState.readOnly.of(true), EditorView.editable.of(false),
    EditorView.contentAttributes.of({ tabindex: '0', 'aria-label': 'Read-only source', 'aria-readonly': 'true' }),
    lineNumbers(), drawSelection(), keymap.of(defaultKeymap), json(),
    syntaxHighlighting(hudsonHighlightStyle), hudsonEditorTheme, highlights,
    EditorView.theme({ '.hk-code-selection': { backgroundColor: 'var(--hud-accent-soft)', color: 'var(--hud-ink)' } }),
    EditorView.updateListener.of(update => {
      if (!applying && update.selectionSet) options.onSelect?.(update.state.selection.ranges.map(r => ({ from: r.from, to: r.to })));
    }),
  ] }) });
  const reveal = () => {
    if (revealRange && host.getBoundingClientRect().height > 0) {
      view.dispatch({ effects: EditorView.scrollIntoView(EditorSelection.range(revealRange.from, revealRange.to), { y: 'nearest', x: 'nearest' }) });
    }
  };
  // Hidden panel mounts keep their editor. Reveal the current range when shown.
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(reveal);
  observer?.observe(host);
  return {
    setText(text: string) {
      if (view.state.doc.toString() === text) return;
      applying = true;
      try {
        const previous = view.state.selection.main;
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: text },
          selection: { anchor: Math.min(previous.anchor, text.length), head: Math.min(previous.head, text.length) },
          effects: setHighlights.of([]),
        });
      }
      finally { applying = false; }
    },
    highlight(ranges: readonly SourceRange[], options: { scroll?: boolean } = {}) {
      const valid = ranges.filter(r => Number.isInteger(r.from) && Number.isInteger(r.to) && r.from >= 0 && r.to <= view.state.doc.length && r.from <= r.to);
      // A source-origin highlight should not jump to the first duplicate.
      // Retain the actual cursor/range for a later resize or panel reveal.
      revealRange = options.scroll === false
        ? { from: view.state.selection.main.from, to: view.state.selection.main.to }
        : valid[0];
      view.dispatch({ effects: setHighlights.of(valid) });
      if (options.scroll !== false) reveal();
    },
    destroy: () => { observer?.disconnect(); view.destroy(); },
  };
}

import { HighlightStyle } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';

export const hudsonHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--hud-accent)' },
  { tag: [tags.name, tags.deleted, tags.character, tags.macroName], color: 'var(--hud-ink)' },
  { tag: [tags.propertyName, tags.attributeName], color: 'var(--hud-ink-1)' },
  { tag: [tags.processingInstruction, tags.string, tags.inserted], color: 'var(--hud-accent)' },
  { tag: [tags.function(tags.variableName), tags.labelName], color: 'var(--hud-ink-1)' },
  { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: 'var(--hud-status-warn)' },
  { tag: [tags.definition(tags.name), tags.separator], color: 'var(--hud-ink)' },
  { tag: [tags.className, tags.number, tags.changed, tags.annotation, tags.modifier], color: 'var(--hud-status-warn)' },
  { tag: [tags.typeName, tags.namespace], color: 'var(--hud-accent)' },
  { tag: [tags.operator, tags.operatorKeyword], color: 'var(--hud-muted)' },
  { tag: [tags.url, tags.escape, tags.regexp, tags.link], color: 'var(--hud-accent)' },
  { tag: tags.meta, color: 'var(--hud-muted)' },
  { tag: tags.comment, color: 'var(--hud-muted)', fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.heading, color: 'var(--hud-ink)', fontWeight: '700' },
  { tag: tags.atom, color: 'var(--hud-status-warn)' },
  { tag: tags.bool, color: 'var(--hud-status-warn)' },
  { tag: tags.special(tags.variableName), color: 'var(--hud-accent)' },
  { tag: tags.invalid, color: 'var(--hud-status-error)' },
]);

export const hudsonEditorTheme = EditorView.theme({
  '&': {
    height: '100%',
    width: '100%',
    minHeight: '0',
    minWidth: '0',
    backgroundColor: 'var(--hud-bg)',
    color: 'var(--hud-ink)',
    fontSize: '12px',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace',
    lineHeight: '1.6',
    height: '100%',
    minHeight: '0',
    overflow: 'auto',
    overscrollBehavior: 'contain',
  },
  '.cm-content': {
    padding: '10px 0 18px',
    caretColor: 'var(--hud-accent)',
    minHeight: '100%',
  },
  '.cm-line': { padding: '0 16px' },
  '.cm-gutters': {
    backgroundColor: 'var(--hud-surface)',
    color: 'var(--hud-muted)',
    borderRight: '1px solid var(--hud-border)',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 12px 0 14px',
    minWidth: '46px',
    textAlign: 'right',
  },
  '.cm-activeLine': { backgroundColor: 'var(--hud-accent-soft)' },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--hud-accent-soft)',
    color: 'var(--hud-ink)',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'var(--hud-accent-soft)',
  },
  '.cm-cursor': { borderLeftColor: 'var(--hud-accent)' },
  '.cm-foldGutter span': { color: 'rgba(255, 255, 255, 0.24)' },
  '.cm-swift-keyword': { color: 'var(--hud-accent)', fontWeight: '650' },
  '.cm-swift-type': { color: 'var(--hud-accent)' },
  '.cm-swift-string': { color: 'var(--hud-accent)' },
  '.cm-swift-number': { color: 'var(--hud-status-warn)' },
  '.cm-swift-attribute': { color: 'var(--hud-ink-1)' },
  '.cm-swift-comment': { color: 'var(--hud-muted)', fontStyle: 'italic' },
  '.cm-tooltip': {
    backgroundColor: '#0f1720',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '6px',
    color: 'rgba(255, 255, 255, 0.86)',
  },
});


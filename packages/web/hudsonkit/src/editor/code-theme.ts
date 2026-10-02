import { HighlightStyle } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';

export const hudsonHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#67e8f9' },
  { tag: [tags.name, tags.deleted, tags.character, tags.macroName], color: '#e5e7eb' },
  { tag: [tags.propertyName, tags.attributeName], color: '#bae6fd' },
  { tag: [tags.processingInstruction, tags.string, tags.inserted], color: '#6ee7b7' },
  { tag: [tags.function(tags.variableName), tags.labelName], color: '#93c5fd' },
  { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: '#fcd34d' },
  { tag: [tags.definition(tags.name), tags.separator], color: '#f8fafc' },
  { tag: [tags.className, tags.number, tags.changed, tags.annotation, tags.modifier], color: '#fbbf24' },
  { tag: [tags.typeName, tags.namespace], color: '#22d3ee' },
  { tag: [tags.operator, tags.operatorKeyword], color: '#94a3b8' },
  { tag: [tags.url, tags.escape, tags.regexp, tags.link], color: '#38bdf8' },
  { tag: tags.meta, color: '#94a3b8' },
  { tag: tags.comment, color: '#64748b', fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.heading, color: '#f8fafc', fontWeight: '700' },
  { tag: tags.atom, color: '#fcd34d' },
  { tag: tags.bool, color: '#fcd34d' },
  { tag: tags.special(tags.variableName), color: '#38bdf8' },
  { tag: tags.invalid, color: '#f87171' },
]);

export const hudsonEditorTheme = EditorView.theme({
  '&': {
    height: '100%',
    width: '100%',
    minHeight: '0',
    minWidth: '0',
    backgroundColor: '#0a0f12',
    color: 'rgba(241, 245, 249, 0.86)',
    fontSize: '12px',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Monaco, Consolas, monospace',
    lineHeight: '1.6',
    height: '100%',
    minHeight: '0',
    overflow: 'auto',
    overscrollBehavior: 'contain',
  },
  '.cm-content': {
    padding: '10px 0 18px',
    caretColor: '#22d3ee',
    minHeight: '100%',
  },
  '.cm-line': { padding: '0 16px' },
  '.cm-gutters': {
    backgroundColor: '#0d1518',
    color: 'rgba(148, 163, 184, 0.62)',
    borderRight: '1px solid rgba(94, 234, 212, 0.12)',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 12px 0 14px',
    minWidth: '46px',
    textAlign: 'right',
  },
  '.cm-activeLine': { backgroundColor: 'rgba(34, 211, 238, 0.055)' },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(34, 211, 238, 0.08)',
    color: 'rgba(207, 250, 254, 0.72)',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(14, 165, 233, 0.26)',
  },
  '.cm-cursor': { borderLeftColor: '#22d3ee' },
  '.cm-foldGutter span': { color: 'rgba(255, 255, 255, 0.24)' },
  '.cm-swift-keyword': { color: '#67e8f9', fontWeight: '650' },
  '.cm-swift-type': { color: '#22d3ee' },
  '.cm-swift-string': { color: '#6ee7b7' },
  '.cm-swift-number': { color: '#fcd34d' },
  '.cm-swift-attribute': { color: '#93c5fd' },
  '.cm-swift-comment': { color: '#64748b', fontStyle: 'italic' },
  '.cm-tooltip': {
    backgroundColor: '#0f1720',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '6px',
    color: 'rgba(255, 255, 255, 0.86)',
  },
});


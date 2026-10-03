import type { EditorSelection } from '../../packages/web/hudsonkit/src/editor/subject-store';
import type { EditorModel, Projection, PreviewRow } from './model';
export function isUnassigned(group: Projection['groups'][number]) {
  return group.id.toLowerCase() === 'unassigned' || group.label.toLowerCase() === 'unassigned';
}
export function orderedGroups(projection: Projection | null) {
  return [...(projection?.groups ?? [])].sort((a, b) => Number(isUnassigned(a)) - Number(isUnassigned(b)));
}
export function selectedRows(projection: Projection | null, selection: EditorSelection) {
  const ids = new Set(selection.refs.filter(ref => ref.kind === 'lattices.window').map(ref => ref.id));
  return orderedGroups(projection).flatMap(group => group.rows).filter(row => ids.has(row.id));
}
export function glyphTint(app: string) {
  return ['slate', 'blue', 'teal'][Array.from(app).reduce((hash, char) => (hash * 31 + char.codePointAt(0)!) >>> 0, 0) % 3];
}
export function rowLabel(row: PreviewRow) { return `${row.app} — ${row.title || 'Untitled window'}`; }
export function toggleRow(ids: string[], id: string, additive: boolean) {
  return additive ? ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id] : [id];
}
export function removeContextRow(model: EditorModel, id: string) {
  const ids = selectedRows(model.getSnapshot().projection, model.selection.getSnapshot().selection).filter(row => row.id !== id).map(row => row.id);
  model.selectRows(ids);
}
export function scrollRowIntoView(row: Pick<HTMLElement, 'scrollIntoView'> | undefined) {
  row?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
}
export function shortRevision(revision: string) {
  return revision.startsWith('sha256:') ? revision.slice(7, 14) : revision.slice(0, 12);
}
export function relativeTime(at: string, now = Date.now()) {
  const seconds = Math.max(0, Math.floor((now - Date.parse(at)) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  const days = Math.floor(seconds / 86400);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

import type { Projection, PreviewRow } from './model';
export function overviewFacts(projection: Projection, id: string) {
  const group = projection.groups.find(g => g.id === id);
  const rows = group?.rows ?? [];
  const rules = projection.entries.filter(e => e.layerId === id).map(entry => {
    let raw: Record<string, unknown> = {};
    try { const value: unknown = JSON.parse(entry.canonical); if (value && typeof value === 'object' && !Array.isArray(value)) raw = value as Record<string, unknown>; } catch { /* Host-defined content may not be JSON. */ }
    const match = raw.match && typeof raw.match === 'object' ? raw.match as Record<string, unknown> : raw;
    const app = typeof match.app === 'string' ? match.app : undefined;
    const conditions = ['title','titleContains','titleEquals','titleRegex','url','path','group'].flatMap(key => typeof match[key] === 'string' ? [`${key==='title'||key==='titleContains'?'title has':key==='titleEquals'?'title is':key}: ${JSON.stringify(match[key])}`] : []);
    return { key:entry.key, app, text: conditions.join(' · ') || (app ? `App is ${app}` : entry.canonical),
      open: rows.filter(r => r.entryKeys.includes(entry.key)).length,
      occurrences: entry.ranges.length, pins: Array.isArray(raw.pins) ? raw.pins.length : undefined,
      display: typeof raw.display === 'string' || typeof raw.display === 'number' ? String(raw.display) : undefined };
  });
  const ruleCount = rules.reduce((n,r)=>n+r.occurrences,0);
  const unmatched = rules.filter(r=>!r.open).reduce((n,r)=>n+r.occurrences,0);
  const apps = [...new Set(rows.map(r=>r.app))];
  const description = `${rows.length ? `${rows.length} open ${rows.length===1?'window':'windows'}${apps.length ? ` in ${apps.join(', ')}` : ''}` : 'No windows are open'}${unmatched ? `; ${unmatched} ${unmatched===1?'rule has':'rules have'} no match` : ''}.`;
  return { rows, rules, ruleCount, description,
    pinned: rules.some(r=>r.pins !== undefined) ? rules.reduce((n,r)=>n+(r.pins ?? 0)*r.occurrences,0) : undefined,
    displays:[...new Set(rules.flatMap(r=>r.display === undefined ? [] : [r.display]))] };
}
export function contextLabel(name: string, rows: readonly PreviewRow[]) { return `${name} layer · ${rows.length} ${rows.length===1?'window':'windows'}`; }

/** Index selection is independent of row/source selection. Empty means all groups. */
export function overviewSelectionFacts(projection: Projection, ids: string[]) {
  const groups = ids.length ? ids.flatMap(id => projection.groups.filter(g => g.id === id)) : projection.groups;
  if (groups.length === 1 && ids.length) return overviewFacts(projection, groups[0].id);
  const facts = groups.map(g => overviewFacts(projection, g.id));
  const rows = groups.flatMap(g => g.rows), rules = facts.flatMap(f => f.rules);
  return { rows, rules, ruleCount: facts.reduce((n,f)=>n+f.ruleCount,0),
    description: `${rows.length} open ${rows.length === 1 ? 'window' : 'windows'} across ${ids.length ? `${groups.length} selected layers` : 'all layers and Unassigned'}.`,
    pinned: facts.some(f=>f.pinned!==undefined) ? facts.reduce((n,f)=>n+(f.pinned??0),0) : undefined,
    displays: [...new Set(facts.flatMap(f=>f.displays))] };
}
export function toggleLayer(ids: string[], id: string, additive: boolean) {
  return additive ? ids.includes(id) ? ids.filter(value=>value!==id) : [...ids,id] : [id];
}

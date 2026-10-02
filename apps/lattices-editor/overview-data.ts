import type { Projection, PreviewRow } from './model';
export function overviewFacts(projection: Projection, id: string) {
  const group = projection.groups.find(g => g.id === id);
  const rows = group?.rows ?? [];
  const rules = projection.entries.filter(e => e.layerId === id).map(entry => {
    let raw: Record<string, unknown> = {};
    try { const value: unknown = JSON.parse(entry.canonical); if (value && typeof value === 'object' && !Array.isArray(value)) raw = value as Record<string, unknown>; } catch { /* Host-defined content may not be JSON. */ }
    const match = raw.match && typeof raw.match === 'object' ? raw.match as Record<string, unknown> : raw;
    const app = typeof match.app === 'string' ? match.app : undefined;
    const conditions = ['title','url','path','group'].flatMap(key => typeof match[key] === 'string' ? [`${key}: ${match[key]}`] : []);
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

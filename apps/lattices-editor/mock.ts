import type { HostEnvelope, HostTransport } from '../../packages/web/hudsonkit/src/editor/host-bridge';
/** Synthetic development fixture. No membership resolver or production fallback. */
export function createMockTransport(options: { rich?: boolean; chrome?: 'host'; unreadable?: boolean } = {}) {
  let version = 1, inventory = 1, unreadable = options.unreadable ?? false, staleOnce = false;
  const listeners = new Set<(event: unknown) => void>();
  const calls: string[] = [];
  const uiStates: unknown[] = [];
  const id = 'workspace-layers';
  const revision = () => `mock:${version}`;
  const subject = () => ({ id, kind: 'lattices.workspace-layers', label: 'Workspace Layers', revision: unreadable ? null : revision() });
  function fixture() {
    const project = { match: { app: 'Synthetic Editor 🚀' }, saved: false };
    const additional = options.rich ? Array.from({ length: 12 }, (_, i) => ({
      match: { app: ['Ghostty', 'Xcode', 'Safari'][i % 3], title: ['Build logs', 'Workspace.swift', 'Design reference'][i % 3] + ' ' + (i + 1) },
      saved: false,
    })) : [];
    const text = JSON.stringify({ kind: 'workspace-layers', version: 1, layers: [{
      id: 'build', name: `Build ${version}`,
      ...(options.rich ? { notes: Array.from({ length: 30 }, (_, i) => `Synthetic configuration note ${i + 1}`) } : {}),
      projects: [project, project, ...additional],
    }] }, null, 2);
    const needle = JSON.stringify(project, null, 2).split('\n').map((line, index) => index ? '        ' + line : line).join('\n');
    const first = text.indexOf(needle), second = text.indexOf(needle, first + 1);
    if (first < 0 || second < 0) throw new Error('Mock range fixture is invalid');
    const entries = [{ key: 'mock:duplicate', layerId: 'build', canonical: JSON.stringify(project),
      ranges: [first, second].map(from => ({ from, to: from + needle.length })), ambiguous: true }];
    const extraRows = additional.map((value, index) => {
      const encoded = JSON.stringify(value, null, 2).split('\n').map((line, i) => i ? '        ' + line : line).join('\n');
      const from = text.indexOf(encoded);
      if (from < 0) throw new Error('Invalid rich fixture range');
      const key = `mock:entry:${index}`;
      entries.push({ key, layerId: 'build', canonical: JSON.stringify(value), ranges: [{ from, to: from + encoded.length }], ambiguous: false });
      return { id: `build:${100 + index}`, windowId: 100 + index, app: value.match.app, title: value.match.title, layerId: 'build', entryKeys: [key] };
    });
    const projection = { snapshotId: `mock:snapshot:${version}:${inventory}`, entries, groups: [
      { id: 'build', label: `Build ${version}`, rows: [{ id: 'build:42', windowId: 42, app: 'Synthetic Editor', title: `Fixture document ${inventory}`, layerId: 'build', entryKeys: ['mock:duplicate'] }, ...extraRows] },
      { id: 'unassigned', label: 'Unassigned', rows: [{ id: 'unassigned:43', windowId: 43, app: 'Synthetic Browser', title: 'No source entry', layerId: null, entryKeys: [] }] },
    ] };
    if (options.rich) {
      projection.groups.unshift(projection.groups.pop()!);
      projection.groups.splice(1, 0, { id: 'scout', label: 'Scout', rows: [] });
    }
    return { text, projection };
  }
  function emit(kind = 'config.changed') {
    const event: HostEnvelope = { v: 1, requestId: null, subjectId: id, revision: revision(), kind,
      payload: { subscriptionId: 'mock:subscription', at: new Date().toISOString() } };
    listeners.forEach(fn => fn(event));
  }
  const transport: HostTransport = {
    subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    async request(message) {
      calls.push(message.kind);
      const result = (payload: object, kind = `${message.kind}.result`): HostEnvelope => ({
        ...message, subjectId: id, revision: unreadable ? null : revision(), kind, payload,
      });
      const error = (code: string, message: string) => result({ code, message }, 'error');
      switch (message.kind) {
        case 'ui.state': uiStates.push(message.payload); return { ...result({}), revision: null };
        case 'capabilities': return result({ chrome: options.chrome, readOnly: true, methods: ['subject.read', 'preview.project', 'events.subscribe'], subject: subject(), terminal: false });
        case 'events.subscribe': return result({ subscriptionId: 'mock:subscription' });
        case 'subject.read': return unreadable ? error('unavailable', 'Synthetic workspace JSON is invalid.') : result({ subject: subject(), source: { text: fixture().text, language: 'json' } });
        case 'preview.project':
          if (staleOnce) { staleOnce = false; version++; return error('stale_revision', 'Synthetic revision changed during read'); }
          if (message.revision !== revision()) return error('stale_revision', 'Synthetic stale revision');
          return result(fixture().projection);
        default: return error('unsupported', 'Unknown mock call');
      }
    },
  };
  return { transport, calls, fixture, emit, uiStates,
    command(payload: unknown) { listeners.forEach(fn => fn({ v:1, requestId:null, subjectId:id, revision:null, kind:"ui.command", payload })); },
    change() { version++; emit(); },
    inventory() { inventory++; emit('windows.changed'); },
    invalid() { unreadable = true; emit(); },
    recover() { unreadable = false; emit(); },
    stale() { staleOnce = true; emit(); },
  };
}
export function mountMockControls(mock: ReturnType<typeof createMockTransport>) {
  const bar = document.createElement('aside');
  bar.setAttribute('aria-label', 'Development mock controls');
  bar.style.cssText = 'position:fixed;bottom:32px;right:0;z-index:100;background:var(--hud-surface);padding:4px;display:flex;gap:4px';
  bar.append('Synthetic host ');
  for (const [label, action] of Object.entries({ Change: mock.change, Inventory: mock.inventory, Invalid: mock.invalid, Recover: mock.recover, Stale: mock.stale })) {
    const button = document.createElement('button'); button.textContent = label; button.onclick = action; bar.append(button);
  }
  document.body.append(bar);
}

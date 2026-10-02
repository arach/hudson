import { createMockTransport, mountMockControls } from './mock';
import { createRoot } from 'react-dom/client';
import { createHostBridge, createWKReplyTransport } from '../../packages/web/hudsonkit/src/editor/host-bridge';
import { createEditorModel } from './model';
import { createLatticesEditorApp } from './app';
let transport = createWKReplyTransport(globalThis as unknown as Parameters<typeof createWKReplyTransport>[0]);
if (process.env.NODE_ENV !== 'production' && new URLSearchParams(location.search).has('mock')) {
  const query = new URLSearchParams(location.search);
  const mock = createMockTransport({ rich: true, chrome: query.has('host') ? 'host' : undefined, unreadable: query.has('unreadable') });
  Object.assign(globalThis, { editorMock: mock });
  mountMockControls(mock);
  transport = mock.transport;
}
const app = createLatticesEditorApp(createEditorModel(createHostBridge(transport)));
createRoot(document.getElementById('root')!).render(<app.Provider><app.slots.Content /></app.Provider>);

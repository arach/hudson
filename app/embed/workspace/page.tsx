// Static export: all theme resolution happens client-side via WorkspaceEmbedClient
// (postMessage API and URL params are read in the browser, not at build time)
import { Suspense } from 'react';
import WorkspaceEmbedClient from './WorkspaceEmbedClient';

export default function WorkspaceEmbedPage() {
  return (
    <Suspense>
      <WorkspaceEmbedClient />
    </Suspense>
  );
}

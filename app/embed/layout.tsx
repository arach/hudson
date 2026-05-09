import type { Metadata } from 'next';
import { consumers } from './registry';

export const metadata: Metadata = {
  title: 'Hudson — Embed',
  robots: { index: false, follow: false },
};

// Pre-paint script: read ?ref= and override `<html>`'s data-hudson-template /
// data-hudson-theme before first paint, so the html-level cascade (color-scheme,
// scrollbar styling) matches the consumer immediately. The page itself bakes
// the same attrs onto its wrapper for the visible content. The mapping is
// inlined from the consumer registry — small enough to ship inline.
function getEmbedThemeScript(): string {
  const refMap = Object.fromEntries(
    Object.values(consumers).map((c) => [c.ref, { t: c.template, m: c.theme }]),
  );
  const json = JSON.stringify(refMap);
  return `(function(){try{var r=new URLSearchParams(location.search).get('ref');if(!r)return;var c=(${json})[r];if(!c)return;var d=document.documentElement;d.dataset.hudsonTemplate=c.t;d.dataset.hudsonTheme=c.m;}catch(e){}})();`;
}

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: getEmbedThemeScript() }} />
      {children}
    </>
  );
}

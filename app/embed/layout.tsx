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

/**
 * HTML-safe JSON serializer for use inside an inline <script>.
 * JSON.stringify alone is not safe: a `</script>` substring in a string value
 * would terminate the script block. We also escape U+2028 / U+2029 which are
 * line-terminators in JS but valid inside JSON strings.
 */
function safeJsonForInlineScript(value: unknown): string {
  // U+2028 and U+2029 cannot appear literally inside a JS regex literal
  // (they are line terminators), so we use String.fromCharCode to build them.
  const LS = String.fromCharCode(0x2028);
  const PS = String.fromCharCode(0x2029);
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .split(LS).join('\\u2028')
    .split(PS).join('\\u2029');
}

function getEmbedThemeScript(): string {
  const refMap = Object.fromEntries(
    Object.values(consumers).map((c) => [c.ref, { t: c.template, m: c.theme }]),
  );
  const json = safeJsonForInlineScript(refMap);
  return `(function(){try{var q=new URLSearchParams(location.search),r=q.get('ref'),c=r&&(${json})[r],t=q.get('template')||(c&&c.t)||'hudson',m=q.get('theme')||(c&&c.m)||'dark';if(m!=='dark'&&m!=='light')m='dark';var d=document.documentElement;if(r)d.dataset.hudsonRef=r;d.dataset.hudsonTemplate=t;d.dataset.hudsonTheme=m;}catch(e){}})();`;
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

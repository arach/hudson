'use client';

import { useState, useCallback } from 'react';
import { Check, Copy, ExternalLink, Share2, Code2 } from 'hudsonkit/icons';
import { useThemeDesigner } from './ThemeDesignerProvider';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function resolvedRefId(refId: string, exportTemplateId: string): string | null {
  const id = refId.trim() || exportTemplateId.trim();
  return id || null;
}

function buildEmbedUrl(origin: string, refId: string): string {
  return `${origin}/embed/hudson/workspace?ref=${encodeURIComponent(refId)}`;
}

function buildIframeSnippet(url: string): string {
  return `<iframe\n  src="${url}"\n  width="100%"\n  height="600"\n  style="border:0;border-radius:8px"\n  loading="lazy"\n  title="Hudson workspace"\n></iframe>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Copy button with transient check mark
// ─────────────────────────────────────────────────────────────────────────────

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard not available — silently ignore
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? 'Copied!' : `Copy ${label}`}
      className="inline-flex shrink-0 items-center gap-1 rounded border border-border bg-card px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground transition hover:border-accent/60 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
      {copied ? 'Copied' : label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Live iframe preview
// ─────────────────────────────────────────────────────────────────────────────

function EmbedPreview({ url }: { url: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card/60" style={{ height: 220 }}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Loading preview…
        </div>
      )}
      <iframe
        src={url}
        title="Embed preview"
        width="100%"
        height="100%"
        style={{ border: 0, display: 'block', opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }}
        onLoad={() => setLoaded(true)}
        loading="lazy"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state — no ref registered yet
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/40 p-4 text-center">
      <Share2 size={16} className="mx-auto mb-2 text-muted-foreground" />
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        Save with &quot;Register ?ref preset&quot; to enable sharing
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel
// ─────────────────────────────────────────────────────────────────────────────

export function ShareEmbedPanel() {
  const { refId, exportTemplateId, registerRef, saveStatus } = useThemeDesigner();

  // Derive the effective ref: prefer the user-entered refId, fall back to
  // exportTemplateId. Both may be empty before templates have loaded.
  const effectiveRef = resolvedRefId(refId, exportTemplateId);

  // We need window.location.origin for the URL — guard SSR.
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  // The panel only shows a live preview / copy buttons when a ref has been
  // registered (either in this session via saveStatus containing "ref preset",
  // or by having a non-empty refId that the provider surfaced).
  const hasRef = Boolean(effectiveRef);
  const refRegistered = registerRef || saveStatus.includes('ref preset');

  if (!hasRef || !refRegistered) {
    return <EmptyState />;
  }

  const embedUrl = buildEmbedUrl(origin, effectiveRef!);
  const iframeSnippet = buildIframeSnippet(embedUrl);

  return (
    <div className="space-y-3">
      {/* Canonical URL */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Embed URL</span>
          <div className="flex items-center gap-1.5">
            <CopyButton text={embedUrl} label="URL" />
            <a
              href={embedUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in new tab"
              className="inline-flex items-center gap-1 rounded border border-border bg-card px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground transition hover:border-accent/60 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ExternalLink size={10} /> Open
            </a>
          </div>
        </div>
        <code className="block break-all rounded-md border border-border bg-background p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
          {embedUrl}
        </code>
      </div>

      {/* iframe snippet */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <Code2 size={11} /> iframe snippet
          </div>
          <CopyButton text={iframeSnippet} label="HTML" />
        </div>
        <pre className="overflow-x-auto rounded-md border border-border bg-background p-2 font-mono text-[10px] leading-relaxed text-muted-foreground whitespace-pre-wrap break-all">
          {iframeSnippet}
        </pre>
      </div>

      {/* Live preview */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Live preview</div>
        <EmbedPreview url={embedUrl} />
      </div>
    </div>
  );
}

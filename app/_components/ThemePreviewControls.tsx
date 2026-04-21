'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTheme } from '@hudson/sdk';

const themes = ['light', 'dark', 'system'] as const;

export function ThemePreviewControls() {
  const { theme, resolvedTheme, template, setTheme, setTemplate } = useTheme();
  // The theme/template/resolvedTheme values come from localStorage + matchMedia
  // on the client — they don't exist on the server, so any SSR render would
  // mismatch. Gate this widget on a post-mount flag to avoid the hydration warning.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed right-4 bottom-4 z-30 w-[240px] rounded-lg border border-border/80 bg-card/90 p-3 text-foreground shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-[0.24em] text-muted-foreground">
            Theme Preview
          </div>
          <div className="mt-1 text-sm font-medium">
            {template} / {resolvedTheme}
          </div>
        </div>
        <div className="rounded-full bg-accent/10 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.2em] text-accent">
          {theme}
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        {themes.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setTheme(option)}
            className={`flex-1 rounded-md border px-2 py-1.5 text-[11px] font-mono uppercase tracking-[0.14em] transition-colors ${
              theme === option
                ? 'border-accent/40 bg-accent/10 text-accent'
                : 'border-border/80 bg-background/50 text-muted-foreground hover:border-ring/50 hover:text-foreground'
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      <label className="mt-3 block text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
        Template
      </label>
      <select
        value={template}
        onChange={(event) => setTemplate(event.target.value as typeof template)}
        className="mt-1 w-full rounded-md border border-input bg-background/70 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-ring"
      >
        <option value="hudson">Hudson</option>
        <option value="editorial">Editorial</option>
      </select>

      <Link
        href="/theme-preview"
        className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-[11px] font-mono uppercase tracking-[0.16em] text-accent transition-colors hover:bg-accent/15"
      >
        Open Full Chrome Preview
      </Link>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import { isMuted, setMuted, sounds, useTheme } from 'hudsonkit';
import { Palette, Volume2, VolumeX } from 'lucide-react';

const themePresets = [
  { id: 'hudson-dark', label: 'Hudson Dark', template: 'hudson', theme: 'dark' },
  { id: 'hudson-light', label: 'Hudson Light', template: 'hudson', theme: 'light' },
  { id: 'editorial-dark', label: 'Editorial Dark', template: 'editorial', theme: 'dark' },
  { id: 'editorial-light', label: 'Editorial Light', template: 'editorial', theme: 'light' },
] as const;

const subscribeMounted = () => () => {};
const getMountedSnapshot = () => true;
const getServerSnapshot = () => false;

export function ThemePreviewControls() {
  const { theme, resolvedTheme, template, setTheme, setTemplate } = useTheme();
  // The theme/template/resolvedTheme values come from localStorage + matchMedia
  // on the client — they don't exist on the server, so any SSR render would
  // mismatch. Gate this widget on a post-mount flag to avoid the hydration warning.
  const mounted = useSyncExternalStore(subscribeMounted, getMountedSnapshot, getServerSnapshot);
  const [open, setOpen] = useState(false);
  const [soundPreference, setSoundPreference] = useState<boolean | null>(null);
  const soundOn = soundPreference ?? (mounted ? !isMuted() : false);

  if (!mounted) return null;

  const activePreset = `${template}-${theme === 'system' ? resolvedTheme ?? 'dark' : theme}`;

  const toggleSounds = () => {
    const next = !soundOn;
    setSoundPreference(next);
    setMuted(!next);
    if (next) sounds.click();
  };

  if (!open) {
    return (
      <button
        type="button"
        aria-label="Open tweaks"
        onClick={() => {
          setOpen(true);
          if (soundOn) sounds.click();
        }}
        className="fixed right-4 bottom-4 z-30 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/80 bg-card/90 text-muted-foreground shadow-[0_12px_32px_rgba(0,0,0,0.14)] backdrop-blur-xl transition hover:border-cyan-500/40 hover:text-cyan-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Palette className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="fixed right-4 bottom-4 z-30 w-[280px] rounded-lg border border-border/80 bg-card/90 p-3 text-foreground shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-mono uppercase text-muted-foreground">
            Tweak
          </div>
          <div className="mt-1 text-sm font-medium">
            {template} / {resolvedTheme}
          </div>
        </div>
        <button
          type="button"
          aria-label={soundOn ? 'Disable hover sounds' : 'Enable hover sounds'}
          onClick={toggleSounds}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background/50 text-muted-foreground transition hover:border-cyan-500/40 hover:text-foreground"
        >
          {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
        </button>
      </div>

      <label className="mt-4 block text-[11px] font-mono uppercase text-muted-foreground">
        Theme
      </label>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {themePresets.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              setTemplate(option.template);
              setTheme(option.theme);
              if (soundOn) sounds.click();
            }}
            className={`flex-1 rounded-md border px-2 py-1.5 text-[11px] font-mono uppercase transition-colors ${
              activePreset === option.id
                ? 'border-accent/40 bg-accent/10 text-accent'
                : 'border-border/80 bg-background/50 text-muted-foreground hover:border-ring/50 hover:text-foreground'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <Link
        href="/theme-preview"
        className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-[11px] font-mono uppercase text-accent transition-colors hover:bg-accent/15"
      >
        Open Full Chrome Preview
      </Link>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          if (soundOn) sounds.click();
        }}
        className="mt-2 inline-flex w-full items-center justify-center rounded-md border border-border/70 bg-background/40 px-3 py-2 text-[11px] font-mono uppercase text-muted-foreground transition-colors hover:text-foreground"
      >
        Close
      </button>
    </div>
  );
}

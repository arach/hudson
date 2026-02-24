import { Layers, Puzzle, Terminal, Cable } from 'lucide-react';
import type { ReactNode } from 'react';

const features: { icon: ReactNode; title: string; description: string }[] = [
  {
    icon: <Layers className="w-4 h-4" />,
    title: 'Spatial Canvas',
    description:
      'Infinite canvas with pan, zoom, snap-to guides, and minimap. Apps float as draggable windows or render natively.',
  },
  {
    icon: <Puzzle className="w-4 h-4" />,
    title: 'Provider + Slots + Hooks',
    description:
      'One interface is all you need. Declare a Provider, slot components, and hooks — the shell does everything else.',
  },
  {
    icon: <Terminal className="w-4 h-4" />,
    title: 'Command Palette & Terminal',
    description:
      'Cmd+K merges every app\'s commands into one palette. Built-in terminal drawer with multi-app tabs.',
  },
  {
    icon: <Cable className="w-4 h-4" />,
    title: 'Extensible Workspaces',
    description:
      'Compose apps into workspaces. Canvas mode, panel mode, windowed — all configurable per workspace.',
  },
];

export function Features() {
  return (
    <section className="py-32 px-8 lg:px-16">
      <div className="max-w-[1080px] mx-auto">
        <h2 className="text-2xl font-mono font-bold tracking-wide text-neutral-100 mb-16">
          Built for builders
        </h2>

        <div className="divide-y divide-neutral-800/50">
          {features.map((f) => (
            <div
              key={f.title}
              className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 md:gap-12 py-7 first:pt-0 last:pb-0"
            >
              <div className="flex items-center gap-3">
                <span className="text-emerald-400">{f.icon}</span>
                <span className="text-sm font-mono font-semibold text-neutral-200 tracking-wide">
                  {f.title}
                </span>
              </div>
              <p className="text-sm text-neutral-500 leading-relaxed">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

'use client';

import Link from 'next/link';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  Activity,
  ChevronRight,
  Crosshair,
  Inspect,
  Layers,
  MousePointer2,
  PanelLeft,
  Plus,
  Radio,
  Route,
  Sparkles,
  Terminal,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { isMuted, setMuted, sounds } from 'hudsonkit';

const apps = ['notepad', 'shaper', 'json-explorer', 'hudson-ai'];
const manifestLines = [
  { key: 'id', value: "'notepad'", trigger: 'base' },
  { key: 'name', value: "'Notepad'", trigger: 'base' },
  { key: 'mode', value: "'panel'", trigger: 'base' },
  { key: 'Provider', value: 'NotepadProvider', trigger: 'base' },
  { key: 'slots', value: '{ Content: NotepadContent }', trigger: 'base' },
  { key: 'hooks', value: '{ useCommands, useStatus }', trigger: 'base' },
  { key: 'intents', value: 'notepadIntents', trigger: 'intent' },
  { key: 'ports', value: 'notepadPorts', trigger: 'ports' },
] as const;

const subscribeMounted = () => () => {};
const getMountedSnapshot = () => true;
const getServerSnapshot = () => false;

type HotspotProps = {
  label: string;
  inspectMode: boolean;
  children: React.ReactNode;
  className?: string;
};

export function ParallaxBackground() {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let frame = 0;
    const handleMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const px = event.clientX / window.innerWidth - 0.5;
        const py = event.clientY / window.innerHeight - 0.5;
        setOffset({ x: px * -6, y: py * -6 });
      });
    };

    window.addEventListener('pointermove', handleMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', handleMove);
    };
  }, []);

  return (
    <>
      <div
        className="fixed inset-0 pointer-events-none text-foreground opacity-[0.04] dark:opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
          backgroundPosition: `${offset.x}px ${offset.y}px`,
          backgroundSize: '64px 64px',
          maskImage:
            'radial-gradient(ellipse 80% 60% at 50% 0%, #000 30%, transparent 80%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 80% 60% at 50% 0%, #000 30%, transparent 80%)',
          transition: 'background-position 160ms ease-out',
        }}
      />
      <div
        className="fixed inset-x-0 top-0 h-[420px] pointer-events-none opacity-[0.18] dark:opacity-[0.22]"
        style={{
          background:
            'linear-gradient(to bottom, oklch(var(--accent) / 0.22), transparent 68%)',
        }}
      />
    </>
  );
}

export function HudsonDelightWorkbench() {
  const [inspectMode, setInspectMode] = useState(false);
  const [soundPreference, setSoundPreference] = useState<boolean | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [cursor, setCursor] = useState({ x: 432, y: 218 });
  const [activeLine, setActiveLine] = useState(0);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const mounted = useSyncExternalStore(subscribeMounted, getMountedSnapshot, getServerSnapshot);
  const soundOn = soundPreference ?? (mounted ? !isMuted() : false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveLine((line) => (line + 1) % manifestLines.length);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const showIntent = activeLine >= 6;
  const showPorts = activeLine >= 7;

  const playClick = useCallback(() => {
    if (soundOn) sounds.click();
  }, [soundOn]);

  const toggleSounds = useCallback(() => {
    const next = !soundOn;
    setSoundPreference(next);
    setMuted(!next);
    if (next) sounds.click();
  }, [soundOn]);

  const handleCanvasMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.round((event.clientX - rect.left - rect.width / 2) * 1.8);
    const y = Math.round((event.clientY - rect.top - rect.height / 2) * 1.8);
    setCursor({ x, y });
    setParallax({
      x: ((event.clientX - rect.left) / rect.width - 0.5) * -6,
      y: ((event.clientY - rect.top) / rect.height - 0.5) * -6,
    });
  }, []);

  const visibleLines = useMemo(() => manifestLines.slice(0, activeLine + 1), [activeLine]);

  return (
    <section className="relative border-t border-border/50 px-6 py-20 md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[11px] uppercase text-cyan-500">Smaller Delights</div>
            <h2 className="mt-1 text-2xl font-medium text-foreground/90 md:text-3xl">
              The canvas should feel alive while it stays quiet.
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onMouseEnter={playClick}
              onClick={() => {
                setInspectMode((value) => !value);
                playClick();
              }}
              className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-[12px] transition ${
                inspectMode
                  ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300'
                  : 'border-border bg-card/80 text-muted-foreground hover:border-cyan-500/35 hover:text-foreground'
              }`}
            >
              <Inspect className="h-3.5 w-3.5" />
              Inspect Mode
            </button>
            <button
              type="button"
              aria-label={soundOn ? 'Disable hover sounds' : 'Enable hover sounds'}
              onMouseEnter={playClick}
              onClick={toggleSounds}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card/80 text-muted-foreground transition hover:border-cyan-500/35 hover:text-foreground"
            >
              {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card/80 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.24)] dark:bg-card/50 dark:shadow-[0_24px_70px_-32px_rgba(34,211,238,0.16)]">
          <Hotspot inspectMode={inspectMode} label="NavigationBar · 48px · <NavigationBar /> · app hooks drive center/actions">
            <div className="flex h-12 items-center justify-between border-b border-border/70 bg-background/70 px-3 backdrop-blur">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md border border-cyan-500/30 bg-cyan-500/10 text-cyan-500">
                  <Layers className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="text-[12px] font-medium text-foreground/90">HudsonKit</div>
                  <div className="text-[10px] text-muted-foreground">workspace primitives</div>
                </div>
              </div>
              <div className="hidden items-center gap-2 rounded-md border border-border bg-muted/25 px-2.5 py-1.5 text-[11px] text-muted-foreground md:flex">
                <MousePointer2 className="h-3 w-3" />
                hover a primitive
              </div>
              <button
                type="button"
                onMouseEnter={playClick}
                className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-[11px] text-muted-foreground transition hover:border-cyan-500/35 hover:text-foreground"
              >
                <Terminal className="h-3.5 w-3.5" />
                terminal
              </button>
            </div>
          </Hotspot>

          <div className="grid min-h-[620px] lg:grid-cols-[230px_1fr_260px]">
            <Hotspot inspectMode={inspectMode} label="SidePanel · 230px · <SidePanel side='left' /> · manifest list">
              <aside className="border-b border-border/70 bg-background/60 p-3 lg:border-b-0 lg:border-r">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[12px] font-medium">
                    <PanelLeft className="h-3.5 w-3.5 text-cyan-500" />
                    manifest apps
                  </div>
                  <span className="text-[10px] text-muted-foreground">4 today</span>
                </div>
                <div className="space-y-1">
                  {apps.map((app) => (
                    <button
                      key={app}
                      type="button"
                      onMouseEnter={playClick}
                      className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-[12px] text-foreground/80 transition hover:bg-muted/40"
                    >
                      <span>{app}</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
                    </button>
                  ))}
                  <button
                    type="button"
                    onMouseEnter={playClick}
                    onClick={() => {
                      setOnboardingOpen(true);
                      sounds.blipUp();
                    }}
                    className="mt-2 flex w-full items-center gap-2 rounded-md border border-dashed border-border px-2 py-2 text-left text-[12px] text-muted-foreground transition hover:border-cyan-500/40 hover:bg-cyan-500/5 hover:text-cyan-600 dark:hover:text-cyan-300"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>your-app · not yet built</span>
                  </button>
                </div>

                {onboardingOpen && (
                  <div className="mt-4 rounded-md border border-cyan-500/25 bg-cyan-500/10 p-3">
                    <div className="flex items-center gap-2 text-[12px] font-medium text-cyan-600 dark:text-cyan-300">
                      <Sparkles className="h-3.5 w-3.5" />
                      onboarding loop
                    </div>
                    <ol className="mt-3 space-y-2 text-[11px] text-muted-foreground">
                      <li>1. name the app</li>
                      <li>2. scaffold provider + slots</li>
                      <li>3. declare commands and intents</li>
                      <li>4. drop it into a workspace</li>
                    </ol>
                    <Link
                      href="#interest"
                      onMouseEnter={playClick}
                      className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-cyan-600 hover:text-cyan-500 dark:text-cyan-300"
                    >
                      start with HudsonKit
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </aside>
            </Hotspot>

            <Hotspot inspectMode={inspectMode} label="Canvas · pan/zoom surface · cursor breadcrumb reads live world coordinates">
              <div
                className="relative min-h-[430px] overflow-hidden bg-background"
                onPointerMove={handleCanvasMove}
              >
                <div
                  className="absolute inset-0 opacity-70"
                  style={{
                    backgroundImage:
                      'radial-gradient(circle, var(--hud-canvas-dot-minor, rgba(255,255,255,0.06)) 1px, transparent 1.4px), radial-gradient(circle, var(--hud-canvas-dot-major, rgba(255,255,255,0.1)) 1px, transparent 1.6px)',
                    backgroundPosition: `${parallax.x}px ${parallax.y}px, ${parallax.x}px ${parallax.y}px`,
                    backgroundSize: '20px 20px, 100px 100px',
                    transition: 'background-position 140ms ease-out',
                  }}
                />

                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 700 430" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <path id="landing-flow-a" d="M130 112 C210 72 280 72 358 112" />
                    <path id="landing-flow-b" d="M358 112 C450 152 494 214 570 258" />
                    <path id="landing-flow-c" d="M130 318 C245 370 430 365 570 258" />
                  </defs>
                  <path d="M130 112 C210 72 280 72 358 112" className="fill-none stroke-cyan-500/30" strokeWidth="1" />
                  <path d="M358 112 C450 152 494 214 570 258" className="fill-none stroke-cyan-500/30" strokeWidth="1" />
                  <path d="M130 318 C245 370 430 365 570 258" className={`fill-none transition-opacity ${showPorts ? 'stroke-emerald-500/70 opacity-100' : 'stroke-emerald-500/20 opacity-25'}`} strokeWidth="1" />
                  {['landing-flow-a', 'landing-flow-b', 'landing-flow-c'].map((pathId, index) => (
                    <circle key={pathId} r="3" className="fill-cyan-400">
                      <animateMotion dur="3s" begin={`${index * 0.45}s`} repeatCount="indefinite">
                        <mpath href={`#${pathId}`} />
                      </animateMotion>
                    </circle>
                  ))}
                </svg>

                <div className="relative grid h-full min-h-[430px] grid-cols-1 gap-4 p-4 md:grid-cols-2">
                  <StepCard
                    number="01"
                    title="manifest"
                    icon={CodeIcon}
                    active
                    inspectMode={inspectMode}
                    tooltip="HudsonApp · typed contract · Provider + Slots + Hooks"
                  >
                    <pre className="min-h-[225px] overflow-hidden rounded-md border border-white/10 bg-[#06080a] p-3 font-mono text-[11px] leading-6 text-white/80">
                      <span className="text-cyan-300">export const</span> notepadApp = {'{\n'}
                      {visibleLines.map((line) => (
                        <span
                          key={line.key}
                          className={line.trigger === 'ports' && showPorts ? 'text-emerald-300' : line.trigger === 'intent' && showIntent ? 'text-cyan-200' : ''}
                        >
                          {'  '}
                          {line.key}: <span className="text-emerald-300">{line.value}</span>,
                          {'\n'}
                        </span>
                      ))}
                      <span className="text-white/35">{activeLine < manifestLines.length - 1 ? '  |' : '};'}</span>
                    </pre>
                  </StepCard>

                  <StepCard
                    number="02"
                    title="intents"
                    icon={Activity}
                    active={showIntent}
                    inspectMode={inspectMode}
                    tooltip="Intent row · commandId bridge · searchable action"
                  >
                    <div className="space-y-2">
                      {['create note', 'pin panel', 'export markdown'].map((intent, index) => (
                        <div
                          key={intent}
                          className={`flex items-center justify-between rounded-md border px-3 py-2 text-[12px] transition ${
                            showIntent && index === 0
                              ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300'
                              : 'border-border bg-background/50 text-muted-foreground'
                          }`}
                        >
                          <span>{intent}</span>
                          <Radio className="h-3.5 w-3.5" />
                        </div>
                      ))}
                    </div>
                  </StepCard>

                  <StepCard
                    number="03"
                    title="ports"
                    icon={Route}
                    active={showPorts}
                    inspectMode={inspectMode}
                    tooltip="Port section · typed input/output · connection-ready"
                  >
                    <div className="space-y-2 text-[12px]">
                      <div className={`rounded-md border px-3 py-2 transition ${showPorts ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : 'border-border bg-background/50 text-muted-foreground'}`}>
                        input.note: markdown
                      </div>
                      <div className={`rounded-md border px-3 py-2 transition ${showPorts ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : 'border-border bg-background/50 text-muted-foreground'}`}>
                        output.summary: json
                      </div>
                    </div>
                  </StepCard>

                  <StepCard
                    number="04"
                    title="workspace"
                    icon={Crosshair}
                    active={showPorts}
                    inspectMode={inspectMode}
                    tooltip="AppWindow · draggable shell host · shell owns chrome"
                  >
                    <div className="rounded-md border border-border bg-card/80 p-3">
                      <div className="mb-3 flex items-center justify-between border-b border-border/70 pb-2">
                        <span className="text-[12px] font-medium">Notepad</span>
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      </div>
                      <div className="space-y-2">
                        <div className="h-2 rounded bg-muted" />
                        <div className="h-2 w-3/4 rounded bg-muted" />
                        <div className="h-2 w-1/2 rounded bg-cyan-500/35" />
                      </div>
                    </div>
                  </StepCard>
                </div>

                <Hotspot inspectMode={inspectMode} label="StatusBar · 28px · <StatusBar /> · 4 apps x consistent">
                  <div className="absolute inset-x-0 bottom-0 flex h-8 items-center justify-between border-t border-border bg-card/90 px-3 text-[11px] text-muted-foreground backdrop-blur">
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      READY
                    </span>
                    <span>x: {cursor.x}, y: {cursor.y} · zoom: 100%</span>
                  </div>
                </Hotspot>
              </div>
            </Hotspot>

            <Hotspot inspectMode={inspectMode} label="Inspector · <PortInspector /> · shell reads app ports">
              <aside className="border-t border-border/70 bg-background/60 p-3 lg:border-l lg:border-t-0">
                <div className="mb-3 text-[12px] font-medium">inspector</div>
                <div className="space-y-3">
                  <InspectorSection title="selected primitive" value={inspectMode ? 'StatusBar' : 'Canvas'} tone="cyan" />
                  <InspectorSection title="layout" value="canvas · windowed" tone="emerald" />
                  <InspectorSection title="port status" value={showPorts ? 'connected' : 'waiting'} tone={showPorts ? 'emerald' : 'cyan'} />
                  <div className={`rounded-md border p-3 transition ${showPorts ? 'border-emerald-500/35 bg-emerald-500/10' : 'border-border bg-card/50'}`}>
                    <div className="mb-2 text-[11px] text-muted-foreground">ports</div>
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex justify-between">
                        <span>input.note</span>
                        <span className="text-cyan-600 dark:text-cyan-300">markdown</span>
                      </div>
                      <div className="flex justify-between">
                        <span>output.summary</span>
                        <span className="text-emerald-600 dark:text-emerald-300">json</span>
                      </div>
                    </div>
                  </div>
                </div>
              </aside>
            </Hotspot>
          </div>
        </div>
      </div>
    </section>
  );
}

function Hotspot({ label, inspectMode, children, className }: HotspotProps) {
  return (
    <div
      className={`landing-hotspot relative ${inspectMode ? 'landing-hotspot-on' : ''} ${className ?? ''}`}
      data-hotspot-label={label}
    >
      {children}
    </div>
  );
}

function StepCard({
  number,
  title,
  icon: Icon,
  active,
  inspectMode,
  tooltip,
  children,
}: {
  number: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  inspectMode: boolean;
  tooltip: string;
  children: React.ReactNode;
}) {
  return (
    <Hotspot inspectMode={inspectMode} label={tooltip}>
      <div
        className={`relative rounded-lg border p-3 transition duration-500 ${
          active
            ? 'border-cyan-500/35 bg-card/80 opacity-100 shadow-[0_12px_32px_-24px_rgba(34,211,238,0.5)]'
            : 'border-border bg-card/50 opacity-55'
        }`}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-cyan-500">STEP {number}</span>
            <span className="text-[12px] font-medium text-foreground/90">{title}</span>
          </div>
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        {children}
      </div>
    </Hotspot>
  );
}

function InspectorSection({ title, value, tone }: { title: string; value: string; tone: 'cyan' | 'emerald' }) {
  return (
    <div className="rounded-md border border-border bg-card/50 p-3">
      <div className="text-[11px] text-muted-foreground">{title}</div>
      <div className={`mt-1 text-[12px] ${tone === 'cyan' ? 'text-cyan-600 dark:text-cyan-300' : 'text-emerald-600 dark:text-emerald-300'}`}>
        {value}
      </div>
    </div>
  );
}

function CodeIcon({ className }: { className?: string }) {
  return <span className={className}>{'{ }'}</span>;
}

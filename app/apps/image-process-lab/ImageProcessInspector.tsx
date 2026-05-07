'use client';

import { Dices, Download, FileJson, Loader2, Play, RefreshCw, RotateCcw, SlidersHorizontal, ToggleLeft, ToggleRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useImageProcess } from './ImageProcessProvider';
import { imageProcessPrograms } from './programs';
import type { ImageProcessAnimationMode, ImageProcessFilterMode, SignalMosaicParams } from './types';

function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="font-mono text-[10px] text-emerald-800 dark:text-emerald-300">
          {value}{unit ?? ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
        className="w-full accent-emerald-400"
      />
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-border/70 px-3 py-3">
      <div className="mb-3 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <SlidersHorizontal size={11} className="text-emerald-700 dark:text-emerald-400" />
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ExportButton({
  children,
  icon,
  disabled,
  active,
  accent = false,
  onClick,
}: {
  children: ReactNode;
  icon: ReactNode;
  disabled?: boolean;
  active?: boolean;
  accent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-2 rounded-md border px-2.5 py-1.5 text-[10px] transition-colors disabled:pointer-events-none disabled:opacity-35 ${
        accent
          ? 'border-emerald-700/20 bg-emerald-700/[0.055] text-emerald-900 hover:bg-emerald-700/[0.09] dark:text-emerald-200'
          : 'border-border/70 bg-card/86 text-muted-foreground hover:bg-accent/8'
      }`}
    >
      {active ? <Loader2 size={11} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function ImageProcessInspector() {
  const {
    params,
    setParam,
    resetParams,
    animation,
    setAnimationParam,
    programId,
    setProgramId,
    status,
    exportStatus,
    manifest,
    processedDataUrl,
    processNow,
    downloadPng,
    downloadGif,
    downloadLottie,
    downloadSpriteSheet,
    downloadEmbed,
  } = useImageProcess();

  const update = <K extends keyof SignalMosaicParams>(key: K) => (value: SignalMosaicParams[K]) => {
    setParam(key, value);
  };
  const filterModes: Array<{ id: ImageProcessFilterMode; label: string; detail: string }> = [
    { id: 'none', label: 'None', detail: 'Recipe output only' },
    { id: 'signal-wash', label: 'Signal Wash', detail: 'Emerald lab tint' },
    { id: 'ct-scan', label: 'CT Scan', detail: 'Soft scanning bands' },
    { id: 'print-lab', label: 'Print Lab', detail: 'Living grain response' },
  ];
  const motionModes: Array<{ id: ImageProcessAnimationMode; label: string; detail: string }> = [
    { id: 'still', label: 'Still', detail: 'Static filter' },
    { id: 'sine', label: 'Sine', detail: 'Smooth cycle' },
    { id: 'drift', label: 'Drift', detail: 'Slow seeded variation' },
    { id: 'scan', label: 'Scan', detail: 'Directional phase' },
  ];
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportDisabled = !processedDataUrl || exportStatus !== null;

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Section title="Program">
          <div className="space-y-1.5">
            {imageProcessPrograms.map(program => {
              const selected = program.id === programId;
              return (
                <button
                  key={program.id}
                  onClick={() => setProgramId(program.id)}
                  className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    selected
                      ? 'border-emerald-700/25 bg-emerald-700/[0.065]'
                      : 'border-border/70 bg-card/86 hover:border-foreground/18 hover:bg-accent/8'
                  }`}
                >
                  <div className={`text-[12px] font-medium ${selected ? 'text-emerald-900 dark:text-emerald-200' : 'text-foreground/82'}`}>
                    {program.name}
                  </div>
                  <div className="mt-1 text-[10px] leading-4 text-muted-foreground">
                    {program.description}
                  </div>
                </button>
              );
            })}
          </div>
          <button
            onClick={resetParams}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border/70 bg-card/86 px-3 py-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent/8"
          >
            <RotateCcw size={12} />
            Reset recipe
          </button>
        </Section>

        <Section title="Look">
          <SliderRow label="Strength" value={params.strength} min={0} max={100} unit="%" onChange={update('strength')} />
          <SliderRow label="Mosaic size" value={params.mosaicSize} min={1} max={18} onChange={update('mosaicSize')} />
          <SliderRow label="Palette mix" value={params.paletteMix} min={0} max={100} unit="%" onChange={update('paletteMix')} />
          <SliderRow label="Edge response" value={params.edgeBoost} min={0} max={100} unit="%" onChange={update('edgeBoost')} />
        </Section>

        <Section title="Signal">
          <SliderRow label="Trace density" value={params.traceDensity} min={0} max={100} unit="%" onChange={update('traceDensity')} />
          <SliderRow label="Trace glow" value={params.traceGlow} min={0} max={100} unit="%" onChange={update('traceGlow')} />
          <button
            onClick={() => setParam('routeOverlay', !params.routeOverlay)}
            className="flex w-full items-center justify-between rounded-lg border border-border/70 bg-card/86 px-3 py-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent/8"
          >
            <span>Route overlay</span>
            {params.routeOverlay ? (
              <ToggleRight size={16} className="text-emerald-700 dark:text-emerald-300" />
            ) : (
              <ToggleLeft size={16} className="text-muted-foreground/70" />
            )}
          </button>
        </Section>

        <Section title="Filter">
          <div className="grid grid-cols-2 gap-1.5">
            {filterModes.map(filter => {
              const selected = animation.filter === filter.id;
              return (
                <button
                  key={filter.id}
                  onClick={() => setAnimationParam('filter', filter.id)}
                  className={`rounded-lg border px-2.5 py-2 text-left transition-colors ${
                    selected
                      ? 'border-emerald-700/25 bg-emerald-700/[0.065] text-emerald-900 dark:text-emerald-200'
                      : 'border-border/70 bg-card/86 text-foreground/78 hover:border-foreground/18 hover:bg-accent/8'
                  }`}
                >
                  <div className="text-[11px] font-medium">{filter.label}</div>
                  <div className="mt-1 text-[9px] leading-3 text-muted-foreground">{filter.detail}</div>
                </button>
              );
            })}
          </div>
          <div className="pt-1 text-[9px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
            Motion
          </div>
          <div className="grid grid-cols-4 gap-1">
            {motionModes.map(mode => {
              const selected = animation.mode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => setAnimationParam('mode', mode.id)}
                  title={mode.detail}
                  className={`rounded-lg border px-1.5 py-2 text-center transition-colors ${
                    selected
                      ? 'border-emerald-700/25 bg-emerald-700/[0.065] text-emerald-900 dark:text-emerald-200'
                      : 'border-border/70 bg-card/86 text-foreground/78 hover:border-foreground/18 hover:bg-accent/8'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 text-[10px] font-medium">
                    {mode.id !== 'still' ? <Play size={10} /> : null}
                    {mode.label}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <SliderRow
              label="Intensity"
              value={animation.intensity}
              min={0}
              max={100}
              unit="%"
              onChange={value => setAnimationParam('intensity', value)}
            />
            <SliderRow
              label="Speed"
              value={animation.speed}
              min={0}
              max={100}
              unit="%"
              onChange={value => setAnimationParam('speed', value)}
            />
          </div>
        </Section>

        <Section title="Output">
          <SliderRow
            label="Max dimension"
            value={params.maxDimension}
            min={640}
            max={2400}
            step={80}
            onChange={update('maxDimension')}
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={params.seed}
              min={0}
              max={9999}
              onChange={event => setParam('seed', Number(event.target.value))}
              className="min-w-0 flex-1 rounded-lg border border-border/70 bg-card/86 px-2 py-1.5 font-mono text-[11px] text-foreground/70 outline-none focus:border-emerald-700/40 dark:focus:border-emerald-400/40"
            />
            <button
              onClick={() => setParam('seed', Math.floor(Math.random() * 9999))}
              className="rounded-lg border border-border/70 bg-card/86 p-1.5 text-muted-foreground transition-colors hover:bg-accent/8 hover:text-emerald-800 dark:hover:text-emerald-300"
              title="Randomize seed"
            >
              <Dices size={14} />
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="min-w-0 flex-1 rounded-lg bg-card/86 px-3 py-2 text-[10px] leading-4 text-muted-foreground">
              {exportStatus
                ? `Exporting ${exportStatus}`
                : status === 'done' && manifest
                  ? `${manifest.output.width} x ${manifest.output.height} PNG ready`
                  : status === 'processing'
                    ? 'Processing current recipe'
                    : 'Load an image to generate output'}
            </div>
            <button
              onClick={() => { void processNow(); }}
              disabled={status === 'processing'}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-card/86 text-muted-foreground transition-colors hover:bg-accent/8 hover:text-emerald-800 disabled:pointer-events-none disabled:opacity-45 dark:hover:text-emerald-300"
              title="Reprocess"
            >
              {status === 'processing' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            </button>
          </div>
        </Section>
      </div>

      <div className="shrink-0 border-t border-border/70 bg-card/95 px-3 py-3">
        <div className="grid gap-1.5">
          <button
            onClick={downloadPng}
            disabled={!processedDataUrl}
            className="flex items-center justify-center gap-2 rounded-lg bg-emerald-700/12 px-3 py-2 text-[11px] font-medium text-emerald-900 transition-colors hover:bg-emerald-700/18 disabled:pointer-events-none disabled:opacity-35 dark:text-emerald-200"
          >
            <Download size={12} />
            Export PNG
          </button>
          <button
            onClick={() => setExportMenuOpen(open => !open)}
            disabled={!processedDataUrl}
            className="flex items-center justify-center gap-2 rounded-lg border border-border/70 bg-card/86 px-3 py-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent/8 disabled:pointer-events-none disabled:opacity-35"
          >
            <Download size={12} />
            Export...
          </button>
          {exportMenuOpen ? (
            <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-border/70 bg-background/35 p-1.5">
              <ExportButton
                onClick={() => { void downloadGif(); }}
                disabled={exportDisabled}
                active={exportStatus === 'gif'}
                icon={<Play size={11} />}
              >
                GIF
              </ExportButton>
              <ExportButton
                onClick={() => { void downloadLottie(); }}
                disabled={exportDisabled}
                active={exportStatus === 'lottie'}
                icon={<FileJson size={11} />}
              >
                Lottie
              </ExportButton>
              <ExportButton
                onClick={() => { void downloadSpriteSheet(); }}
                disabled={exportDisabled}
                active={exportStatus === 'sprite'}
                icon={<Download size={11} />}
              >
                Sprite
              </ExportButton>
              <ExportButton
                onClick={() => { void downloadEmbed(); }}
                disabled={exportDisabled}
                active={exportStatus === 'embed'}
                accent
                icon={<FileJson size={11} />}
              >
                Embed
              </ExportButton>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

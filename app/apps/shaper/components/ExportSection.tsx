'use client';

import { useEffect, useState } from 'react';
import {
  Download, FileCode, FileImage, FileJson, Copy, Clipboard, Library, Check, AlertCircle,
} from 'lucide-react';
import { useShaper } from '../ShaperProvider';
import {
  buildSvgString, computeBezierBbox, rasterizeSvgToPng,
  downloadBlob, copyText, copyPng, blobToDataUrl, sanitizeFilename,
} from '../lib/exporters';

// ---------------------------------------------------------------------------
// Inspector section for exporting the current design.
// Styled to match the rest of ShaperInspector (collapsible header + body).
// ---------------------------------------------------------------------------
export function ExportSection() {
  const {
    openSections, toggleSection,
    strokesPath, bezierData, pathColor, fillEnabled, fillPattern,
    projectImage, projectMeta,
  } = useShaper();

  const [flash, setFlash] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 2000);
    return () => clearTimeout(id);
  }, [flash]);

  const disabled = !bezierData || !strokesPath;
  const baseName = sanitizeFilename(projectMeta?.name ?? projectImage?.name ?? 'shaper');

  const buildSvg = () => buildSvgString({
    pathD: strokesPath,
    pathColor,
    fillEnabled,
    fillPattern,
    viewBox: computeBezierBbox(bezierData),
    viewBoxPadding: 16,
  });

  const run = async (label: string, fn: () => Promise<void> | void) => {
    try {
      await fn();
      setFlash({ kind: 'ok', msg: label });
    } catch (err) {
      console.error('[export]', err);
      setFlash({ kind: 'err', msg: err instanceof Error ? err.message : String(err) });
    }
  };

  const downloadSvg = () => run('Downloaded SVG', () => {
    const svg = buildSvg();
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${baseName}.svg`);
  });
  const downloadPng = () => run('Downloaded PNG', async () => {
    const png = await rasterizeSvgToPng(buildSvg(), 1024);
    downloadBlob(png, `${baseName}.png`);
  });
  const downloadJson = () => run('Downloaded JSON', () => {
    if (!bezierData) throw new Error('No bezier data');
    const json = JSON.stringify(bezierData, null, 2);
    downloadBlob(new Blob([json], { type: 'application/json' }), `${baseName}.json`);
  });
  const copySvg = () => run('Copied SVG', () => copyText(buildSvg()));
  const copyPathD = () => run('Copied path d', () => copyText(strokesPath));
  const copyPngToClipboard = () => run('Copied PNG', async () => {
    const png = await rasterizeSvgToPng(buildSvg(), 1024);
    await copyPng(png);
  });
  const sendToAssets = () => run('Sent to Assets', async () => {
    const png = await rasterizeSvgToPng(buildSvg(), 1024);
    const dataUrl = await blobToDataUrl(png);
    const res = await fetch('/api/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        name: `${baseName}.png`,
        dataUrl,
        contentType: 'image/png',
        size: png.size,
        source: 'drop',
        addedAt: Date.now(),
        width: 1024,
        height: 1024,
      }),
    });
    if (!res.ok) throw new Error(`Assets POST failed: ${res.status}`);
  });

  return (
    <div className="border-t border-neutral-800/50">
      <button
        onClick={() => toggleSection('export')}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 hover:text-neutral-300 bg-neutral-900/30 hover:bg-neutral-900/50 transition-colors"
      >
        <Download size={12} className="text-cyan-500 shrink-0" />
        <span className="flex-1 text-left">Export</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-neutral-600 transition-transform ${openSections.export ? 'rotate-0' : '-rotate-90'}`}><path d="m6 9 6 6 6-6"/></svg>
      </button>
      {openSections.export && (
        <div className="px-3 pt-3 pb-3 ml-2 space-y-3">
          {flash && (
            <div className={`rounded-md border p-2 flex gap-2 items-start ${
              flash.kind === 'ok'
                ? 'border-emerald-500/30 bg-emerald-500/10'
                : 'border-red-500/30 bg-red-500/10'
            }`}>
              {flash.kind === 'ok'
                ? <Check size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                : <AlertCircle size={12} className="text-red-400 shrink-0 mt-0.5" />}
              <div className={`text-[10px] break-words min-w-0 ${flash.kind === 'ok' ? 'text-emerald-200' : 'text-red-200'}`}>
                {flash.msg}
              </div>
            </div>
          )}

          {disabled && (
            <div className="text-[10px] text-neutral-600 italic">Nothing to export yet — trace or draw something first.</div>
          )}

          <div>
            <SubLabel>Download</SubLabel>
            <div className="grid grid-cols-3 gap-1.5">
              <ExportButton icon={FileCode}  iconColor="text-emerald-400" label="SVG"  onClick={downloadSvg}  disabled={disabled} />
              <ExportButton icon={FileImage} iconColor="text-violet-400"  label="PNG"  onClick={downloadPng}  disabled={disabled} />
              <ExportButton icon={FileJson}  iconColor="text-amber-400"   label="JSON" onClick={downloadJson} disabled={disabled} />
            </div>
          </div>

          <div>
            <SubLabel>Copy to clipboard</SubLabel>
            <div className="grid grid-cols-3 gap-1.5">
              <ExportButton icon={FileCode}  iconColor="text-emerald-400" label="SVG"    onClick={copySvg}            disabled={disabled} />
              <ExportButton icon={Copy}      iconColor="text-cyan-400"    label="Path d" onClick={copyPathD}          disabled={disabled} />
              <ExportButton icon={Clipboard} iconColor="text-violet-400"  label="PNG"    onClick={copyPngToClipboard} disabled={disabled} />
            </div>
          </div>

          <div>
            <SubLabel>Send to</SubLabel>
            <button
              onClick={sendToAssets}
              disabled={disabled}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-teal-500/5 border border-teal-500/20 hover:bg-teal-500/15 hover:border-teal-500/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Library size={12} className="text-teal-400 shrink-0" />
              <span className="text-[11px] text-neutral-200 flex-1 text-left">Assets library</span>
              <span className="text-[10px] text-neutral-600">PNG 1024</span>
            </button>
          </div>

          <div className="text-[10px] text-neutral-600 pt-1">
            Filename: <span className="font-mono text-neutral-400">{baseName}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9px] font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
      {children}
    </div>
  );
}

function ExportButton({
  icon: Icon, iconColor, label, onClick, disabled,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconColor: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md bg-neutral-900/50 border border-neutral-800/60 hover:bg-neutral-800/70 hover:border-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[10px] font-mono text-neutral-300"
    >
      <Icon size={11} className={`${iconColor} shrink-0`} />
      {label}
    </button>
  );
}

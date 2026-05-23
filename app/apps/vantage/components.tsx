'use client';

import type { ReactNode } from 'react';
import { VantageIcon } from './VantageIcon';

export function SectionLabel({ label, count }: { label: string; count?: number }) {
  return (
    <div className="px-2.5 pt-1 pb-1.5 text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground/80">
      {label}
      {count != null && <span className="ml-2 text-muted-foreground/45">{count}</span>}
    </div>
  );
}

export function StatusPill({ tone, label }: { tone: 'online' | 'checking' | 'offline'; label: string }) {
  const styles = {
    online: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    checking: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    offline: 'border-border/60 bg-muted/30 text-muted-foreground',
  } as const;

  return (
    <span className={`rounded px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider border ${styles[tone]}`}>
      {label}
    </span>
  );
}

export function EmptyPanel({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/70 bg-muted/10 px-4 py-10 text-center">
      <VantageIcon size={18} className="mx-auto mb-3 text-cyan-400/70" />
      <p className="text-sm text-foreground/75">{title}</p>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

export function InspectorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-border/40 last:border-b-0">
      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="max-w-[62%] break-all text-right font-mono text-[11px] text-foreground/80">{value}</span>
    </div>
  );
}

export function ActionButton({
  label,
  onClick,
  variant = 'primary',
}: {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}) {
  const styles = variant === 'primary'
    ? 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/15'
    : 'border-border/70 bg-muted/20 text-muted-foreground hover:bg-muted/35';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-3 py-1.5 text-[11px] font-medium transition-colors ${styles}`}
    >
      {label}
    </button>
  );
}

export function PanelShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-border/60 bg-muted/10 ${className}`}>
      {children}
    </div>
  );
}

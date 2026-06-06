'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Settings, X } from 'lucide-react';

export const HUDSON_SETTING_CHANGED_EVENT = 'hudson:setting-changed';

export interface SettingChangedNoticeDetail {
  id?: string;
  title: string;
  valueLabel?: string;
  description?: string;
  locationLabel?: string;
}

export function announceSettingChanged(detail: SettingChangedNoticeDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<SettingChangedNoticeDetail>(HUDSON_SETTING_CHANGED_EVENT, {
    detail: {
      id: detail.id ?? `${Date.now()}`,
      ...detail,
    },
  }));
}

export function useSettingChangedNotice() {
  const [notice, setNotice] = useState<SettingChangedNoticeDetail | null>(null);

  useEffect(() => {
    const handleNotice = (event: Event) => {
      const detail = (event as CustomEvent<SettingChangedNoticeDetail>).detail;
      if (!detail?.title) return;
      setNotice({
        id: detail.id ?? `${Date.now()}`,
        ...detail,
      });
    };

    window.addEventListener(HUDSON_SETTING_CHANGED_EVENT, handleNotice);
    return () => window.removeEventListener(HUDSON_SETTING_CHANGED_EVENT, handleNotice);
  }, []);

  return { notice, setNotice };
}

export function SettingChangedNotice({
  notice,
  onDismiss,
  onOpenSettings,
}: {
  notice: SettingChangedNoticeDetail | null;
  onDismiss: () => void;
  onOpenSettings: () => void;
}) {
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(onDismiss, 6_000);
    return () => window.clearTimeout(timer);
  }, [notice, onDismiss]);

  return (
    <AnimatePresence>
      {notice && (
        <motion.div
          key={notice.id ?? notice.title}
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="fixed bottom-10 left-1/2 z-[230] w-[min(520px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-card shadow-2xl"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3 px-4 py-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-emerald-500/25 bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-[12px] font-mono font-semibold uppercase tracking-[0.16em] text-foreground">
                  {notice.title}
                </div>
                {notice.valueLabel && (
                  <span className="rounded border border-cyan-500/25 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-mono text-cyan-600 dark:text-cyan-300">
                    {notice.valueLabel}
                  </span>
                )}
              </div>
              {notice.description && (
                <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                  {notice.description}
                </p>
              )}
              {notice.locationLabel && (
                <p className="mt-1 text-[11px] font-mono text-muted-foreground/85">
                  Change it later in {notice.locationLabel}.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Dismiss setting notice"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-border/70 px-4 py-2">
            <button
              type="button"
              onClick={onOpenSettings}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[11px] font-mono text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
            >
              <Settings size={12} />
              Open Settings
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

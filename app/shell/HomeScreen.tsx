'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { HudsonWorkspace } from '@hudson/sdk';

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------
interface HudsonSession {
  activeWorkspaceId: string;
  timestamp: number;
}

const SESSION_KEY = 'hudson.session';
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24h

export function loadSession(): HudsonSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session: HudsonSession = JSON.parse(raw);
    if (Date.now() - session.timestamp > SESSION_MAX_AGE) return null;
    return session;
  } catch {
    return null;
  }
}

export function saveSession(workspaceId: string) {
  try {
    const session: HudsonSession = {
      activeWorkspaceId: workspaceId,
      timestamp: Date.now(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {}
}

// ---------------------------------------------------------------------------
// AppLauncher — frosted overlay with multi-select cards
// ---------------------------------------------------------------------------
interface AppLauncherProps {
  workspace: HudsonWorkspace;
  activatedAppIds: Set<string>;
  onActivateApp: (appId: string) => void;
  onDismiss: () => void;
}

export function AppLauncher({ workspace, activatedAppIds, onActivateApp, onDismiss }: AppLauncherProps) {
  const [exiting, setExiting] = useState(false);
  const hasActivated = activatedAppIds.size > 0;

  const handleDismiss = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    // Let fade-out animation play before signaling parent
    setTimeout(onDismiss, 400);
  }, [exiting, onDismiss]);

  // Keyboard: Escape or Enter to dismiss
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleDismiss]);

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        background: 'rgba(0,0,0,0.30)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div className="flex flex-col items-center gap-12 max-w-[720px] w-full px-6">
        {/* Branding */}
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
        >
          <h1 className="text-[28px] font-mono font-bold tracking-[0.3em] text-white/90">
            HUDSON
          </h1>
          {/* Breathing bar — pure CSS, GPU-composited via transform */}
          <div
            className="h-px w-9 relative"
            style={{ animation: 'breathe 3s ease-in-out infinite', willChange: 'transform, opacity' }}
          >
            <div className="absolute inset-0 bg-emerald-400/50" />
            <div
              className="absolute inset-0"
              style={{ background: 'rgba(16,185,129,0.4)', filter: 'blur(4px)' }}
            />
          </div>
          <span className="text-[11px] font-mono tracking-[0.2em] text-neutral-500">
            arach.dev
          </span>
        </motion.div>

        {/* App cards */}
        <div
          className="grid gap-5 w-full"
          style={{ gridTemplateColumns: `repeat(${Math.min(workspace.apps.length, 3)}, 1fr)` }}
        >
          {workspace.apps.map((config, i) => {
            const { app } = config;
            const isActive = activatedAppIds.has(app.id);

            return (
              <motion.button
                key={app.id}
                onClick={() => onActivateApp(app.id)}
                className="group relative flex flex-col items-start gap-4 p-6 rounded-xl text-left cursor-pointer"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 0.85, y: 0 }}
                whileHover={{
                  opacity: 1,
                  scale: 1.02,
                }}
                transition={{
                  // Entrance uses delay; hover/tap override with immediate timing
                  default: { duration: 0.35, delay: 0.1 + i * 0.06, ease: [0.25, 1, 0.5, 1] },
                  opacity: { duration: 0.15 },
                  scale: { duration: 0.15 },
                }}
                style={{
                  background: isActive
                    ? 'linear-gradient(170deg, rgba(16,185,129,0.10) 0%, rgba(16,185,129,0.03) 100%)'
                    : 'linear-gradient(170deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
                  border: isActive
                    ? '1px solid rgba(16,185,129,0.4)'
                    : '1px solid rgba(255,255,255,0.10)',
                  boxShadow: isActive
                    ? '0 0 30px rgba(16,185,129,0.12), 0 0 60px rgba(16,185,129,0.06)'
                    : 'none',
                }}
                whileTap={{ scale: 0.97 }}
              >
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-emerald-400" style={{
                    boxShadow: '0 0 8px rgba(16,185,129,0.6)',
                  }} />
                )}

                {/* App name */}
                <h2 className={`text-[16px] font-mono font-semibold tracking-wide transition-colors ${
                  isActive ? 'text-emerald-300' : 'text-neutral-100 group-hover:text-white'
                }`}>
                  {app.name}
                </h2>

                {/* Description */}
                {app.description && (
                  <p className="text-[12px] font-mono text-neutral-400 leading-relaxed">
                    {app.description}
                  </p>
                )}

                {/* Open action */}
                <div className="flex items-center justify-between w-full mt-auto pt-3">
                  <span className="text-[10px] font-mono tracking-[0.12em] uppercase px-2.5 py-1 rounded-md bg-white/[0.04] text-neutral-500 border border-white/[0.06]">
                    {app.mode}
                  </span>
                  <span className={`text-[11px] font-mono transition-colors ${
                    isActive ? 'text-emerald-400' : 'text-neutral-500 group-hover:text-emerald-400'
                  }`}>
                    {isActive ? 'Active' : 'Open \u2192'}
                  </span>
                </div>

                {/* Hover glow */}
                <div
                  className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                  style={{
                    boxShadow: isActive
                      ? '0 0 40px rgba(16,185,129,0.12), inset 0 1px 0 rgba(16,185,129,0.15)'
                      : '0 0 40px rgba(16,185,129,0.08), inset 0 1px 0 rgba(255,255,255,0.06)',
                  }}
                />
              </motion.button>
            );
          })}
        </div>

        {/* Hint + Enter button */}
        <motion.div
          className="flex flex-col items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <AnimatePresence mode="wait">
            {hasActivated ? (
              <motion.button
                key="enter"
                onClick={handleDismiss}
                className="px-6 py-2 rounded-lg font-mono text-[12px] tracking-[0.15em] uppercase cursor-pointer transition-colors"
                style={{
                  background: 'linear-gradient(170deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.06) 100%)',
                  border: '1px solid rgba(16,185,129,0.3)',
                  color: 'rgb(167, 243, 208)',
                }}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                whileHover={{ scale: 1.03, borderColor: 'rgba(16,185,129,0.5)' }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.2 }}
              >
                Enter workspace
              </motion.button>
            ) : (
              <motion.p
                key="hint"
                className="text-[13px] font-mono tracking-[0.15em] text-neutral-500"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                initialize modules
              </motion.p>
            )}
          </AnimatePresence>
          <motion.p
            className="text-[10px] font-mono tracking-[0.15em] text-neutral-600"
            initial={{ opacity: 0 }}
            animate={{ opacity: hasActivated ? 1 : 0 }}
            transition={{ duration: 0.3 }}
          >
            press enter or esc to continue
          </motion.p>
        </motion.div>
      </div>
    </motion.div>
  );
}

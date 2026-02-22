'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { sounds } from 'frame-ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type BootPhase = 'brand' | 'loading' | 'chrome-in' | 'panels-in' | 'dismissible' | 'done';

interface BootSplashProps {
  onPhaseChange: (phase: BootPhase) => void;
  onBooted: () => void;
  mode: 'full' | 'condensed';
}

// ---------------------------------------------------------------------------
// Braille Spinner
// ---------------------------------------------------------------------------
const BRAILLE_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function BrailleSpinner() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(f => (f + 1) % BRAILLE_FRAMES.length);
    }, 80);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="text-emerald-400/70 text-lg font-mono select-none">
      {BRAILLE_FRAMES[frame]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Phase ordering helper
// ---------------------------------------------------------------------------
const PHASE_ORDER: BootPhase[] = ['brand', 'loading', 'chrome-in', 'panels-in', 'dismissible', 'done'];

function phaseIndex(phase: BootPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

export function phaseAtLeast(current: BootPhase, target: BootPhase): boolean {
  return phaseIndex(current) >= phaseIndex(target);
}

// ---------------------------------------------------------------------------
// BootSplash
// ---------------------------------------------------------------------------
export function BootSplash({ onPhaseChange, onBooted, mode }: BootSplashProps) {
  const [phase, setPhase] = useState<BootPhase>('brand');
  const phaseRef = useRef<BootPhase>('brand');

  const advance = useCallback((next: BootPhase) => {
    phaseRef.current = next;
    setPhase(next);
    onPhaseChange(next);
  }, [onPhaseChange]);

  // --- Full cinematic sequence ---
  // brand (1800ms) → loading (1400ms) → chrome-in (600ms) → panels-in (800ms) → dismissible
  //
  // --- Condensed sequence ---
  // brand (600ms) → chrome-in (350ms) → panels-in (300ms) → auto-dismiss (200ms)
  useEffect(() => {
    sounds.boot();

    if (mode === 'full') {
      const t1 = setTimeout(() => advance('loading'), 1800);
      const t2 = setTimeout(() => {
        sounds.slideIn();
        advance('chrome-in');
      }, 3200); // 1800 + 1400
      const t3 = setTimeout(() => {
        sounds.slideIn();
        advance('panels-in');
      }, 3800); // 3200 + 600
      const t4 = setTimeout(() => advance('dismissible'), 4600); // 3800 + 800
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
    } else {
      // Condensed
      const t1 = setTimeout(() => {
        sounds.slideIn();
        advance('chrome-in');
      }, 600);
      const t2 = setTimeout(() => {
        sounds.slideIn();
        advance('panels-in');
      }, 950); // 600 + 350
      const t3 = setTimeout(() => advance('done'), 1450); // 950 + 300 + 200 auto-dismiss
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
  }, [mode, advance]);

  // --- Dismiss on click/key (full mode only, when dismissible) ---
  useEffect(() => {
    if (mode !== 'full' || phase !== 'dismissible') return;

    const dismiss = () => {
      sounds.whoosh();
      advance('done');
    };
    window.addEventListener('click', dismiss);
    window.addEventListener('keydown', dismiss);
    return () => {
      window.removeEventListener('click', dismiss);
      window.removeEventListener('keydown', dismiss);
    };
  }, [mode, phase, advance]);

  const showSplash = phase !== 'done';
  const showBackground = mode === 'full'
    ? !phaseAtLeast(phase, 'chrome-in')
    : !phaseAtLeast(phase, 'chrome-in');
  const showSpinner = mode === 'full' && phase === 'loading';

  return (
    <AnimatePresence onExitComplete={onBooted}>
      {showSplash && (
        <>
          {/* Background layer — full black with subtle emerald glow */}
          <AnimatePresence>
            {showBackground && (
              <motion.div
                key="bg"
                className="fixed inset-0 z-[200]"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                style={{
                  background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(16,185,129,0.06) 0%, #0a0a0a 70%)',
                }}
              />
            )}
          </AnimatePresence>

          {/* Logo + spinner overlay — pointer-events-none so chrome is interactive */}
          <motion.div
            key="splash-overlay"
            className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.25, ease: 'easeIn' }}
            style={{
              // Semi-transparent background persists after chrome-in so logo is visible on top
              background: phaseAtLeast(phase, 'chrome-in')
                ? 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(16,185,129,0.04) 0%, rgba(10,10,10,0.85) 70%)'
                : 'transparent',
            }}
          >
            {/* Floating card with glass + metallic treatment */}
            <motion.div
              className="relative flex flex-col items-center gap-4 px-16 py-12 rounded-2xl"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
              style={{
                background: 'linear-gradient(170deg, rgba(255,255,255,0.05) 0%, rgba(16,185,129,0.04) 40%, rgba(255,255,255,0.02) 100%)',
                backdropFilter: 'blur(24px) saturate(1.4)',
                WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 0 80px rgba(16,185,129,0.08), 0 0 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.2)',
              }}
            >
              {/* Metallic sheen highlight */}
              <div
                className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none"
                style={{
                  background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.03) 45%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 55%, transparent 60%)',
                }}
              />

              <h1 className="text-[42px] font-mono font-bold tracking-[0.3em] text-white relative">
                HUDSON
              </h1>

              {/* Accent line with glow */}
              <div className="relative">
                <div className="w-10 h-px bg-emerald-400/70" />
                <div
                  className="absolute inset-0 w-10 h-px"
                  style={{
                    background: 'rgba(16,185,129,0.5)',
                    filter: 'blur(4px)',
                  }}
                />
              </div>

              <span className="text-[11px] font-mono tracking-[0.5em] text-neutral-500 uppercase">
                OS
              </span>

              {/* Braille spinner — full mode only, loading phase */}
              <AnimatePresence>
                {showSpinner && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-2"
                  >
                    <BrailleSpinner />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Domain + credit */}
              <div className="flex flex-col items-center gap-1.5 mt-4">
                <span className="text-[10px] font-mono tracking-[0.2em] text-neutral-600">
                  hudson.arach.dev
                </span>
                <span className="text-[9px] font-mono tracking-[0.15em] text-neutral-700">
                  by @arach
                </span>
              </div>

              {/* Click to dismiss hint — full mode, dismissible phase */}
              <AnimatePresence>
                {phase === 'dismissible' && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-[9px] font-mono tracking-[0.2em] text-neutral-600 mt-2"
                  >
                    click or press any key
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

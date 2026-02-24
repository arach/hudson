'use client';

import { useState, useRef } from 'react';
import { GlyphWavesBg } from './GlyphWavesBg';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

export function CallToAction() {
  const [state, setState] = useState<FormState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const emailRef = useRef<HTMLInputElement>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const email = emailRef.current?.value.trim();
    if (!email) return;

    setState('submitting');
    setErrorMsg('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          honeypot: honeypotRef.current?.value || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Something went wrong.');
        setState('error');
        return;
      }

      setState('success');
    } catch {
      setErrorMsg('Network error. Please try again.');
      setState('error');
    }
  }

  return (
    <section className="py-32 relative overflow-hidden">
      <GlyphWavesBg />

      <div className="relative flex flex-col items-center text-center px-6">
        <h2 className="text-2xl font-mono font-bold tracking-wide text-neutral-100 mb-4">
          Interested?
        </h2>
        <p className="text-sm text-neutral-500 font-mono mb-8 max-w-[400px]">
          Hudson is in invite-only preview. Drop your email to get early access.
        </p>

        {state === 'success' ? (
          <div className="flex items-center gap-2 px-5 py-3 rounded-lg border border-emerald-800/50 bg-emerald-950/30">
            <span className="text-sm font-mono text-emerald-400">
              You&apos;re on the list — we&apos;ll be in touch.
            </span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col items-center gap-3 w-full max-w-[380px]">
            {/* Honeypot */}
            <input
              ref={honeypotRef}
              type="text"
              name="company_url"
              autoComplete="off"
              tabIndex={-1}
              aria-hidden="true"
              className="absolute opacity-0 pointer-events-none h-0 w-0"
            />

            <div className="flex w-full gap-2">
              <input
                ref={emailRef}
                type="email"
                placeholder="you@company.com"
                required
                disabled={state === 'submitting'}
                className="flex-1 h-10 px-4 rounded-lg bg-neutral-900/80 border border-neutral-700 text-sm font-mono text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-teal-600 transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={state === 'submitting'}
                className="btn-primary font-mono h-10 disabled:opacity-50"
              >
                {state === 'submitting' ? 'Sending...' : 'Get Access'}
              </button>
            </div>

            {state === 'error' && (
              <p className="text-xs font-mono text-red-400">{errorMsg}</p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}

'use client';

import { useState, useRef } from 'react';
import { GlyphWavesBg } from './GlyphWavesBg';

type FormState = 'idle' | 'open' | 'submitting' | 'success' | 'error';

const USE_CASES = [
  'Internal tools',
  'Customer-facing dashboard',
  'Dev environment',
  'Creative / design tool',
  'Data visualization',
  'Other',
] as const;

export function CallToAction() {
  const [state, setState] = useState<FormState>('idle');
  const [email, setEmail] = useState('');
  const [useCase, setUseCase] = useState('');
  const [context, setContext] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const honeypotRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !useCase) return;

    setState('submitting');
    setErrorMsg('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          useCase,
          context: context.trim(),
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
          Stay in the loop
        </h2>
        <p className="text-sm text-neutral-500 font-mono mb-8 max-w-[400px]">
          Get notified when the Hudson SDK is available for building your own apps.
        </p>

        {/* Honeypot — always rendered, hidden */}
        <input
          ref={honeypotRef}
          type="text"
          name="company_url"
          autoComplete="off"
          tabIndex={-1}
          aria-hidden="true"
          className="absolute opacity-0 pointer-events-none h-0 w-0"
        />

        {state === 'success' ? (
          <div className="flex items-center gap-2 px-5 py-3 rounded-lg border border-emerald-800/50 bg-emerald-950/30">
            <span className="text-sm font-mono text-emerald-400">
              You&apos;re on the list — we&apos;ll be in touch.
            </span>
          </div>
        ) : state === 'idle' ? (
          <button
            onClick={() => setState('open')}
            className="btn-primary font-mono h-10 px-8"
          >
            Notify Me
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col items-start gap-5 w-full max-w-[380px]">
            {/* Email */}
            <div className="w-full">
              <label className="block text-xs font-mono text-neutral-400 mb-2 text-left">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoFocus
                disabled={state === 'submitting'}
                className="w-full h-10 px-4 rounded-lg bg-neutral-900/80 border border-neutral-700 text-sm font-mono text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-teal-600 transition-colors disabled:opacity-50"
              />
            </div>

            {/* Use case */}
            <div className="w-full">
              <label className="block text-xs font-mono text-neutral-400 mb-2 text-left">
                What are you looking to build?
              </label>
              <div className="flex flex-wrap gap-2">
                {USE_CASES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setUseCase(option)}
                    className={`px-3 py-1.5 rounded-md text-xs font-mono border transition-colors ${
                      useCase === option
                        ? 'border-teal-600 bg-teal-950/40 text-teal-300'
                        : 'border-neutral-700 bg-neutral-900/60 text-neutral-400 hover:border-neutral-600 hover:text-neutral-300'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional context */}
            <div className="w-full">
              <label className="block text-xs font-mono text-neutral-400 mb-2 text-left">
                Anything else? <span className="text-neutral-600">(optional)</span>
              </label>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Tell us about your project..."
                rows={2}
                disabled={state === 'submitting'}
                className="w-full px-4 py-2.5 rounded-lg bg-neutral-900/80 border border-neutral-700 text-sm font-mono text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-teal-600 transition-colors resize-none disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={state === 'submitting' || !useCase || !email.trim()}
              className="btn-primary font-mono h-10 w-full disabled:opacity-50"
            >
              {state === 'submitting' ? 'Sending...' : 'Notify Me'}
            </button>

            {state === 'error' && (
              <p className="text-xs font-mono text-red-400 w-full text-center">{errorMsg}</p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}

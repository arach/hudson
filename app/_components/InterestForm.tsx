'use client';

import { useState } from 'react';
import { ArrowRight, Check, Loader2 } from 'lucide-react';

type Status = 'idle' | 'loading' | 'success' | 'error';

export function InterestForm() {
  const [email, setEmail] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'loading') return;

    setStatus('loading');
    setError(null);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          honeypot,
          context: 'landing-page',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus('error');
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }
      setStatus('success');
    } catch {
      setStatus('error');
      setError('Network error. Please try again.');
    }
  };

  if (status === 'success') {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-md border border-emerald-400/30 bg-emerald-400/5 text-emerald-200">
        <Check className="w-4 h-4 flex-shrink-0" />
        <div className="text-[14px]">
          <span className="font-medium">You&apos;re on the list.</span>
          <span className="text-emerald-300/70 ml-2">
            We&apos;ll be in touch as Hudson moves forward.
          </span>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          aria-label="Email address"
          disabled={status === 'loading'}
          className="flex-1 px-4 py-3 rounded-md border border-white/10 bg-white/[0.02] text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50 focus:bg-white/[0.04] transition disabled:opacity-50"
        />
        {/* Honeypot — real users won't fill this */}
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          aria-hidden="true"
          className="absolute left-[-9999px] w-px h-px opacity-0"
        />
        <button
          type="submit"
          disabled={status === 'loading' || !email}
          className="group inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md border border-cyan-400/40 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/20 hover:border-cyan-400/60 transition disabled:opacity-40 disabled:hover:bg-cyan-400/10 disabled:hover:border-cyan-400/40"
        >
          {status === 'loading' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Sending
            </>
          ) : (
            <>
              Keep me posted
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </div>
      {error && (
        <div className="text-[12px] text-rose-300/80">{error}</div>
      )}
      <div className="text-[11px] text-white/40">
        No spam. Updates only when something real lands.
      </div>
    </form>
  );
}

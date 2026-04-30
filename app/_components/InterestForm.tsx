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
      <div className="flex items-center gap-3 px-4 py-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200">
        <Check className="w-4 h-4 flex-shrink-0" />
        <div className="text-[14px]">
          <span className="font-medium">You&apos;re on the list.</span>
          <span className="text-emerald-700/80 dark:text-emerald-300/70 ml-2">
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
          className="flex-1 px-4 py-3 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-cyan-500/60 transition disabled:opacity-50"
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
          className="group inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md border border-cyan-500/50 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-500/70 transition disabled:opacity-40 disabled:hover:bg-cyan-500/10 disabled:hover:border-cyan-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        <div className="text-[12px] text-destructive">{error}</div>
      )}
      <div className="text-[11px] text-muted-foreground/80">
        No spam. Updates only when something real lands.
      </div>
    </form>
  );
}

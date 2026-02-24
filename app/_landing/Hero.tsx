import Link from 'next/link';
import { HeroScene } from './HeroScene';

export function Hero() {
  return (
    <section className="min-h-screen flex items-center relative overflow-hidden">
      {/* WebGL background scene */}
      <HeroScene />

      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 30% 50%, rgba(16,185,129,0.03) 0%, transparent 70%)',
        }}
      />

      <div className="relative max-w-[1200px] mx-auto w-full px-8 lg:px-16">
        <div className="flex flex-col justify-center py-24">
          {/* Metallic plaque wrapping all hero content */}
          <div
            className="relative flex flex-col px-10 py-10 rounded-xl max-w-[600px]"
            style={{
              background: 'linear-gradient(165deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 40%, rgba(0,0,0,0.1) 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.2), 0 4px 24px rgba(0,0,0,0.4)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {/* Top edge highlight */}
            <div
              className="absolute top-0 left-6 right-6 h-px"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1) 30%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.1) 70%, transparent)',
              }}
            />

            <span className="inline-flex self-start items-center px-3 py-1 rounded-full border border-emerald-500/30 text-[10px] font-mono tracking-[0.2em] text-emerald-400 uppercase mb-8">
              Invite-Only Preview
            </span>

            <h1 className="text-[64px] lg:text-[80px] font-mono font-bold tracking-[0.3em] text-white leading-none mb-5">
              HUDSON
            </h1>

            {/* Accent line with glow */}
            <div className="relative mb-6">
              <div className="w-10 h-px bg-emerald-400/70" />
              <div
                className="absolute inset-0 w-10 h-px"
                style={{
                  background: 'rgba(16,185,129,0.5)',
                  filter: 'blur(4px)',
                }}
              />
            </div>

            <p className="text-xl text-neutral-400 font-mono mb-3">
              Multi-app canvas workspace for React
            </p>

            <p className="text-[15px] text-neutral-500 font-mono leading-relaxed mb-8">
              Build apps with Provider&nbsp;+&nbsp;Slots&nbsp;+&nbsp;Hooks.
              Compose them into spatial workspaces with pan, zoom, and
              windowing&nbsp;&mdash; all for free.
            </p>

            <div className="flex items-center gap-4">
              <Link
                href="/demo"
                className="btn-primary font-mono"
              >
                Try the Demo
              </Link>
              <Link
                href="/docs"
                className="btn-secondary font-mono"
              >
                Read the Docs
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

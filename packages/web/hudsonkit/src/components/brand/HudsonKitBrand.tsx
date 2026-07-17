import React from 'react';

export interface HudsonKitMarkProps
  extends Omit<React.SVGProps<SVGSVGElement>, 'children'> {
  /** Square mark size. Inherits the surrounding text color. */
  size?: number | string;
  /** Adds an accessible name. Decorative marks should leave this undefined. */
  title?: string;
}

/**
 * HudsonKit's four-panel mark. The transparent seams and inward steps form an
 * H in negative space; `currentColor` keeps the same asset useful in light and
 * dark themes.
 */
export function HudsonKitMark({
  size = 24,
  title,
  style,
  ...props
}: HudsonKitMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="currentColor"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
      style={{ display: 'block', flex: 'none', ...style }}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <path d="M0 0h30v30h-6v-8h-6v8H0V0Z" />
      <path d="M34 0h30v30H46v-8h-6v8h-6V0Z" />
      <path d="M0 34h18v8h6v-8h6v30H0V34Z" />
      <path d="M34 34h6v8h6v-8h18v30H34V34Z" />
    </svg>
  );
}

export interface HudsonKitLockupProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Square mark size. */
  markSize?: number | string;
  /** Text used beside the mark. */
  wordmark?: string;
  /** Accessible label for the complete lockup. */
  label?: string;
  /** Gap between the mark and the wordmark. */
  gap?: number | string;
}

/** Theme-aware horizontal HudsonKit lockup. */
export function HudsonKitLockup({
  markSize = 20,
  wordmark = 'HUDSONKIT',
  label = wordmark,
  gap = '0.65em',
  style,
  ...props
}: HudsonKitLockupProps) {
  return (
    <span
      aria-label={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap,
        color: 'inherit',
        lineHeight: 1,
        ...style,
      }}
      {...props}
    >
      <HudsonKitMark size={markSize} />
      <span
        aria-hidden="true"
        style={{
          fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
          fontSize: '0.6875rem',
          fontWeight: 700,
          letterSpacing: '0.18em',
          lineHeight: 1,
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        {wordmark}
      </span>
    </span>
  );
}

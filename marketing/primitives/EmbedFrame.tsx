import type { CSSProperties, ReactNode } from 'react';

export type EmbedFrameProps = {
  /** Desktop / default frame height. Pixels accept a number, anything else
   *  passes through (e.g. a `clamp(...)` string). */
  height?: number | string;
  /** Optional override for phones (≤720px). Defaults to a clamp() that scales
   *  with the viewport: 60vh sits under any chrome above the embed without
   *  ever shrinking below 420px or stretching above the desktop height. */
  mobileHeight?: number | string;
  padding?: number | string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

function toCss(v: number | string): string {
  return typeof v === 'number' ? `${v}px` : v;
}

export function EmbedFrame({
  height = 720,
  mobileHeight,
  padding,
  className,
  style,
  children,
}: EmbedFrameProps) {
  // Frame heights have to scale on phones — Sheet01Hero hard-codes 720px,
  // Sheet02Possession passes 720, Sheet03Voice passes 460, Sheet07Quickstart
  // passes 520. On a 375pt iPhone, a 720px frame puts the workspace iframe
  // into a 245×718 letterbox that pushes the rest of the page out of frame.
  // We expose two tokens (`--embed-h`, `--embed-h-mobile`) so the responsive
  // cascade in site.css can switch between them at the breakpoint.
  const desktopH = toCss(height);
  const mobileH =
    mobileHeight !== undefined
      ? toCss(mobileHeight)
      : `clamp(420px, 60vh, ${desktopH})`;

  const merged: CSSProperties = {
    height: `var(--embed-h, ${desktopH})`,
    ...(padding !== undefined ? { padding } : null),
    position: 'relative',
    // Custom-property cast is the standard workaround for typed CSSProperties.
    ['--embed-h' as string]: desktopH,
    ['--embed-h-mobile' as string]: mobileH,
    ...style,
  };

  return (
    <div className={['embed-plate', className].filter(Boolean).join(' ')} style={merged}>
      <span className="embed-plate__corner embed-plate__corner--tl" />
      <span className="embed-plate__corner embed-plate__corner--tr" />
      <span className="embed-plate__corner embed-plate__corner--bl" />
      <span className="embed-plate__corner embed-plate__corner--br" />
      {children}
    </div>
  );
}

'use client';

import React from 'react';

// ---------------------------------------------------------------------------
// SkeletonMinimapThumb — placeholder thumbnail for the Minimap.
//
// The Minimap's children are absolutely-positioned divs whose coordinates are
// expressed as percentages of the 4000×4000 world space:
//
//   left:   ((b.x + 2000) / 4000) * 100%
//   top:    ((b.y + 2000) / 4000) * 100%
//   width:  (b.w / 4000) * 100%
//   height: (b.h / 4000) * 100%
//
// SkeletonMinimapThumb uses the same coordinate math so placeholder thumbs
// land exactly where real window thumbnails will appear.
//
// Usage (pass as children to <Minimap>):
//   <SkeletonMinimapThumb
//     key={appId}
//     bounds={config.defaultWindowBounds}
//   />
// ---------------------------------------------------------------------------

interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface SkeletonMinimapThumbProps {
  bounds: Bounds;
  /** Whether this app is the currently focused one (affects colour). */
  isFocused?: boolean;
}

/** World space extents used by the minimap (must match WORLD_SIZE in Minimap.tsx). */
const WORLD_SIZE = 4000;

const SkeletonMinimapThumb: React.FC<SkeletonMinimapThumbProps> = ({
  bounds,
  isFocused = false,
}) => {
  const left   = ((bounds.x + WORLD_SIZE / 2) / WORLD_SIZE) * 100;
  const top    = ((bounds.y + WORLD_SIZE / 2) / WORLD_SIZE) * 100;
  const width  = (bounds.w / WORLD_SIZE) * 100;
  const height = (bounds.h / WORLD_SIZE) * 100;

  return (
    <div
      aria-hidden="true"
      data-skeleton-minimap-thumb
      className={`absolute pointer-events-none rounded-[1px] ${
        isFocused
          ? 'border border-accent/40 bg-accent/06'
          : 'border border-muted-foreground/25 bg-muted-foreground/06'
      }`}
      style={{
        left:   `${left}%`,
        top:    `${top}%`,
        width:  `${width}%`,
        height: `${height}%`,
        animation: 'skeleton-minimap-pulse 2.4s ease-in-out infinite',
      }}
    />
  );
};

export default SkeletonMinimapThumb;

// ---------------------------------------------------------------------------
// Keyframe for the subtle pulse — injected once, module-level.
// ---------------------------------------------------------------------------
let _pulseInjected = false;

if (typeof document !== 'undefined' && !_pulseInjected) {
  _pulseInjected = true;
  const style = document.createElement('style');
  style.dataset.hudsonSkeleton = 'minimap-pulse';
  style.textContent = `
    @keyframes skeleton-minimap-pulse {
      0%, 100% { opacity: 0.55; }
      50%       { opacity: 0.85; }
    }
  `;
  document.head.appendChild(style);
}

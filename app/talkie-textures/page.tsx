"use client";

import { useState, type ReactNode } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// Brand tokens (from narrative-studio tokens.ts)
// ═══════════════════════════════════════════════════════════════════════════════

const C = {
  studioCream: "#F4EFE6",
  ribbonBlack: "#0E0D0A",
  hotMic: "#FF5346",
  cassetteOrange: "#E68A3C",
  cautionYellow: "#E8C547",
  tapeTan: "#7A6E5C",
  graphite: "#B8B2A4",
  signalGreen: "#5FD088",
  surfaceDark: "#1A1813",
  borderDark: "#3A372F",
  borderHairline: "#23201a",
  amberLed: "#E8B547",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// Glyph geometry (locked t, from T_GEOMETRY)
// ═══════════════════════════════════════════════════════════════════════════════

const GS = 1024; // internal SVG master size
const GVW = GS * 0.62; // glyph viewBox width
const GPAD = (GS - GVW) / 2; // horizontal centering pad
const GTX = GS * 0.31; // text-anchor x (cellCenter)
const GTY = GS * 0.86; // baseline
const GFS = GS * 0.78; // fontSize
const FONT = "var(--font-jetbrains-mono), ui-monospace, monospace";
const STEM_W = GS * 0.08;

// ═══════════════════════════════════════════════════════════════════════════════
// Wordmark geometry (from wordmark.tsx)
// ═══════════════════════════════════════════════════════════════════════════════

const WM_SIZE = 180; // reference size for wordmark
const WM_UPM = 1000;
const WM_ADV = [600, 600, 600, 600, 340, 600]; // t a l k i e
const WM_KERN = [0, 0, 24, 0, 0]; // ta al lk ki ie
const WM_I_STEM_TOP = 550;
const WM_I_STEM_W = 108;
const WM_I_OFFSET = 45;

function wmLayout(size: number) {
  const u = size / WM_UPM;
  const xs: number[] = [0];
  for (let g = 0; g < 5; g++) xs.push(xs[g] + WM_ADV[g] - WM_KERN[g]);
  const totalW = (xs[5] + WM_ADV[5]) * u;
  const baseline = size * 0.82;
  const height = size * 1.05;
  const stemCx = (xs[4] + WM_I_OFFSET) * u;
  const dotR = (WM_I_STEM_W * u / 2) * 1.7;
  const dotCy = baseline - WM_I_STEM_TOP * u - dotR * 1.4;
  return { xs: xs.map((x) => x * u), totalW, baseline, height, u, stemCx, dotR, dotCy };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Study metadata
// ═══════════════════════════════════════════════════════════════════════════════

interface Study {
  id: string;
  name: string;
  desc: string;
  technique: string;
}

const STUDIES: Study[] = [
  { id: "phosphor", name: "1 · Phosphor CRT", desc: "Amber LED trace on black, scanline overlay, soft bloom. Old terminal rendering the mark in spec mode.", technique: "feGaussianBlur bloom ×2 + rect pattern scanlines" },
  { id: "dot-matrix", name: "2 · Dot-matrix", desc: "Circular dots on a regular grid. Lit dots in Amber LED on a faintly visible unlit field. Airport-sign energy.", technique: "SVG circle-pattern mask + composited unlit grid" },
  { id: "pixel", name: "3 · Pixel / Bitmap", desc: "Chunky low-res grid, sharp-edged pixels, single fill, no anti-alias. Hot Mic highlight at the dot.", technique: "SVG rect-pattern mask with 2px gap between cells" },
  { id: "halftone", name: "4 · Halftone / Risograph", desc: "Overprinted misregistered layers in Hot Mic and Tape Tan. Tactile printed-zine feel.", technique: "Dual-layer circle-pattern mask + 3px registration offset" },
  { id: "letterpress", name: "5 · Letterpress", desc: "Ink-bleed edges, paper-grain noise, directional shadow. Press proof on warm cream.", technique: "feTurbulence grain + feMorphology dilate + feOffset shadow" },
  { id: "etched", name: "6 · Etched / Engraved", desc: "Fine cross-hatched texture inside the fill. Banknote portrait or scientific instrument plate.", technique: "Dual-angle line-pattern fill + text clipPath" },
  { id: "chrome", name: "7 · Warm Brass", desc: "Tarnished brass with environment gradient reflections. One committed metal.", technique: "Multi-stop linearGradient + feSpecularLighting + feComposite" },
  { id: "particle", name: "8 · Particle / Breath", desc: "Clustered dots forming the letterform. Dense at strokes, sparse at edges. Speech-particle scatter.", technique: "feTurbulence threshold + feMorphology dilate mask region" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Shared SVG wrappers
// ═══════════════════════════════════════════════════════════════════════════════

function GlyphFrame({ size, bg, children }: { size: number; bg: string; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${GS} ${GS}`} width={size} height={size} style={{ display: "block", borderRadius: 6, overflow: "hidden" }}>
      <rect width={GS} height={GS} fill={bg} />
      <g transform={`translate(${GPAD}, 0)`}>{children}</g>
    </svg>
  );
}

function WmFrame({ size, bg, children }: { size: number; bg: string; children: ReactNode }) {
  const wm = wmLayout(WM_SIZE);
  const pad = 20;
  const vw = wm.totalW + pad * 2;
  const vh = wm.height + pad * 2;
  const scale = size / 80; // scale factor for display
  return (
    <svg viewBox={`${-pad} ${-pad} ${vw} ${vh}`} width={vw * scale / 3} height={vh * scale / 3} style={{ display: "block", borderRadius: 6, overflow: "hidden" }}>
      <rect x={-pad} y={-pad} width={vw} height={vh} fill={bg} />
      {children}
    </svg>
  );
}

function DotFrame({ size, bg, children }: { size: number; bg: string; children: ReactNode }) {
  const s = 128;
  const displaySize = Math.max(32, size / 4);
  return (
    <svg viewBox={`0 0 ${s} ${s}`} width={displaySize} height={displaySize} style={{ display: "block", borderRadius: 6, overflow: "hidden" }}>
      <rect width={s} height={s} fill={bg} />
      {children}
    </svg>
  );
}

// Base text element for the t glyph (no fill — caller provides)
function TText(props: React.SVGAttributes<SVGTextElement>) {
  return (
    <text
      x={GTX}
      y={GTY}
      fontSize={GFS}
      fontWeight={500}
      textAnchor="middle"
      style={{ fontFamily: FONT }}
      {...props}
    >
      t
    </text>
  );
}

// Base wordmark text
function WmText({ ink, ...props }: { ink: string } & React.SVGAttributes<SVGTextElement>) {
  const wm = wmLayout(WM_SIZE);
  return (
    <text
      x={wm.xs.join(" ")}
      y={wm.baseline}
      fontSize={WM_SIZE}
      fontWeight={500}
      fill={ink}
      style={{ fontFamily: FONT }}
      {...props}
    >
      talkie
    </text>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · PHOSPHOR CRT
// ═══════════════════════════════════════════════════════════════════════════════

function PhosphorGlyph({ size, uid }: { size: number; uid: string }) {
  return (
    <GlyphFrame size={size} bg={C.ribbonBlack}>
      <defs>
        <filter id={`${uid}-bloom`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="b1" />
          <feGaussianBlur in="SourceGraphic" stdDeviation="20" result="b2" />
          <feGaussianBlur in="SourceGraphic" stdDeviation="40" result="b3" />
          <feMerge>
            <feMergeNode in="b3" />
            <feMergeNode in="b2" />
            <feMergeNode in="b1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <pattern id={`${uid}-scan`} width="1" height="6" patternUnits="userSpaceOnUse">
          <rect width="1" height="3" fill="black" opacity="0.2" />
        </pattern>
      </defs>
      <TText fill={C.amberLed} filter={`url(#${uid}-bloom)`} />
      <rect width={GVW} height={GS} fill={`url(#${uid}-scan)`} />
    </GlyphFrame>
  );
}

function PhosphorWm({ size, uid }: { size: number; uid: string }) {
  const wm = wmLayout(WM_SIZE);
  return (
    <WmFrame size={size} bg={C.ribbonBlack}>
      <defs>
        <filter id={`${uid}-wmbloom`} x="-20%" y="-30%" width="140%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b1" />
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b2" />
          <feMerge>
            <feMergeNode in="b2" />
            <feMergeNode in="b1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <pattern id={`${uid}-wmscan`} width="1" height="3" patternUnits="userSpaceOnUse">
          <rect width="1" height="1.5" fill="black" opacity="0.18" />
        </pattern>
      </defs>
      <WmText ink={C.amberLed} filter={`url(#${uid}-wmbloom)`} />
      <circle cx={wm.stemCx} cy={wm.dotCy} r={wm.dotR} fill={C.amberLed} filter={`url(#${uid}-wmbloom)`} />
      <rect x={0} y={0} width={wm.totalW} height={wm.height} fill={`url(#${uid}-wmscan)`} />
    </WmFrame>
  );
}

function PhosphorDot({ size, uid, restrained }: { size: number; uid: string; restrained: boolean }) {
  const s = 128;
  const r = restrained ? 14 : 22;
  return (
    <DotFrame size={size} bg={C.ribbonBlack}>
      <defs>
        <filter id={`${uid}-dotbloom`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={restrained ? 3 : 8} result="b1" />
          <feGaussianBlur in="SourceGraphic" stdDeviation={restrained ? 6 : 18} result="b2" />
          <feMerge>
            <feMergeNode in="b2" />
            <feMergeNode in="b1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx={s / 2} cy={s / 2} r={r} fill={C.amberLed} filter={`url(#${uid}-dotbloom)`} />
    </DotFrame>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · DOT-MATRIX
// ═══════════════════════════════════════════════════════════════════════════════

function DotMatrixGlyph({ size, uid }: { size: number; uid: string }) {
  const dotSpacing = 36;
  const dotR = 12;
  const unlitR = 11;
  return (
    <GlyphFrame size={size} bg={C.ribbonBlack}>
      <defs>
        <pattern id={`${uid}-litgrid`} width={dotSpacing} height={dotSpacing} patternUnits="userSpaceOnUse">
          <circle cx={dotSpacing / 2} cy={dotSpacing / 2} r={dotR} fill="white" />
        </pattern>
        <pattern id={`${uid}-unlitgrid`} width={dotSpacing} height={dotSpacing} patternUnits="userSpaceOnUse">
          <circle cx={dotSpacing / 2} cy={dotSpacing / 2} r={unlitR} fill={C.borderDark} opacity="0.3" />
        </pattern>
        <mask id={`${uid}-dotmask`}>
          <rect width={GVW} height={GS} fill={`url(#${uid}-litgrid)`} />
        </mask>
      </defs>
      <rect width={GVW} height={GS} fill={`url(#${uid}-unlitgrid)`} />
      <TText fill={C.amberLed} mask={`url(#${uid}-dotmask)`} />
    </GlyphFrame>
  );
}

function DotMatrixWm({ size, uid }: { size: number; uid: string }) {
  const wm = wmLayout(WM_SIZE);
  const dotSpacing = 10;
  const dotR = 3.2;
  return (
    <WmFrame size={size} bg={C.ribbonBlack}>
      <defs>
        <pattern id={`${uid}-wmlitgrid`} width={dotSpacing} height={dotSpacing} patternUnits="userSpaceOnUse">
          <circle cx={dotSpacing / 2} cy={dotSpacing / 2} r={dotR} fill="white" />
        </pattern>
        <pattern id={`${uid}-wmunlitgrid`} width={dotSpacing} height={dotSpacing} patternUnits="userSpaceOnUse">
          <circle cx={dotSpacing / 2} cy={dotSpacing / 2} r={dotR * 0.85} fill={C.borderDark} opacity="0.2" />
        </pattern>
        <mask id={`${uid}-wmdotmask`}>
          <rect x={0} y={0} width={wm.totalW} height={wm.height} fill={`url(#${uid}-wmlitgrid)`} />
        </mask>
      </defs>
      <rect x={0} y={0} width={wm.totalW} height={wm.height} fill={`url(#${uid}-wmunlitgrid)`} />
      <WmText ink={C.cassetteOrange} mask={`url(#${uid}-wmdotmask)`} />
      <circle cx={wm.stemCx} cy={wm.dotCy} r={wm.dotR} fill={C.hotMic} mask={`url(#${uid}-wmdotmask)`} />
    </WmFrame>
  );
}

function DotMatrixDot({ size, uid, restrained }: { size: number; uid: string; restrained: boolean }) {
  const s = 128;
  const grid = restrained ? 1 : 3;
  const dotSize = 8;
  const gap = 3;
  const total = grid * dotSize + (grid - 1) * gap;
  const offset = (s - total) / 2;
  const dots: ReactNode[] = [];
  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      dots.push(
        <circle
          key={`${r}-${c}`}
          cx={offset + c * (dotSize + gap) + dotSize / 2}
          cy={offset + r * (dotSize + gap) + dotSize / 2}
          r={dotSize / 2}
          fill={C.amberLed}
        />
      );
    }
  }
  return (
    <DotFrame size={size} bg={C.ribbonBlack}>
      <defs>
        <pattern id={`${uid}-dotunlit`} width={dotSize + gap} height={dotSize + gap} patternUnits="userSpaceOnUse">
          <circle cx={(dotSize + gap) / 2} cy={(dotSize + gap) / 2} r={dotSize / 2 - 1} fill={C.borderDark} opacity="0.25" />
        </pattern>
      </defs>
      <rect width={s} height={s} fill={`url(#${uid}-dotunlit)`} />
      {dots}
    </DotFrame>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · PIXEL / BITMAP
// ═══════════════════════════════════════════════════════════════════════════════

function PixelGlyph({ size, uid }: { size: number; uid: string }) {
  const cellSize = 48;
  const gap = 4;
  return (
    <GlyphFrame size={size} bg={C.ribbonBlack}>
      <defs>
        <pattern id={`${uid}-pixgrid`} width={cellSize} height={cellSize} patternUnits="userSpaceOnUse">
          <rect width={cellSize - gap} height={cellSize - gap} fill="white" />
        </pattern>
        <mask id={`${uid}-pixmask`}>
          <rect width={GVW} height={GS} fill={`url(#${uid}-pixgrid)`} />
        </mask>
      </defs>
      <TText fill={C.studioCream} mask={`url(#${uid}-pixmask)`} />
    </GlyphFrame>
  );
}

function PixelWm({ size, uid }: { size: number; uid: string }) {
  const wm = wmLayout(WM_SIZE);
  const cellSize = 12;
  const gap = 1.5;
  return (
    <WmFrame size={size} bg={C.ribbonBlack}>
      <defs>
        <pattern id={`${uid}-wmpixgrid`} width={cellSize} height={cellSize} patternUnits="userSpaceOnUse">
          <rect width={cellSize - gap} height={cellSize - gap} fill="white" />
        </pattern>
        <mask id={`${uid}-wmpixmask`}>
          <rect x={0} y={0} width={wm.totalW} height={wm.height} fill={`url(#${uid}-wmpixgrid)`} />
        </mask>
      </defs>
      <WmText ink={C.studioCream} mask={`url(#${uid}-wmpixmask)`} />
      <circle cx={wm.stemCx} cy={wm.dotCy} r={wm.dotR} fill={C.hotMic} mask={`url(#${uid}-wmpixmask)`} />
    </WmFrame>
  );
}

function PixelDot({ size, uid, restrained }: { size: number; uid: string; restrained: boolean }) {
  const s = 128;
  const grid = restrained ? 2 : 3;
  const cellSize = 12;
  const gap = 2;
  const total = grid * cellSize + (grid - 1) * gap;
  const offset = (s - total) / 2;
  const rects: ReactNode[] = [];
  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      rects.push(
        <rect key={`${r}-${c}`} x={offset + c * (cellSize + gap)} y={offset + r * (cellSize + gap)} width={cellSize} height={cellSize} fill={r === 0 && c === Math.floor(grid / 2) ? C.hotMic : C.studioCream} />
      );
    }
  }
  return (
    <DotFrame size={size} bg={C.ribbonBlack}>
      {rects}
    </DotFrame>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · HALFTONE / RISOGRAPH
// ═══════════════════════════════════════════════════════════════════════════════

function HalftoneGlyph({ size, uid }: { size: number; uid: string }) {
  const dotSpacing = 24;
  const dotR = 8;
  return (
    <GlyphFrame size={size} bg={C.studioCream}>
      <defs>
        <pattern id={`${uid}-htdots`} width={dotSpacing} height={dotSpacing} patternUnits="userSpaceOnUse">
          <circle cx={dotSpacing / 2} cy={dotSpacing / 2} r={dotR} fill="white" />
        </pattern>
        <mask id={`${uid}-htmask1`}>
          <rect width={GVW} height={GS} fill={`url(#${uid}-htdots)`} />
        </mask>
        <mask id={`${uid}-htmask2`}>
          <rect width={GVW} height={GS} fill={`url(#${uid}-htdots)`} x="3" y="3" />
        </mask>
      </defs>
      {/* Layer 1: Hot Mic, slight offset */}
      <TText fill={C.hotMic} mask={`url(#${uid}-htmask1)`} transform="translate(3, 2)" opacity="0.8" />
      {/* Layer 2: Tape Tan, no offset */}
      <TText fill={C.tapeTan} mask={`url(#${uid}-htmask2)`} opacity="0.9" />
    </GlyphFrame>
  );
}

function HalftoneWm({ size, uid }: { size: number; uid: string }) {
  const wm = wmLayout(WM_SIZE);
  const dotSpacing = 7;
  const dotR = 2.4;
  return (
    <WmFrame size={size} bg={C.studioCream}>
      <defs>
        <pattern id={`${uid}-wmhtdots`} width={dotSpacing} height={dotSpacing} patternUnits="userSpaceOnUse">
          <circle cx={dotSpacing / 2} cy={dotSpacing / 2} r={dotR} fill="white" />
        </pattern>
        <mask id={`${uid}-wmhtmask1`}>
          <rect x={-20} y={-20} width={wm.totalW + 40} height={wm.height + 40} fill={`url(#${uid}-wmhtdots)`} />
        </mask>
        <mask id={`${uid}-wmhtmask2`}>
          <rect x={-20} y={-20} width={wm.totalW + 40} height={wm.height + 40} fill={`url(#${uid}-wmhtdots)`} />
        </mask>
      </defs>
      <g transform="translate(2, 1)">
        <WmText ink={C.hotMic} mask={`url(#${uid}-wmhtmask1)`} opacity="0.7" />
        <circle cx={wm.stemCx} cy={wm.dotCy} r={wm.dotR} fill={C.hotMic} mask={`url(#${uid}-wmhtmask1)`} opacity="0.7" />
      </g>
      <WmText ink={C.tapeTan} mask={`url(#${uid}-wmhtmask2)`} opacity="0.85" />
      <circle cx={wm.stemCx} cy={wm.dotCy} r={wm.dotR} fill={C.tapeTan} mask={`url(#${uid}-wmhtmask2)`} opacity="0.85" />
    </WmFrame>
  );
}

function HalftoneDot({ size, uid, restrained }: { size: number; uid: string; restrained: boolean }) {
  const s = 128;
  if (restrained) {
    return (
      <DotFrame size={size} bg={C.studioCream}>
        <circle cx={s / 2} cy={s / 2} r={12} fill={C.tapeTan} opacity="0.7" />
        <circle cx={s / 2 + 2} cy={s / 2 + 1} r={10} fill={C.hotMic} opacity="0.5" />
      </DotFrame>
    );
  }
  const dots: ReactNode[] = [];
  const spacing = 9;
  const count = 5;
  const total = count * spacing;
  const off = (s - total) / 2;
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      const dist = Math.sqrt((r - 2) ** 2 + (c - 2) ** 2);
      if (dist > 2.5) continue;
      const rr = Math.max(1, 4 - dist);
      const color = (r + c) % 3 === 0 ? C.hotMic : C.tapeTan;
      dots.push(
        <circle key={`${r}-${c}`} cx={off + c * spacing + spacing / 2} cy={off + r * spacing + spacing / 2} r={rr} fill={color} opacity={0.7 + (1 - dist / 2.5) * 0.3} />
      );
    }
  }
  return (
    <DotFrame size={size} bg={C.studioCream}>{dots}</DotFrame>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5 · LETTERPRESS
// ═══════════════════════════════════════════════════════════════════════════════

function LetterpressGlyph({ size, uid }: { size: number; uid: string }) {
  return (
    <GlyphFrame size={size} bg={C.studioCream}>
      <defs>
        <filter id={`${uid}-lp`} x="-5%" y="-5%" width="110%" height="110%">
          {/* Paper grain texture */}
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="4" seed={42} result="grain" />
          {/* Ink bleed: slight dilate */}
          <feMorphology in="SourceGraphic" operator="dilate" radius="1.2" result="bleed" />
          {/* Directional shadow */}
          <feOffset in="bleed" dx="3" dy="5" result="offset" />
          <feGaussianBlur in="offset" stdDeviation="3" result="shadow" />
          <feFlood floodColor={C.ribbonBlack} floodOpacity="0.15" result="shadowColor" />
          <feComposite in="shadowColor" in2="shadow" operator="in" result="coloredShadow" />
          {/* Combine: shadow + bled text */}
          <feMerge result="combo">
            <feMergeNode in="coloredShadow" />
            <feMergeNode in="bleed" />
          </feMerge>
          {/* Grain overlay */}
          <feBlend in="combo" in2="grain" mode="multiply" />
        </filter>
      </defs>
      <TText fill={C.ribbonBlack} filter={`url(#${uid}-lp)`} />
    </GlyphFrame>
  );
}

function LetterpressWm({ size, uid }: { size: number; uid: string }) {
  const wm = wmLayout(WM_SIZE);
  return (
    <WmFrame size={size} bg={C.studioCream}>
      <defs>
        <filter id={`${uid}-wmlp`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" seed={77} result="grain" />
          <feMorphology in="SourceGraphic" operator="dilate" radius="0.3" result="bleed" />
          <feOffset in="bleed" dx="0.8" dy="1.2" result="offset" />
          <feGaussianBlur in="offset" stdDeviation="0.8" result="shadow" />
          <feFlood floodColor={C.ribbonBlack} floodOpacity="0.12" result="sc" />
          <feComposite in="sc" in2="shadow" operator="in" result="cs" />
          <feMerge result="combo">
            <feMergeNode in="cs" />
            <feMergeNode in="bleed" />
          </feMerge>
          <feBlend in="combo" in2="grain" mode="multiply" />
        </filter>
      </defs>
      <WmText ink={C.ribbonBlack} filter={`url(#${uid}-wmlp)`} />
      <circle cx={wm.stemCx} cy={wm.dotCy} r={wm.dotR} fill={C.hotMic} filter={`url(#${uid}-wmlp)`} />
    </WmFrame>
  );
}

function LetterPressDot({ size, uid, restrained }: { size: number; uid: string; restrained: boolean }) {
  const s = 128;
  const r = restrained ? 10 : 16;
  return (
    <DotFrame size={size} bg={C.studioCream}>
      <defs>
        <filter id={`${uid}-dotlp`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="3" seed={33} result="g" />
          <feMorphology in="SourceGraphic" operator="dilate" radius={restrained ? 0.5 : 1.5} result="bl" />
          <feOffset in="bl" dx="1" dy="2" result="off" />
          <feGaussianBlur in="off" stdDeviation="1.5" result="sh" />
          <feFlood floodColor={C.ribbonBlack} floodOpacity="0.1" result="sc" />
          <feComposite in="sc" in2="sh" operator="in" result="cs" />
          <feMerge result="c">
            <feMergeNode in="cs" />
            <feMergeNode in="bl" />
          </feMerge>
          <feBlend in="c" in2="g" mode="multiply" />
        </filter>
      </defs>
      <circle cx={s / 2} cy={s / 2} r={r} fill={C.ribbonBlack} filter={`url(#${uid}-dotlp)`} />
    </DotFrame>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6 · ETCHED / ENGRAVED
// ═══════════════════════════════════════════════════════════════════════════════

function EtchedGlyph({ size, uid }: { size: number; uid: string }) {
  return (
    <GlyphFrame size={size} bg={C.ribbonBlack}>
      <defs>
        <clipPath id={`${uid}-textclip`}>
          <TText />
        </clipPath>
        <pattern id={`${uid}-hatch1`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <line x1="0" y1="0" x2="0" y2="8" stroke={C.tapeTan} strokeWidth="0.6" />
        </pattern>
        <pattern id={`${uid}-hatch2`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
          <line x1="0" y1="0" x2="0" y2="8" stroke={C.tapeTan} strokeWidth="0.5" />
        </pattern>
        <pattern id={`${uid}-hatch3`} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(0)">
          <line x1="0" y1="0" x2="0" y2="12" stroke={C.tapeTan} strokeWidth="0.3" opacity="0.5" />
        </pattern>
      </defs>
      <g clipPath={`url(#${uid}-textclip)`}>
        <rect width={GVW} height={GS} fill={`url(#${uid}-hatch1)`} />
        <rect width={GVW} height={GS} fill={`url(#${uid}-hatch2)`} opacity="0.7" />
        <rect width={GVW} height={GS} fill={`url(#${uid}-hatch3)`} opacity="0.4" />
      </g>
      {/* Thin outline for definition */}
      <TText fill="none" stroke={C.tapeTan} strokeWidth="1" opacity="0.6" />
    </GlyphFrame>
  );
}

function EtchedWm({ size, uid }: { size: number; uid: string }) {
  const wm = wmLayout(WM_SIZE);
  return (
    <WmFrame size={size} bg={C.ribbonBlack}>
      <defs>
        <clipPath id={`${uid}-wmtextclip`}>
          <WmText ink="white" />
          <circle cx={wm.stemCx} cy={wm.dotCy} r={wm.dotR} />
        </clipPath>
        <pattern id={`${uid}-wmhatch1`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <line x1="0" y1="0" x2="0" y2="4" stroke={C.tapeTan} strokeWidth="0.4" />
        </pattern>
        <pattern id={`${uid}-wmhatch2`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
          <line x1="0" y1="0" x2="0" y2="4" stroke={C.tapeTan} strokeWidth="0.35" />
        </pattern>
      </defs>
      <g clipPath={`url(#${uid}-wmtextclip)`}>
        <rect x={-20} y={-20} width={wm.totalW + 40} height={wm.height + 40} fill={`url(#${uid}-wmhatch1)`} />
        <rect x={-20} y={-20} width={wm.totalW + 40} height={wm.height + 40} fill={`url(#${uid}-wmhatch2)`} opacity="0.6" />
      </g>
      <WmText ink="none" stroke={C.tapeTan} strokeWidth="0.5" opacity="0.5" />
      <circle cx={wm.stemCx} cy={wm.dotCy} r={wm.dotR} fill="none" stroke={C.tapeTan} strokeWidth="0.5" opacity="0.5" />
    </WmFrame>
  );
}

function EtchedDot({ size, uid, restrained }: { size: number; uid: string; restrained: boolean }) {
  const s = 128;
  const r = restrained ? 10 : 18;
  return (
    <DotFrame size={size} bg={C.ribbonBlack}>
      <defs>
        <clipPath id={`${uid}-dotclip`}>
          <circle cx={s / 2} cy={s / 2} r={r} />
        </clipPath>
        <pattern id={`${uid}-dothatch1`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <line x1="0" y1="0" x2="0" y2="4" stroke={C.tapeTan} strokeWidth={restrained ? 0.3 : 0.5} />
        </pattern>
        <pattern id={`${uid}-dothatch2`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
          <line x1="0" y1="0" x2="0" y2="4" stroke={C.tapeTan} strokeWidth={restrained ? 0.25 : 0.4} />
        </pattern>
      </defs>
      <g clipPath={`url(#${uid}-dotclip)`}>
        <rect width={s} height={s} fill={`url(#${uid}-dothatch1)`} />
        <rect width={s} height={s} fill={`url(#${uid}-dothatch2)`} opacity="0.6" />
      </g>
      <circle cx={s / 2} cy={s / 2} r={r} fill="none" stroke={C.tapeTan} strokeWidth={restrained ? 0.5 : 0.8} opacity="0.5" />
    </DotFrame>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7 · WARM BRASS (Chrome / Liquid Metal)
// ═══════════════════════════════════════════════════════════════════════════════

function ChromeGlyph({ size, uid }: { size: number; uid: string }) {
  return (
    <GlyphFrame size={size} bg={C.ribbonBlack}>
      <defs>
        <linearGradient id={`${uid}-brass`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D4C4A0" />
          <stop offset="18%" stopColor="#8A7650" />
          <stop offset="35%" stopColor="#C9B580" />
          <stop offset="50%" stopColor="#F0E4C8" />
          <stop offset="65%" stopColor="#9A8660" />
          <stop offset="82%" stopColor="#705830" />
          <stop offset="100%" stopColor="#C0A870" />
        </linearGradient>
        <filter id={`${uid}-metal`} x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="smooth" />
          <feSpecularLighting in="smooth" surfaceScale="8" specularConstant="1.2" specularExponent="25" result="spec">
            <fePointLight x={GVW * 0.3} y={-200} z={300} />
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceGraphic" operator="in" result="specClip" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="specClip" />
          </feMerge>
        </filter>
      </defs>
      <TText fill={`url(#${uid}-brass)`} filter={`url(#${uid}-metal)`} />
    </GlyphFrame>
  );
}

function ChromeWm({ size, uid }: { size: number; uid: string }) {
  const wm = wmLayout(WM_SIZE);
  return (
    <WmFrame size={size} bg={C.ribbonBlack}>
      <defs>
        <linearGradient id={`${uid}-wmbrass`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D4C4A0" />
          <stop offset="20%" stopColor="#8A7650" />
          <stop offset="40%" stopColor="#C9B580" />
          <stop offset="55%" stopColor="#EDE0C4" />
          <stop offset="70%" stopColor="#9A8660" />
          <stop offset="85%" stopColor="#705830" />
          <stop offset="100%" stopColor="#B8A468" />
        </linearGradient>
        <filter id={`${uid}-wmmetal`} x="-5%" y="-10%" width="110%" height="120%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="0.3" result="sm" />
          <feSpecularLighting in="sm" surfaceScale="4" specularConstant="1" specularExponent="20" result="sp">
            <fePointLight x={wm.totalW * 0.4} y={-40} z={100} />
          </feSpecularLighting>
          <feComposite in="sp" in2="SourceGraphic" operator="in" result="sc" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="sc" />
          </feMerge>
        </filter>
      </defs>
      <WmText ink={`url(#${uid}-wmbrass)`} filter={`url(#${uid}-wmmetal)`} />
      <circle cx={wm.stemCx} cy={wm.dotCy} r={wm.dotR} fill={`url(#${uid}-wmbrass)`} filter={`url(#${uid}-wmmetal)`} />
    </WmFrame>
  );
}

function ChromeDot({ size, uid, restrained }: { size: number; uid: string; restrained: boolean }) {
  const s = 128;
  const r = restrained ? 10 : 20;
  return (
    <DotFrame size={size} bg={C.ribbonBlack}>
      <defs>
        <radialGradient id={`${uid}-dotbrass`} cx="40%" cy="35%">
          <stop offset="0%" stopColor="#F0E4C8" />
          <stop offset="40%" stopColor="#C9B580" />
          <stop offset="70%" stopColor="#8A7650" />
          <stop offset="100%" stopColor="#604820" />
        </radialGradient>
      </defs>
      <circle cx={s / 2} cy={s / 2} r={r} fill={`url(#${uid}-dotbrass)`} />
      {!restrained && <circle cx={s / 2 - r * 0.2} cy={s / 2 - r * 0.25} r={r * 0.3} fill="#F0E4C8" opacity="0.3" />}
    </DotFrame>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8 · PARTICLE / BREATH / SCATTER
// ═══════════════════════════════════════════════════════════════════════════════

function ParticleGlyph({ size, uid }: { size: number; uid: string }) {
  return (
    <GlyphFrame size={size} bg={C.ribbonBlack}>
      <defs>
        <filter id={`${uid}-part`} x="-15%" y="-15%" width="130%" height="130%">
          {/* Dilate text to create wider particle region */}
          <feMorphology in="SourceGraphic" operator="dilate" radius="12" result="wide" />
          {/* Noise pattern for particles */}
          <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="4" seed={7} result="noise" />
          {/* Threshold the noise to create dots */}
          <feComponentTransfer in="noise" result="dots">
            <feFuncA type="discrete" tableValues="0 0 0 0 1 1 0 0 0 0" />
          </feComponentTransfer>
          {/* Mask dots to the dilated text region */}
          <feComposite in="dots" in2="wide" operator="in" result="outerDots" />
          {/* Color the dots */}
          <feFlood floodColor={C.cassetteOrange} floodOpacity="0.6" result="color" />
          <feComposite in="color" in2="outerDots" operator="in" result="coloredOuter" />
          {/* Core text, slightly smaller dots */}
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed={13} result="noise2" />
          <feComponentTransfer in="noise2" result="dots2">
            <feFuncA type="discrete" tableValues="0 0 0 1 1 1 1 0 0 0" />
          </feComponentTransfer>
          <feComposite in="dots2" in2="SourceGraphic" operator="in" result="innerDots" />
          <feFlood floodColor={C.cassetteOrange} result="color2" />
          <feComposite in="color2" in2="innerDots" operator="in" result="coloredInner" />
          {/* Merge outer scatter + dense inner */}
          <feMerge>
            <feMergeNode in="coloredOuter" />
            <feMergeNode in="coloredInner" />
          </feMerge>
        </filter>
      </defs>
      <TText fill={C.cassetteOrange} filter={`url(#${uid}-part)`} />
    </GlyphFrame>
  );
}

function ParticleWm({ size, uid }: { size: number; uid: string }) {
  const wm = wmLayout(WM_SIZE);
  return (
    <WmFrame size={size} bg={C.ribbonBlack}>
      <defs>
        <filter id={`${uid}-wmpart`} x="-15%" y="-20%" width="130%" height="140%">
          <feMorphology in="SourceGraphic" operator="dilate" radius="3" result="wide" />
          <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="4" seed={19} result="noise" />
          <feComponentTransfer in="noise" result="dots">
            <feFuncA type="discrete" tableValues="0 0 0 0 1 1 0 0 0 0" />
          </feComponentTransfer>
          <feComposite in="dots" in2="wide" operator="in" result="od" />
          <feFlood floodColor={C.cassetteOrange} floodOpacity="0.5" result="c" />
          <feComposite in="c" in2="od" operator="in" result="co" />
          <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" seed={23} result="n2" />
          <feComponentTransfer in="n2" result="d2">
            <feFuncA type="discrete" tableValues="0 0 1 1 1 1 1 0 0" />
          </feComponentTransfer>
          <feComposite in="d2" in2="SourceGraphic" operator="in" result="id" />
          <feFlood floodColor={C.cassetteOrange} result="c2" />
          <feComposite in="c2" in2="id" operator="in" result="ci" />
          <feMerge>
            <feMergeNode in="co" />
            <feMergeNode in="ci" />
          </feMerge>
        </filter>
      </defs>
      <g filter={`url(#${uid}-wmpart)`}>
        <WmText ink={C.cassetteOrange} />
        <circle cx={wm.stemCx} cy={wm.dotCy} r={wm.dotR} fill={C.cassetteOrange} />
      </g>
    </WmFrame>
  );
}

function ParticleDot({ size, uid, restrained }: { size: number; uid: string; restrained: boolean }) {
  const s = 128;
  const r = restrained ? 12 : 24;
  return (
    <DotFrame size={size} bg={C.ribbonBlack}>
      <defs>
        <filter id={`${uid}-dotpart`} x="-40%" y="-40%" width="180%" height="180%">
          <feMorphology in="SourceGraphic" operator="dilate" radius={restrained ? 2 : 8} result="w" />
          <feTurbulence type="fractalNoise" baseFrequency={restrained ? 0.12 : 0.08} numOctaves="3" seed={31} result="n" />
          <feComponentTransfer in="n" result="d">
            <feFuncA type="discrete" tableValues={restrained ? "0 0 0 0 1 0 0 0" : "0 0 0 1 1 1 0 0 0"} />
          </feComponentTransfer>
          <feComposite in="d" in2="w" operator="in" result="od" />
          <feFlood floodColor={C.cassetteOrange} floodOpacity={restrained ? 0.5 : 0.7} result="c" />
          <feComposite in="c" in2="od" operator="in" result="co" />
          <feMerge>
            <feMergeNode in="co" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx={s / 2} cy={s / 2} r={r} fill={C.cassetteOrange} filter={`url(#${uid}-dotpart)`} />
    </DotFrame>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Study renderer map
// ═══════════════════════════════════════════════════════════════════════════════

type Renderer = (props: { size: number; uid: string }) => ReactNode;
type DotRenderer = (props: { size: number; uid: string; restrained: boolean }) => ReactNode;

const RENDERERS: Record<string, { glyph: Renderer; wm: Renderer; dot: DotRenderer }> = {
  phosphor: { glyph: PhosphorGlyph, wm: PhosphorWm, dot: PhosphorDot },
  "dot-matrix": { glyph: DotMatrixGlyph, wm: DotMatrixWm, dot: DotMatrixDot },
  pixel: { glyph: PixelGlyph, wm: PixelWm, dot: PixelDot },
  halftone: { glyph: HalftoneGlyph, wm: HalftoneWm, dot: HalftoneDot },
  letterpress: { glyph: LetterpressGlyph, wm: LetterpressWm, dot: LetterPressDot },
  etched: { glyph: EtchedGlyph, wm: EtchedWm, dot: EtchedDot },
  chrome: { glyph: ChromeGlyph, wm: ChromeWm, dot: ChromeDot },
  particle: { glyph: ParticleGlyph, wm: ParticleWm, dot: ParticleDot },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Gallery layout
// ═══════════════════════════════════════════════════════════════════════════════

const SCALES = [32, 64, 128, 256, 512];

function StudySection({ study, scale, light }: { study: Study; scale: number; light: boolean }) {
  const renderer = RENDERERS[study.id];
  if (!renderer) return null;
  const Glyph = renderer.glyph;
  const Wm = renderer.wm;
  const Dot = renderer.dot;
  const uid = study.id;

  return (
    <section style={{ marginBottom: 48 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: light ? C.ribbonBlack : C.studioCream, margin: 0 }}>
          {study.name}
        </h2>
        <p style={{ fontSize: 12, color: light ? C.tapeTan : C.graphite, margin: "4px 0 0", lineHeight: 1.5 }}>
          {study.desc}
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, alignItems: "start" }}>
        {/* A: Single-letter t */}
        <div>
          <div style={{ fontSize: 10, color: light ? C.tapeTan : C.graphite, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>A · Letter</div>
          <Glyph size={scale} uid={`${uid}-g`} />
        </div>
        {/* B: Wordmark */}
        <div>
          <div style={{ fontSize: 10, color: light ? C.tapeTan : C.graphite, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>B · Wordmark</div>
          <Wm size={scale} uid={`${uid}-wm`} />
        </div>
        {/* C: Playful dot */}
        <div>
          <div style={{ fontSize: 10, color: light ? C.tapeTan : C.graphite, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>C · Dot (playful)</div>
          <Dot size={scale} uid={`${uid}-dp`} restrained={false} />
        </div>
        {/* D: Restrained dot */}
        <div>
          <div style={{ fontSize: 10, color: light ? C.tapeTan : C.graphite, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>D · Dot (restrained)</div>
          <Dot size={scale} uid={`${uid}-dr`} restrained={true} />
        </div>
      </div>
      <div style={{ fontSize: 10, color: light ? C.borderDark : C.borderDark, marginTop: 8, fontStyle: "italic" }}>
        {study.technique}
      </div>
    </section>
  );
}

export default function TalkieTexturesPage() {
  const [scale, setScale] = useState(256);
  const [legibility, setLegibility] = useState(false);
  const [light, setLight] = useState(false);

  const displayScale = legibility ? 40 : scale;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: light ? C.studioCream : C.ribbonBlack,
        color: light ? C.ribbonBlack : C.studioCream,
        fontFamily: FONT,
        padding: "48px 56px",
        transition: "background 0.3s, color 0.3s",
      }}
    >
      {/* Header */}
      <header style={{ marginBottom: 48 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0, letterSpacing: "-0.02em" }}>
          Texture studies
        </h1>
        <p style={{ fontSize: 13, color: light ? C.tapeTan : C.graphite, margin: "8px 0 0", maxWidth: 560 }}>
          Round 3 — surface treatments and material studies on the locked t glyph and talkie wordmark.
          Eight directions: phosphor, dot-matrix, pixel, halftone, letterpress, etched, brass, particle.
        </p>
      </header>

      {/* Controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          marginBottom: 40,
          padding: "12px 16px",
          background: light ? "rgba(14,13,10,0.04)" : "rgba(244,239,230,0.04)",
          borderRadius: 8,
          fontSize: 12,
        }}
      >
        {/* Scale selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: light ? C.tapeTan : C.graphite }}>Scale</span>
          {SCALES.map((s) => (
            <button
              key={s}
              onClick={() => { setScale(s); setLegibility(false); }}
              style={{
                padding: "4px 10px",
                borderRadius: 4,
                border: "none",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: scale === s && !legibility ? 600 : 400,
                background: scale === s && !legibility ? (light ? C.ribbonBlack : C.studioCream) : "transparent",
                color: scale === s && !legibility ? (light ? C.studioCream : C.ribbonBlack) : (light ? C.ribbonBlack : C.studioCream),
                fontFamily: FONT,
              }}
            >
              {s}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 20, background: light ? C.borderDark : C.borderDark }} />

        {/* Legibility test */}
        <button
          onClick={() => setLegibility(!legibility)}
          style={{
            padding: "4px 12px",
            borderRadius: 4,
            border: "none",
            cursor: "pointer",
            fontSize: 11,
            fontWeight: legibility ? 600 : 400,
            background: legibility ? C.hotMic : "transparent",
            color: legibility ? "white" : (light ? C.ribbonBlack : C.studioCream),
            fontFamily: FONT,
          }}
        >
          Legibility (40px)
        </button>

        <div style={{ width: 1, height: 20, background: light ? C.borderDark : C.borderDark }} />

        {/* Light mode toggle */}
        <button
          onClick={() => setLight(!light)}
          style={{
            padding: "4px 12px",
            borderRadius: 4,
            border: "none",
            cursor: "pointer",
            fontSize: 11,
            background: "transparent",
            color: light ? C.ribbonBlack : C.studioCream,
            fontFamily: FONT,
          }}
        >
          {light ? "Dark mode" : "Light mode"}
        </button>
      </div>

      {/* Studies grid */}
      <div>
        {STUDIES.map((study) => (
          <StudySection key={study.id} study={study} scale={displayScale} light={light} />
        ))}
      </div>

      {/* Footer */}
      <footer
        style={{
          marginTop: 64,
          paddingTop: 24,
          borderTop: `1px solid ${C.borderHairline}`,
          fontSize: 11,
          color: light ? C.tapeTan : C.borderDark,
          lineHeight: 1.7,
        }}
      >
        <p style={{ margin: 0 }}>
          Glyph geometry: cellCenter 0.31 · stemWidth 0.08 · crossY 0.469 · fontSize {GS}×0.78 · baseline {GS}×0.86 · JBM Medium 500w.
          Wordmark: {WM_SIZE}px ref size, per-letter advances [600 600 600 600 340 600], kern lk +24.
          All effects are pure SVG filter/pattern/mask — no raster dependencies.
        </p>
        <p style={{ margin: "8px 0 0" }}>
          1 Phosphor: feGaussianBlur bloom ×3 + scanline pattern · 2 Dot-matrix: circle pattern mask + unlit grid ·
          3 Pixel: rect pattern mask (48px cells, 4px gap) · 4 Halftone: dual circle-pattern layers + xy misregistration ·
          5 Letterpress: feTurbulence fractalNoise + feMorphology dilate + feOffset shadow ·
          6 Etched: dual-angle line pattern fills + text clipPath ·
          7 Brass: 7-stop linearGradient + feSpecularLighting + fePointLight ·
          8 Particle: feTurbulence threshold + feMorphology dilate region + feComposite mask
        </p>
      </footer>
    </div>
  );
}

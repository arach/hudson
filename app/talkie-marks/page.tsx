"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// Talkie marks — Round 1 (3 directions) + Round 2 (D1 parametric push)
//
// Briefs:
//   Round 1: /Users/arach/dev/narrative-studio/docs/specs/talkie-mark-hudson-round.md
//   Round 2: /Users/arach/dev/narrative-studio/docs/specs/talkie-mark-hudson-round-2.md
// Brand: BRAND.md in /Users/arach/dev/talkie/docs/
//
// Round 1 outcome:
//   D1 · Geometric / monogram T   — landed; carried forward into Round 2
//   D2 · T + waveform             — killed
//   D3 · Wave-motion (no T)       — killed
//
// Round 2 refines D1 into a parametric template (`talkie-d1-stencil`) in
// the Logo Studio template store, with axes for beam radius, symmetry
// mode, and a construction-vocabulary flanking decoration slot. Below D3,
// a permutation sweep of 10 curated corners of the parameter space.
// ═══════════════════════════════════════════════════════════════════════════════

import type { CSSProperties, ReactNode } from "react";

// ─── Brand tokens (mirrored from narrative-studio tokens.ts) ─────────────────
const C = {
  studioCream: "#F4EFE6",
  ribbonBlack: "#0E0D0A",
  hotMic: "#FF5346",
  cassetteOrange: "#E68A3C",
  cautionYellow: "#E8C547",
  tapeTan: "#7A6E5C",
  graphite: "#B8B2A4",
  surfaceDark: "#1A1813",
  borderHairline: "#23201a",
  borderDark: "#3A372F",
} as const;

const TALKIE_FONT = `"Talkie Medium", "JetBrains Mono", ui-monospace, monospace`;
const MONO_FONT = `var(--font-jetbrains-mono), ui-monospace, monospace`;

// ═══════════════════════════════════════════════════════════════════════════════
// MARK 1 · Geometric / monogram T (stencil construction)
// ─────────────────────────────────────────────────────────────────────────────
// 8-unit grid (cell = 128 of 1024). Capital T construction:
//   Cap bar: 8u × 1.4u at top, with optical chamfers (0.2u inset corners)
//   Stem:    1.4u × 5.8u, centered horizontally
//   Stencil break: 0.16u hairline gap where cap meets stem (top of stem)
// Monochrome by construction. Reads at 16pt as a capital T silhouette.
// ═══════════════════════════════════════════════════════════════════════════════

function GeometricT({ size, ink, showGrid = false }: { size: number; ink: string; showGrid?: boolean }) {
  const vb = 1024;
  const u = vb / 8;            // 128 — grid cell
  const capW = 6 * u;          // 768
  const capH = 1.4 * u;        // 179.2
  const stemW = 1.4 * u;       // 179.2
  const stemH = 5.8 * u;       // 742.4
  const margin = (vb - capW) / 2; // 128
  const capX = margin;
  const capY = margin;
  const stemX = (vb - stemW) / 2;
  const stemY = capY + capH + 0.18 * u; // hairline stencil break
  const chamfer = 0.16 * u;

  // Cap bar with optical chamfers on outer ends (stencil look)
  const capPath = `
    M ${capX + chamfer} ${capY}
    L ${capX + capW - chamfer} ${capY}
    L ${capX + capW} ${capY + chamfer}
    L ${capX + capW} ${capY + capH - chamfer}
    L ${capX + capW - chamfer} ${capY + capH}
    L ${capX + chamfer} ${capY + capH}
    L ${capX} ${capY + capH - chamfer}
    L ${capX} ${capY + chamfer}
    Z
  `;

  return (
    <svg viewBox={`0 0 ${vb} ${vb}`} width={size} height={size} style={{ display: "block" }}>
      {showGrid && (
        <g stroke={ink} strokeWidth={1} opacity={0.12}>
          {Array.from({ length: 9 }).map((_, i) => (
            <line key={`v${i}`} x1={i * u} y1={0} x2={i * u} y2={vb} />
          ))}
          {Array.from({ length: 9 }).map((_, i) => (
            <line key={`h${i}`} x1={0} y1={i * u} x2={vb} y2={i * u} />
          ))}
        </g>
      )}
      <path d={capPath} fill={ink} />
      <rect x={stemX} y={stemY} width={stemW} height={stemH} fill={ink} />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARK 2 · T + waveform (integrated)
// ─────────────────────────────────────────────────────────────────────────────
// Capital T silhouette:
//   Stem stays clean — straight vertical rectangle.
//   Crossbar replaced by an oscilloscope/seismograph trace: flat baseline →
//   asymmetric peak above stem → decay → flat baseline. Trace stroke matches
//   stem width (so it reads as a "wave-cap" at small sizes).
// At 16pt the trace simplifies to a horizontal line — pure T silhouette.
// At 64pt+ the wave envelope reveals itself.
// ═══════════════════════════════════════════════════════════════════════════════

function WaveT({ size, ink, accent }: { size: number; ink: string; accent?: string }) {
  const vb = 1024;
  const u = vb / 8;
  const stemW = 1.4 * u;
  const stemH = 5.8 * u;
  const traceY = 1.5 * u;       // vertical center of the cap zone
  const stemX = (vb - stemW) / 2;
  const stemY = traceY + 0.5 * u; // stem joins just below trace baseline
  const traceStroke = stemW * 0.78;
  const baselineL = 1 * u;
  const baselineR = 7 * u;

  // Asymmetric oscilloscope peak — attack sharp, decay slow
  // Peak centered above the stem at (vb/2)
  const peakX = vb / 2;
  const peakTop = traceY - 0.95 * u;
  const peakWidthLeft = 0.95 * u;
  const peakWidthRight = 1.85 * u;
  const undershootX = peakX + 2.6 * u;
  const undershootY = traceY + 0.32 * u;

  const trace = `
    M ${baselineL} ${traceY}
    L ${peakX - peakWidthLeft - 0.3 * u} ${traceY}
    L ${peakX - 0.05 * u} ${peakTop}
    L ${peakX + 0.1 * u} ${peakTop + 0.05 * u}
    Q ${peakX + peakWidthRight * 0.4} ${traceY - 0.2 * u}, ${undershootX} ${undershootY}
    Q ${undershootX + 0.4 * u} ${traceY - 0.08 * u}, ${undershootX + 0.9 * u} ${traceY}
    L ${baselineR} ${traceY}
  `;

  return (
    <svg viewBox={`0 0 ${vb} ${vb}`} width={size} height={size} style={{ display: "block" }}>
      {/* Stem */}
      <rect x={stemX} y={stemY} width={stemW} height={stemH} fill={ink} />
      {/* Wave-cap trace (replaces cross-bar) */}
      <path
        d={trace}
        fill="none"
        stroke={ink}
        strokeWidth={traceStroke}
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      {/* Optional accent: a single inflection tick — only visible at larger sizes */}
      {accent && size >= 96 && (
        <circle cx={peakX - 0.05 * u} cy={peakTop} r={traceStroke * 0.35} fill={accent} />
      )}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARK 3 · Wave-motion (no T)
// ─────────────────────────────────────────────────────────────────────────────
// A sealed utterance cell. Horizontal rounded-rect frame (hardware feel),
// containing a continuous trace from flat baseline → asymmetric attack/decay
// peak → flat baseline. The frame itself is the brand — a single moment of
// voice captured into a discrete piece of equipment.
//
// Frame aspect: 5:3 horizontal. Filled trace below the curve gives a "level
// meter" reading at small sizes; the trace alone shows at large sizes.
// ═══════════════════════════════════════════════════════════════════════════════

function UtteranceCell({ size, ink, showTrace = "stroke" }: { size: number; ink: string; showTrace?: "stroke" | "fill" }) {
  const vb = 1024;
  // 5:3 horizontal cell centered on the canvas
  const cellW = 768;
  const cellH = 460;
  const cellX = (vb - cellW) / 2;
  const cellY = (vb - cellH) / 2;
  const cornerR = cellH * 0.14;
  const pad = cellH * 0.16;
  const baseline = cellY + cellH - pad;
  const left = cellX + pad;
  const right = cellX + cellW - pad;
  const peakX = cellX + cellW * 0.42;
  const peakY = cellY + pad * 1.1;
  // Quiescent "before" portion sits a touch below true baseline to feel like ambient noise
  const ambientY = baseline - cellH * 0.04;

  // Trace: ambient floor → sharp asymmetric attack → smooth decay → ambient floor
  const trace = `
    M ${left} ${ambientY}
    L ${peakX - cellW * 0.16} ${ambientY}
    L ${peakX - cellW * 0.02} ${peakY}
    L ${peakX + cellW * 0.02} ${peakY + cellH * 0.02}
    Q ${peakX + cellW * 0.1} ${peakY + cellH * 0.18},
      ${peakX + cellW * 0.2} ${ambientY - cellH * 0.04}
    Q ${peakX + cellW * 0.26} ${ambientY + cellH * 0.01},
      ${peakX + cellW * 0.34} ${ambientY}
    L ${right} ${ambientY}
  `;

  // Filled variant — closes the path down to baseline for a level-meter feel
  const traceFill = `
    ${trace}
    L ${right} ${baseline}
    L ${left} ${baseline}
    Z
  `;

  const strokeW = cellH * 0.06;
  return (
    <svg viewBox={`0 0 ${vb} ${vb}`} width={size} height={size} style={{ display: "block" }}>
      {/* Sealed cell — hairline frame */}
      <rect
        x={cellX}
        y={cellY}
        width={cellW}
        height={cellH}
        rx={cornerR}
        ry={cornerR}
        fill="none"
        stroke={ink}
        strokeWidth={strokeW * 0.85}
      />
      {/* Inner trace */}
      {showTrace === "fill" ? (
        <path d={traceFill} fill={ink} opacity={0.92} />
      ) : (
        <path d={trace} fill="none" stroke={ink} strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Format ladder — 16 / 64 / 256 / 1024 (rendered at smaller display sizes for layout)
// ═══════════════════════════════════════════════════════════════════════════════

const LADDER_SIZES = [16, 64, 256, 1024] as const;
const LADDER_DISPLAY = { 16: 16, 64: 64, 256: 128, 1024: 192 } as const;

function FormatLadder({
  render,
  ink,
  bg,
}: {
  render: (size: number) => ReactNode;
  ink: string;
  bg: string;
}) {
  return (
    <div style={{ display: "flex", gap: 28, alignItems: "flex-end", flexWrap: "wrap" }}>
      {LADDER_SIZES.map((s) => {
        const d = LADDER_DISPLAY[s];
        return (
          <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div
              style={{
                background: bg,
                padding: s <= 16 ? 4 : s <= 64 ? 8 : 14,
                borderRadius: 4,
                border: `1px solid ${C.borderHairline}`,
                display: "grid",
                placeItems: "center",
                width: d + (s <= 16 ? 8 : s <= 64 ? 16 : 28),
                height: d + (s <= 16 ? 8 : s <= 64 ? 16 : 28),
              }}
            >
              {render(d)}
            </div>
            <span style={{ fontFamily: MONO_FONT, fontSize: 10, color: C.graphite, letterSpacing: 0.5 }}>{s}px</span>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// App icon — rounded square with the mark, optional inner shadow
// ═══════════════════════════════════════════════════════════════════════════════

function AppIcon({ render, bg, label }: { render: (size: number) => ReactNode; bg: string; label: string }) {
  const dim = 168;
  const r = Math.round(dim * 0.225);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div
        style={{
          width: dim,
          height: dim,
          borderRadius: r,
          background: bg,
          display: "grid",
          placeItems: "center",
          boxShadow: `inset 0 1px 0 ${C.borderDark}, 0 24px 48px -16px rgba(0,0,0,.55)`,
          border: `1px solid ${C.borderHairline}`,
        }}
      >
        {render(Math.round(dim * 0.74))}
      </div>
      <span style={{ fontFamily: MONO_FONT, fontSize: 10, color: C.graphite, letterSpacing: 0.5 }}>{label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Wordmark lockup — mark + "Talkie" in Talkie Medium
// ═══════════════════════════════════════════════════════════════════════════════

function WordmarkLockup({
  render,
  ink,
  bg,
  markSize = 56,
  text = "talkie",
}: {
  render: (size: number, ink: string) => ReactNode;
  ink: string;
  bg: string;
  markSize?: number;
  text?: string;
}) {
  return (
    <div
      style={{
        background: bg,
        padding: "28px 36px",
        borderRadius: 6,
        border: `1px solid ${C.borderHairline}`,
        display: "flex",
        alignItems: "center",
        gap: 18,
      }}
    >
      <div style={{ display: "grid", placeItems: "center" }}>{render(markSize, ink)}</div>
      <span
        style={{
          fontFamily: TALKIE_FONT,
          fontSize: 56,
          fontWeight: 500,
          color: ink,
          lineHeight: 1,
          letterSpacing: 0,
        }}
      >
        {text}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Direction section
// ═══════════════════════════════════════════════════════════════════════════════

function DirectionSection({
  number,
  title,
  claim,
  rationale,
  render,
  appIconRender,
  notes,
}: {
  number: string;
  title: string;
  claim: string;
  rationale: ReactNode;
  render: (size: number, ink?: string) => ReactNode;
  appIconRender?: (size: number) => ReactNode;
  notes?: string;
}) {
  const ink = C.studioCream;
  const bg = C.ribbonBlack;
  return (
    <section
      style={{
        padding: "56px 0",
        borderTop: `1px solid ${C.borderHairline}`,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 8 }}>
        <span
          style={{
            fontFamily: MONO_FONT,
            fontSize: 11,
            color: C.tapeTan,
            letterSpacing: 1.5,
            fontWeight: 500,
          }}
        >
          {number}
        </span>
        <h2
          style={{
            fontFamily: MONO_FONT,
            fontSize: 22,
            color: C.studioCream,
            fontWeight: 500,
            margin: 0,
            letterSpacing: -0.2,
          }}
        >
          {title}
        </h2>
      </div>
      <p
        style={{
          fontFamily: MONO_FONT,
          fontSize: 13,
          color: C.graphite,
          margin: "0 0 36px",
          maxWidth: 720,
          lineHeight: 1.6,
        }}
      >
        {claim}
      </p>

      {/* Format ladder */}
      <div style={{ marginBottom: 36 }}>
        <SectionLabel>format ladder · 16 / 64 / 256 / 1024 · monochrome</SectionLabel>
        <FormatLadder render={(s) => render(s, ink)} ink={ink} bg={bg} />
      </div>

      {/* App icon + Wordmark lockup, side by side */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 56, alignItems: "flex-start", marginBottom: 36 }}>
        <div>
          <SectionLabel>app icon · macOS / iOS squircle</SectionLabel>
          <div style={{ display: "flex", gap: 18 }}>
            <AppIcon render={appIconRender ?? ((s) => render(s, ink))} bg={C.ribbonBlack} label="canonical" />
            <AppIcon render={appIconRender ?? ((s) => render(s, C.ribbonBlack))} bg={C.studioCream} label="inverted" />
          </div>
        </div>
        <div>
          <SectionLabel>wordmark lockup · Talkie Medium</SectionLabel>
          <WordmarkLockup render={(s, i) => render(s, i)} ink={ink} bg={bg} />
        </div>
      </div>

      {/* Rationale */}
      <div
        style={{
          maxWidth: 760,
          fontFamily: MONO_FONT,
          fontSize: 12.5,
          lineHeight: 1.65,
          color: C.graphite,
        }}
      >
        <SectionLabel>rationale</SectionLabel>
        {rationale}
        {notes && (
          <p style={{ color: C.tapeTan, marginTop: 12, fontStyle: "italic" }}>{notes}</p>
        )}
      </div>
    </section>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: MONO_FONT,
        fontSize: 10,
        color: C.tapeTan,
        letterSpacing: 1.8,
        textTransform: "uppercase",
        marginBottom: 14,
        fontWeight: 500,
      }}
    >
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUND 2 — Parametric D1 stencil
// ─────────────────────────────────────────────────────────────────────────────
// Mirrors the renderBody in `~/hudson/logo/.data/logo-templates/talkie-d1-stencil.js`.
// Page-side TSX duplication is intentional: the .js template is the canonical
// surface for the Logo Studio runtime; this component renders the same
// geometry inline so the exploration page stays self-contained.
// ═══════════════════════════════════════════════════════════════════════════════

type Decoration = "none" | "angle-brackets" | "corner-ticks" | "registration-crosshairs" | "set-square-corners";

interface StencilTParams {
  size: number;
  ink?: string;
  beamRadius?: number;        // shared, ×u
  symmetryMode?: "shared" | "independent";
  stemRadius?: number;        // independent, ×u
  crossRadius?: number;       // independent, ×u
  decoration?: Decoration;
  decorationScale?: number;
  decorationInk?: string;
  glyphScale?: number;
  showBackground?: boolean;
  bg?: string;
}

function StencilT({
  size,
  ink = C.studioCream,
  beamRadius = 0,
  symmetryMode = "shared",
  stemRadius = 0,
  crossRadius = 0,
  decoration = "none",
  decorationScale = 1,
  decorationInk = C.tapeTan,
  glyphScale = 0.78,
  showBackground = false,
  bg = C.ribbonBlack,
}: StencilTParams) {
  const vb = 1024;
  const gridSize = vb * glyphScale;
  const u = gridSize / 8;
  const ox = (vb - gridSize) / 2;
  const oy = (vb - gridSize) / 2;

  const capW = 6 * u;
  const capH = 1.4 * u;
  const capX = ox + 1 * u;
  const capY = oy + 1 * u;
  const chamfer = 0.16 * u;

  const stemW = 1.4 * u;
  const stemH = 5.8 * u;
  const stemX = ox + (8 * u - stemW) / 2;
  const stencilGap = 0.18 * u;
  const stemY = capY + capH + stencilGap;

  const rCrossU = symmetryMode === "independent" ? crossRadius : beamRadius;
  const rStemU = symmetryMode === "independent" ? stemRadius : beamRadius;
  const rCross = Math.min(rCrossU * u, capH * 0.45, capW * 0.05);
  const rStem = Math.min(rStemU * u, stemW * 0.45, stemH * 0.05);

  // Cap bar: outer-top corners chamfered; inner-bottom corners optionally filleted.
  const capD = (() => {
    const x1 = capX;
    const y1 = capY;
    const x2 = capX + capW;
    const y2 = capY + capH;
    const c = chamfer;
    const r = rCross;
    let d = `M ${x1 + c} ${y1} `;
    d += `L ${x2 - c} ${y1} `;
    d += `L ${x2} ${y1 + c} `;
    d += `L ${x2} ${y2 - r} `;
    d += r > 0 ? `Q ${x2} ${y2}, ${x2 - r} ${y2} ` : `L ${x2} ${y2} `;
    d += `L ${x1 + r} ${y2} `;
    d += r > 0 ? `Q ${x1} ${y2}, ${x1} ${y2 - r} ` : `L ${x1} ${y2} `;
    d += `L ${x1} ${y1 + c} Z`;
    return d;
  })();

  const stemD = (() => {
    const x1 = stemX;
    const y1 = stemY;
    const x2 = stemX + stemW;
    const y2 = stemY + stemH;
    const r = rStem;
    if (r <= 0) return `M ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2} L ${x1} ${y2} Z`;
    let d = `M ${x1 + r} ${y1} `;
    d += `L ${x2 - r} ${y1} Q ${x2} ${y1}, ${x2} ${y1 + r} `;
    d += `L ${x2} ${y2 - r} Q ${x2} ${y2}, ${x2 - r} ${y2} `;
    d += `L ${x1 + r} ${y2} Q ${x1} ${y2}, ${x1} ${y2 - r} `;
    d += `L ${x1} ${y1 + r} Q ${x1} ${y1}, ${x1 + r} ${y1} Z`;
    return d;
  })();

  const bboxL = ox + 1 * u;
  const bboxR = ox + 7 * u;
  const bboxT = oy + 1 * u;
  const bboxB = oy + 6.98 * u;
  const cx = (bboxL + bboxR) / 2;
  const cy = (bboxT + bboxB) / 2;
  const sw = Math.max(1.5, 0.06 * u * decorationScale);

  const decoElements: ReactNode[] = [];
  if (decoration === "angle-brackets") {
    const armLen = 0.5 * u * decorationScale;
    const gap = 0.35 * u;
    const dx = armLen * Math.cos(Math.PI / 4);
    const dy = armLen * Math.sin(Math.PI / 4);
    const lvx = bboxL - gap - dx;
    const rvx = bboxR + gap + dx;
    decoElements.push(
      <polyline
        key="lb"
        points={`${lvx + dx},${cy - dy} ${lvx},${cy} ${lvx + dx},${cy + dy}`}
        fill="none"
        stroke={decorationInk}
        strokeWidth={sw}
        strokeLinecap="square"
        strokeLinejoin="miter"
      />,
      <polyline
        key="rb"
        points={`${rvx - dx},${cy - dy} ${rvx},${cy} ${rvx - dx},${cy + dy}`}
        fill="none"
        stroke={decorationInk}
        strokeWidth={sw}
        strokeLinecap="square"
        strokeLinejoin="miter"
      />,
    );
  } else if (decoration === "corner-ticks") {
    const off = 0.55 * u;
    const tickLen = 0.42 * u * decorationScale;
    const corners: [number, number, 1 | -1, 1 | -1][] = [
      [bboxL - off, bboxT - off, 1, 1],
      [bboxR + off, bboxT - off, -1, 1],
      [bboxL - off, bboxB + off, 1, -1],
      [bboxR + off, bboxB + off, -1, -1],
    ];
    corners.forEach(([x, y, hx, hy], i) => {
      decoElements.push(
        <line key={`th${i}`} x1={x} y1={y} x2={x + hx * tickLen} y2={y} stroke={decorationInk} strokeWidth={sw} strokeLinecap="square" />,
        <line key={`tv${i}`} x1={x} y1={y} x2={x} y2={y + hy * tickLen} stroke={decorationInk} strokeWidth={sw} strokeLinecap="square" />,
      );
    });
  } else if (decoration === "registration-crosshairs") {
    const armLen = 0.32 * u * decorationScale;
    const offEdge = 0.6 * u;
    const pts: [number, number][] = [
      [cx, bboxT - offEdge],
      [cx, bboxB + offEdge],
      [bboxL - offEdge, cy],
      [bboxR + offEdge, cy],
    ];
    pts.forEach(([x, y], i) => {
      decoElements.push(
        <line key={`crh${i}`} x1={x - armLen} y1={y} x2={x + armLen} y2={y} stroke={decorationInk} strokeWidth={sw} strokeLinecap="square" />,
        <line key={`crv${i}`} x1={x} y1={y - armLen} x2={x} y2={y + armLen} stroke={decorationInk} strokeWidth={sw} strokeLinecap="square" />,
      );
    });
  } else if (decoration === "set-square-corners") {
    const off = 0.45 * u;
    const armLen = 0.78 * u * decorationScale;
    const corners: [number, number, 1 | -1, 1 | -1][] = [
      [bboxL - off, bboxT - off, 1, 1],
      [bboxR + off, bboxT - off, -1, 1],
      [bboxL - off, bboxB + off, 1, -1],
      [bboxR + off, bboxB + off, -1, -1],
    ];
    corners.forEach(([x, y, hx, hy], i) => {
      decoElements.push(
        <line key={`sh${i}`} x1={x} y1={y} x2={x + hx * armLen} y2={y} stroke={decorationInk} strokeWidth={sw * 1.1} strokeLinecap="square" />,
        <line key={`sv${i}`} x1={x} y1={y} x2={x} y2={y + hy * armLen} stroke={decorationInk} strokeWidth={sw * 1.1} strokeLinecap="square" />,
      );
    });
  }

  return (
    <svg viewBox={`0 0 ${vb} ${vb}`} width={size} height={size} style={{ display: "block" }}>
      {showBackground && <rect width={vb} height={vb} fill={bg} />}
      <path d={capD} fill={ink} />
      <path d={stemD} fill={ink} />
      {decoElements}
    </svg>
  );
}

// ─── Permutation table for Round 2 sweep ─────────────────────────────────────
interface Permutation {
  id: string;
  label: string;
  params: string;
  read: string;
  config: Partial<StencilTParams>;
}

const ROUND2_PERMS: Permutation[] = [
  {
    id: "P01",
    label: "Sharp baseline",
    params: "beam 0 · shared",
    read: "Round 1 D1 posture, now parametric. The zero-position.",
    config: {},
  },
  {
    id: "P02",
    label: "Subtle fillet",
    params: "beam 0.04u · shared",
    read: "Hard edges with the faintest touch off the corners. Still reads hard.",
    config: { beamRadius: 0.04 },
  },
  {
    id: "P03",
    label: "Notable fillet",
    params: "beam 0.10u · shared",
    read: "Top of range that still reads instrumental. Past this, drifts soft.",
    config: { beamRadius: 0.1 },
  },
  {
    id: "P04",
    label: "Stem sharp · cross softer",
    params: "stem 0 · cross 0.10u",
    read: "Stem carries the weight; cap reads as a held tool.",
    config: { symmetryMode: "independent", stemRadius: 0, crossRadius: 0.1 },
  },
  {
    id: "P05",
    label: "Stem softer · cross sharp",
    params: "stem 0.10u · cross 0",
    read: "Pulled foot, planted bar. Opposite stance.",
    config: { symmetryMode: "independent", stemRadius: 0.1, crossRadius: 0 },
  },
  {
    id: "P06",
    label: "Brackets · sharp",
    params: "beam 0 · `< T >`",
    read: "Drafting register, not embellishment. Strongest decoration cell.",
    config: { decoration: "angle-brackets" },
  },
  {
    id: "P07",
    label: "Brackets · fillet",
    params: "beam 0.05u · `< T >`",
    read: "Brackets hold their construction reading even with subtle softening.",
    config: { decoration: "angle-brackets", beamRadius: 0.05 },
  },
  {
    id: "P08",
    label: "Corner ticks",
    params: "beam 0 · L-ticks",
    read: "Plate-marking restraint. Smallest decoration footprint.",
    config: { decoration: "corner-ticks" },
  },
  {
    id: "P09",
    label: "Registration crosshairs",
    params: "beam 0 · `+` at cardinals",
    read: "Highest scientific-instrument reading. May overpower at small sizes.",
    config: { decoration: "registration-crosshairs" },
  },
  {
    id: "P10",
    label: "Set-square corners",
    params: "beam 0 · crop marks",
    read: "Largest decoration footprint. Assertive; closest to print-shop register.",
    config: { decoration: "set-square-corners" },
  },
];

function PermutationCell({ perm }: { perm: Permutation }) {
  const dim = 200;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: dim + 12 }}>
      <div
        style={{
          background: C.ribbonBlack,
          width: dim,
          height: dim,
          borderRadius: 6,
          border: `1px solid ${C.borderHairline}`,
          display: "grid",
          placeItems: "center",
        }}
      >
        <StencilT size={dim - 16} ink={C.studioCream} {...perm.config} />
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontFamily: MONO_FONT, fontSize: 10, color: C.tapeTan, letterSpacing: 1, fontWeight: 500 }}>
          {perm.id}
        </span>
        <span style={{ fontFamily: MONO_FONT, fontSize: 12, color: C.studioCream }}>{perm.label}</span>
      </div>
      <code
        style={{
          fontFamily: MONO_FONT,
          fontSize: 10.5,
          color: C.graphite,
          background: C.surfaceDark,
          padding: "4px 8px",
          borderRadius: 3,
          width: "fit-content",
          letterSpacing: 0.3,
        }}
      >
        {perm.params}
      </code>
      <p style={{ fontFamily: MONO_FONT, fontSize: 11, color: C.graphite, lineHeight: 1.5, margin: 0 }}>{perm.read}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════════════════

const fontFaceCss = `
@font-face {
  font-family: "Talkie Medium";
  src: url("/fonts/Talkie-Medium.ttf") format("truetype");
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}
`;

export default function TalkieMarksPage() {
  const pageStyle: CSSProperties = {
    minHeight: "100vh",
    background: C.ribbonBlack,
    color: C.studioCream,
    padding: "80px clamp(24px, 6vw, 80px)",
    fontFamily: MONO_FONT,
  };

  return (
    <main style={pageStyle}>
      <style>{fontFaceCss}</style>

      {/* ─── Header ─── */}
      <header style={{ maxWidth: 980, marginBottom: 64 }}>
        <div
          style={{
            fontFamily: MONO_FONT,
            fontSize: 11,
            color: C.tapeTan,
            letterSpacing: 1.8,
            textTransform: "uppercase",
            marginBottom: 16,
          }}
        >
          hudson · logo studio · commission · round 2 (D1 parametric push)
        </div>
        <h1
          style={{
            fontFamily: MONO_FONT,
            fontSize: 38,
            fontWeight: 500,
            margin: "0 0 16px",
            letterSpacing: -0.4,
            color: C.studioCream,
          }}
        >
          Talkie marks
        </h1>
        <p
          style={{
            maxWidth: 720,
            fontSize: 14,
            lineHeight: 1.6,
            color: C.graphite,
            margin: "0 0 24px",
          }}
        >
          Round 1 shipped three opinionated directions (D1 / D2 / D3). D1 landed; D2 and D3 were killed. Round 2 refines D1 into
          a parametric template in Logo Studio with axes for beam radius, symmetry mode, and a construction-vocabulary flanking
          slot. The Round 1 work is preserved below for context; Round 2 begins after D3.
        </p>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          {[
            { tag: "D1", verdict: "landed", color: C.studioCream },
            { tag: "D2", verdict: "killed", color: C.tapeTan },
            { tag: "D3", verdict: "killed", color: C.tapeTan },
          ].map((s) => (
            <span
              key={s.tag}
              style={{
                fontFamily: MONO_FONT,
                fontSize: 10,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                color: s.color,
                background: C.surfaceDark,
                padding: "5px 10px",
                borderRadius: 3,
                border: `1px solid ${C.borderHairline}`,
              }}
            >
              {s.tag} · {s.verdict}
            </span>
          ))}
        </div>
        <div
          style={{
            fontFamily: MONO_FONT,
            fontSize: 11,
            color: C.tapeTan,
            display: "flex",
            gap: 20,
            flexWrap: "wrap",
            paddingTop: 18,
            borderTop: `1px solid ${C.borderHairline}`,
          }}
        >
          <span>briefs: talkie-mark-hudson-round.md · -round-2.md</span>
          <span>palette: Studio Cream {C.studioCream} / Ribbon Black {C.ribbonBlack} / Hot Mic {C.hotMic}</span>
          <span>wordmark: Talkie Medium</span>
          <span>template: talkie-d1-stencil</span>
        </div>
      </header>

      {/* ─── D1 ─── */}
      <DirectionSection
        number="D1"
        title="Geometric / monogram T"
        claim="Stencil-cut capital T on an 8-unit grid. Construction is visible; metaphor is absent. System-feeling."
        render={(size, ink = C.studioCream) => <GeometricT size={size} ink={ink} />}
        rationale={
          <>
            <p>
              The mark is a capital T drawn on an 8-unit grid: cap bar 6u × 1.4u with optical chamfers at the outer corners, stem
              1.4u × 5.8u with a hairline stencil break where it meets the cap. The chamfers are the only adjustment that doesn&rsquo;t
              come from the grid — they keep the bar from reading as a brick at 64pt and below.
            </p>
            <p>
              <strong style={{ color: C.studioCream }}>The claim:</strong> Talkie can hold a mark that says nothing about voice, and the
              brand still reads. This is the most restrained option. It trades narrative for permanence — closer to a foundry mark than a
              software identity. Best home: hardware moulding, page numbers, lockup with the wordmark doing the storytelling.
            </p>
            <p>
              <strong style={{ color: C.studioCream }}>Trade-offs:</strong> No voice cue means the mark relies entirely on the wordmark
              and product context to communicate category. Strong, but quiet — may need pairing discipline so it doesn&rsquo;t drift toward
              generic.
            </p>
          </>
        }
        notes="Construction grid visible at right when viewed at 1024 — see the page's construction-detail block below D1 if useful."
      />

      {/* ─── D1 construction detail ─── */}
      <div
        style={{
          padding: "0 0 48px",
          display: "flex",
          gap: 32,
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <SectionLabel>construction grid · 8-unit</SectionLabel>
          <div
            style={{
              background: C.ribbonBlack,
              padding: 16,
              borderRadius: 6,
              border: `1px solid ${C.borderHairline}`,
            }}
          >
            <GeometricT size={240} ink={C.studioCream} showGrid />
          </div>
        </div>
        <div
          style={{
            maxWidth: 360,
            fontFamily: MONO_FONT,
            fontSize: 12,
            color: C.graphite,
            lineHeight: 1.65,
          }}
        >
          Cap bar &middot; 6u &times; 1.4u, chamfered 0.16u. Stem &middot; 1.4u &times; 5.8u, centered on column 4. Stencil break
          &middot; 0.18u between cap and stem. Margins &middot; 1u top &amp; sides, 0.8u bottom (optically lifts the bar above
          geometric center).
        </div>
      </div>

      {/* ─── D2 ─── */}
      <DirectionSection
        number="D2"
        title="T + waveform"
        claim="Stem stays still. The crossbar is replaced by an oscilloscope trace: flat baseline, sharp attack, slow decay, flat baseline. T first; voice on second look."
        render={(size, ink = C.studioCream) => <WaveT size={size} ink={ink} accent={size >= 96 ? C.hotMic : undefined} />}
        rationale={
          <>
            <p>
              The integration lives in the letterform itself: the cap bar is gone, replaced by a single asymmetric peak above a quiet
              baseline. The peak is offset (left of the stem&rsquo;s vertical axis) so the trace reads as a captured moment, not as a
              symmetric ornament. Stroke weight matches the stem so the trace and the stem are one line of equipment.
            </p>
            <p>
              <strong style={{ color: C.studioCream }}>The claim:</strong> Talkie&rsquo;s identity is voice, not assistant. The
              oscilloscope/seismograph register is the right vocabulary — instrumented, specific, observed. At 16pt the trace simplifies
              to a horizontal line, so the silhouette is still a capital T. At 64pt+ the peak resolves. The Hot Mic accent dot at the
              peak point is optional, only visible at hero scales — it ties the mark to the canonical 1.0Hz pulse without forcing color
              into small-size monochrome use.
            </p>
            <p>
              <strong style={{ color: C.studioCream }}>Trade-offs:</strong> The reveal at scale is a feature, but it costs the mark
              some impact at favicon size. The wave-cap silhouette is intentionally close to a plain T at 16px — that&rsquo;s the
              format ladder working, but it means the favicon is the least interesting expression. App icon and hero do the heavy
              lifting.
            </p>
          </>
        }
      />

      {/* ─── D3 ─── */}
      <DirectionSection
        number="D3"
        title="Wave-motion · sealed utterance cell"
        claim="No letter. A horizontal rounded-rect frame holds a continuous trace from ambient baseline through one asymmetric attack-decay envelope back to baseline. A single moment of voice rendered as equipment."
        render={(size, ink = C.studioCream) => <UtteranceCell size={size} ink={ink} showTrace={size >= 96 ? "stroke" : "fill"} />}
        appIconRender={(size) => <UtteranceCell size={size} ink={C.studioCream} showTrace="stroke" />}
        rationale={
          <>
            <p>
              At 16px the cell reads as a solid horizontal bar — a level meter, a tape segment, a piece of hardware. At 64px the trace
              resolves into a single asymmetric peak with a soft decay. At 256px and up the cell becomes equipment — a captured
              utterance in a sealed pane of glass. The aspect ratio is 5:3 horizontal, which gives the mark a different posture from
              every Talkie product surface that&rsquo;s come before (all of which have been letter-vertical).
            </p>
            <p>
              <strong style={{ color: C.studioCream }}>The claim:</strong> Talkie&rsquo;s brand vocabulary already has a frozen moment of
              voice — the 1.0Hz Hot Mic pulse. This mark makes that moment the identity. It abandons the letter, which is the wildcard
              swing. The frame edges and the rounded corners are deliberate hardware vocabulary — they pull the mark toward the
              cassette-tape/walkie-talkie register the brand has been steering into, and away from the swoosh/loop/wave cliché the
              brief warns against.
            </p>
            <p>
              <strong style={{ color: C.studioCream }}>Trade-offs:</strong> No letter means no monogram, no easy wordmark lockup
              symmetry, no &ldquo;t&rdquo; favicon. The lockup leans entirely on the cell + wordmark pairing. The horizontal aspect also breaks
              with the existing vertical t-mark conventions — that&rsquo;s the point, but it&rsquo;s also the risk. Strongest standalone, weakest
              when forced into a vertically-constrained slot (browser tab favicon will need a cropped/portrait alternate).
            </p>
          </>
        }
        notes="Filled-trace variant used at 16pt for readability; stroke variant from 64pt up."
      />

      {/* ─── Round 2 — D1 parametric push ─── */}
      <section style={{ padding: "72px 0 24px", borderTop: `2px solid ${C.studioCream}` }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 8 }}>
          <span
            style={{
              fontFamily: MONO_FONT,
              fontSize: 11,
              color: C.cassetteOrange,
              letterSpacing: 1.5,
              fontWeight: 500,
            }}
          >
            ROUND 2
          </span>
          <h2
            style={{
              fontFamily: MONO_FONT,
              fontSize: 28,
              color: C.studioCream,
              fontWeight: 500,
              margin: 0,
              letterSpacing: -0.3,
            }}
          >
            D1 parametric push
          </h2>
        </div>
        <p
          style={{
            fontFamily: MONO_FONT,
            fontSize: 13,
            color: C.graphite,
            margin: "0 0 28px",
            maxWidth: 760,
            lineHeight: 1.65,
          }}
        >
          D1&rsquo;s foundational decisions stay locked: 8-unit grid, optical chamfers on outer cap corners (0.16u), 0.18u
          stencil break between cap and stem, format ladder. Three new axes exposed: <strong style={{ color: C.studioCream }}>
          beam radius</strong> (sharp → subtle fillet, ~0–0.20u), <strong style={{ color: C.studioCream }}>symmetry mode</strong>
          {" "}(stem and crossbar share treatment, or are tuned independently), and a{" "}
          <strong style={{ color: C.studioCream }}>construction-vocabulary decoration slot</strong> (angle brackets, corner ticks,
          registration crosshairs, set-square corners — not embellishment).
        </p>

        {/* Template + axes summary */}
        <div
          style={{
            background: C.surfaceDark,
            border: `1px solid ${C.borderHairline}`,
            borderRadius: 6,
            padding: "20px 24px",
            marginBottom: 40,
            maxWidth: 880,
          }}
        >
          <SectionLabel>parametric template</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 20, rowGap: 6, fontSize: 12 }}>
            <span style={{ color: C.tapeTan }}>id</span>
            <code style={{ color: C.studioCream, fontFamily: MONO_FONT }}>talkie-d1-stencil</code>
            <span style={{ color: C.tapeTan }}>kind / parent</span>
            <code style={{ color: C.graphite, fontFamily: MONO_FONT }}>brand · parentId: t-decoration</code>
            <span style={{ color: C.tapeTan }}>file</span>
            <code style={{ color: C.graphite, fontFamily: MONO_FONT }}>~/hudson/logo/.data/logo-templates/talkie-d1-stencil.js</code>
            <span style={{ color: C.tapeTan }}>axes</span>
            <code style={{ color: C.graphite, fontFamily: MONO_FONT }}>
              beamRadius (0–0.2u) · symmetryMode (shared|independent) · stemRadius / crossRadius (0–0.2u, independent) · decoration (none|angle-brackets|corner-ticks|registration-crosshairs|set-square-corners) · decorationScale · decorationInk
            </code>
            <span style={{ color: C.tapeTan }}>defaults</span>
            <code style={{ color: C.graphite, fontFamily: MONO_FONT }}>
              beam 0 · shared · decoration none · cream on ribbonBlack
            </code>
          </div>
        </div>

        {/* Permutation sweep */}
        <SectionLabel>sweep · 10 curated permutations</SectionLabel>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 32,
            marginBottom: 40,
          }}
        >
          {ROUND2_PERMS.map((perm) => (
            <PermutationCell key={perm.id} perm={perm} />
          ))}
        </div>

        {/* The read */}
        <div
          style={{
            maxWidth: 780,
            fontFamily: MONO_FONT,
            fontSize: 12.5,
            lineHeight: 1.7,
            color: C.graphite,
            background: C.surfaceDark,
            border: `1px solid ${C.borderHairline}`,
            borderRadius: 6,
            padding: "20px 24px",
            marginBottom: 24,
          }}
        >
          <SectionLabel>the read · which corners feel strongest</SectionLabel>
          <p style={{ margin: "0 0 10px" }}>
            <strong style={{ color: C.studioCream }}>P01 (sharp baseline) and P06 (sharp + brackets) are the strongest cells.</strong>{" "}
            P01 holds the Round 1 D1 posture verbatim — proves the template can deliver the landed mark without compromise. P06 adds
            the most useful decoration: brackets read as drafting register, not embellishment, and the sharp T inside them stays the
            subject.
          </p>
          <p style={{ margin: "0 0 10px" }}>
            <strong style={{ color: C.studioCream }}>P02 (subtle fillet) is the right ceiling on radius.</strong> 0.04u is the most
            radius I&rsquo;d ship: a touch off the inner-bottom cap corners and the stem ends. Past 0.05–0.06u the mark starts
            reading soft. The brief said radius is a touch, not a posture — P02 holds that line; P03 tests it.
          </p>
          <p style={{ margin: "0 0 10px" }}>
            <strong style={{ color: C.studioCream }}>P04 (sharp stem · softer cross) is more interesting than P05.</strong> The cap
            takes the touch better than the stem — the chamfered outer corners + softened inner-bottom corners read as one
            consistent treatment, and the stem remains the structural element. P05 (softened stem) felt closer to novelty: the
            stem&rsquo;s rounded corners drift toward generic UI button.
          </p>
          <p style={{ margin: 0 }}>
            <strong style={{ color: C.studioCream }}>Decoration verdict:</strong> brackets &gt; corner ticks &gt; set-square &gt;
            crosshairs. Brackets carry the strongest construction reading and survive at 64pt. Crosshairs are visually loud and
            crowd the cap bar at smaller sizes — risk of overpowering the mark. Set-square corners feel print-shop in a useful
            way but are the largest decoration footprint; for app icon use, that probably reads as too much. Corner ticks are the
            safest default if a decoration ships at all.
          </p>
        </div>

        {/* Round 2 tensions */}
        <div
          style={{
            maxWidth: 780,
            fontFamily: MONO_FONT,
            fontSize: 12.5,
            color: C.graphite,
            lineHeight: 1.65,
          }}
        >
          <SectionLabel>round 2 tensions</SectionLabel>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li style={{ marginBottom: 8 }}>
              The TSX <code>StencilT</code> component on this page mirrors the canonical <code>.js</code> template in
              <code> ~/hudson/logo/.data/logo-templates/</code>. Duplication is intentional (page is self-contained) but the two
              must stay in sync — if the template changes, this page is dead-weight until updated. Could collapse by serving
              renders from the Logo API at build time; held off for simplicity.
            </li>
            <li style={{ marginBottom: 8 }}>
              The <code>set-square-corners</code> and <code>registration-crosshairs</code> decorations are the most novel
              additions. Both extend the brief&rsquo;s &ldquo;corner ticks, register marks, frame corners&rdquo; vocabulary, but they push
              furthest into &ldquo;is this construction or is this ornament?&rdquo;. P09 in particular crowds the cap at small sizes —
              may not survive the 16pt monochrome requirement.
            </li>
            <li>
              Beam radius applies to inner-bottom cap corners and stem corners only. Outer cap corners stay chamfered (foundational).
              If the brief wants a beam radius that also smooths the chamfer (a single &ldquo;corner treatment&rdquo; knob unifying both),
              that&rsquo;s a different model — say the word and I&rsquo;ll restructure the template.
            </li>
          </ul>
        </div>
      </section>

      {/* ─── Parallel commission · Instrumentation Viewer ─── */}
      <section style={{ padding: "72px 0 24px", borderTop: `2px solid ${C.cassetteOrange}` }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 8 }}>
          <span
            style={{
              fontFamily: MONO_FONT,
              fontSize: 11,
              color: C.cassetteOrange,
              letterSpacing: 1.5,
              fontWeight: 500,
            }}
          >
            PARALLEL COMMISSION
          </span>
          <h2
            style={{
              fontFamily: MONO_FONT,
              fontSize: 28,
              color: C.studioCream,
              fontWeight: 500,
              margin: 0,
              letterSpacing: -0.3,
            }}
          >
            Instrumentation viewer
          </h2>
        </div>
        <p
          style={{
            fontFamily: MONO_FONT,
            fontSize: 13,
            color: C.graphite,
            margin: "0 0 16px",
            maxWidth: 780,
            lineHeight: 1.65,
          }}
        >
          Separate concept space from the D1 refinement. A T mark that <strong style={{ color: C.studioCream }}>carries an
          instrument</strong> — a bordered panel with a wave inside, integrated into the letterform as embedded equipment.
          Reference register: Tektronix oscilloscope, studio rack VU, hardware meter. Brand vocabulary pulled from the Pocket
          Radio component (`_brand/pocket-radio.tsx`).
        </p>
        <p
          style={{
            fontFamily: MONO_FONT,
            fontSize: 12.5,
            color: C.tapeTan,
            margin: "0 0 28px",
            maxWidth: 780,
            lineHeight: 1.6,
            fontStyle: "italic",
          }}
        >
          <strong style={{ color: C.studioCream, fontStyle: "normal" }}>Not D2.</strong> D2 (above) turned the crossbar
          <em> into </em> a waveform — the wave consumed the letter. This concept keeps the T primary; the panel is
          <em> carried by </em> the T. The framing is brand vocabulary, not just a container.
        </p>

        {/* Template summary */}
        <div
          style={{
            background: C.surfaceDark,
            border: `1px solid ${C.borderHairline}`,
            borderRadius: 6,
            padding: "20px 24px",
            marginBottom: 40,
            maxWidth: 900,
          }}
        >
          <SectionLabel>parametric template</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 20, rowGap: 6, fontSize: 12 }}>
            <span style={{ color: C.tapeTan }}>id</span>
            <code style={{ color: C.studioCream, fontFamily: MONO_FONT }}>talkie-instrument-viewer</code>
            <span style={{ color: C.tapeTan }}>kind / parent</span>
            <code style={{ color: C.graphite, fontFamily: MONO_FONT }}>brand · parentId: t-decoration</code>
            <span style={{ color: C.tapeTan }}>file</span>
            <code style={{ color: C.graphite, fontFamily: MONO_FONT }}>~/hudson/logo/.data/logo-templates/talkie-instrument-viewer.js</code>
            <span style={{ color: C.tapeTan }}>placement</span>
            <code style={{ color: C.graphite, fontFamily: MONO_FONT }}>crossbar-inset · stem-replace · below-strip · right-float</code>
            <span style={{ color: C.tapeTan }}>chrome</span>
            <code style={{ color: C.graphite, fontFamily: MONO_FONT }}>sharp · chamfered · thin-border · thick-border · register-corners · graticule (toggle)</code>
            <span style={{ color: C.tapeTan }}>wave</span>
            <code style={{ color: C.graphite, fontFamily: MONO_FONT }}>sine · square-pulse · attack-decay · peak-hold · vu-bars · spectrum-strip</code>
            <span style={{ color: C.tapeTan }}>T treatment</span>
            <code style={{ color: C.graphite, fontFamily: MONO_FONT }}>d1-stencil (default) | simplified</code>
          </div>
        </div>

        {/* Permutation sweep — using static rasters from the parametric template */}
        <SectionLabel>sweep · 8 curated permutations</SectionLabel>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 32,
            marginBottom: 40,
          }}
        >
          {(
            [
              { id: "V01", label: "Crossbar inset · attack-decay", params: "chamfered · D1 T", img: "V01-cross-attack-cham", read: "Base reading. T is chassis; viewer is the captured envelope inside the cap bar." },
              { id: "V02", label: "Crossbar inset · VU bars", params: "register-corners · D1 T", img: "V02-cross-vu-register", read: "Discrete segments + corner ticks. Most brand-vocab consistent. Survives small sizes best." },
              { id: "V03", label: "Stem-replace · spectrum", params: "thin border · D1 T", img: "V03-stem-spectrum-thin", read: "Bars climb the stem like a level meter. T cap + foot stubs hold the letter reading." },
              { id: "V04", label: "Stem-replace · peak-hold", params: "chamfered · simplified T", img: "V04-stem-peak-cham-simplified", read: "Viewer dominates; simplified T retreats. Tests the screen-with-T-on-it risk — boundary case." },
              { id: "V05", label: "Below-strip · attack-decay", params: "sharp · D1 T", img: "V05-below-attack-sharp", read: "Readout under the equipment. T fully primary; panel reports. Lockup-shaped." },
              { id: "V06", label: "Below-strip · VU bars", params: "register-corners · D1 T", img: "V06-below-vu-register", read: "Discrete level meter under the T. Strongest lockup composition." },
              { id: "V07", label: "Right-float · sine", params: "thin border · D1 T", img: "V07-right-sine-thin", read: "Sidecar scope at upper-right. Closest to 'decoration alongside' anti-pattern — weakest cell." },
              { id: "V08", label: "Crossbar inset · square pulse", params: "thick border · D1 T", img: "V08-cross-square-thick", read: "Assertive frame, digital register. Reads as commit/transmit indicator. Loud but constructive." },
            ] as { id: string; label: string; params: string; img: string; read: string }[]
          ).map((v) => (
            <div key={v.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div
                style={{
                  background: C.ribbonBlack,
                  borderRadius: 6,
                  border: `1px solid ${C.borderHairline}`,
                  aspectRatio: "1 / 1",
                  display: "grid",
                  placeItems: "center",
                  padding: 8,
                }}
              >
                <img
                  src={`/talkie-marks-instrument/${v.img}.png`}
                  alt={v.label}
                  style={{ width: "100%", height: "100%", display: "block", objectFit: "contain", borderRadius: 4 }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontFamily: MONO_FONT, fontSize: 10, color: C.tapeTan, letterSpacing: 1, fontWeight: 500 }}>
                  {v.id}
                </span>
                <span style={{ fontFamily: MONO_FONT, fontSize: 12, color: C.studioCream }}>{v.label}</span>
              </div>
              <code
                style={{
                  fontFamily: MONO_FONT,
                  fontSize: 10.5,
                  color: C.graphite,
                  background: C.surfaceDark,
                  padding: "4px 8px",
                  borderRadius: 3,
                  width: "fit-content",
                  letterSpacing: 0.3,
                }}
              >
                {v.params}
              </code>
              <p style={{ fontFamily: MONO_FONT, fontSize: 11, color: C.graphite, lineHeight: 1.5, margin: 0 }}>{v.read}</p>
            </div>
          ))}
        </div>

        {/* The read */}
        <div
          style={{
            maxWidth: 820,
            fontFamily: MONO_FONT,
            fontSize: 12.5,
            lineHeight: 1.7,
            color: C.graphite,
            background: C.surfaceDark,
            border: `1px solid ${C.borderHairline}`,
            borderRadius: 6,
            padding: "20px 24px",
            marginBottom: 24,
          }}
        >
          <SectionLabel>the read</SectionLabel>
          <p style={{ margin: "0 0 10px" }}>
            <strong style={{ color: C.studioCream }}>Strongest placements: crossbar-inset and below-strip.</strong> The cap-as-chassis
            reading (V01, V02, V08) is the most native to the brief&rsquo;s premise — the T literally holds the instrument.
            Below-strip (V05, V06) gives the most lockup-shaped result and survives the format ladder best: at 16px the strip
            collapses to a horizontal bar reading as &ldquo;readout under T,&rdquo; recoverable. <strong style={{ color: C.studioCream }}>
            Stem-replace</strong> is interesting at hero scale (V03, V04) but breaks at small sizes — the stem disappears into
            its viewer. <strong style={{ color: C.studioCream }}>Right-float (V07)</strong> is the weakest: it drifts toward
            &ldquo;decoration alongside&rdquo; rather than &ldquo;instrument carried by,&rdquo; which is the anti-pattern the brief warns against.
          </p>
          <p style={{ margin: "0 0 10px" }}>
            <strong style={{ color: C.studioCream }}>Strongest wave shapes: VU bars and attack-decay.</strong> VU bars (V02, V06)
            are <em>specific</em> to the instrumentation register — they don&rsquo;t exist outside meter-language, so they carry the
            brand claim without ambiguity. Attack-decay (V01, V05) is the closest to the voice envelope and reads as a captured
            utterance, which ties the mark to product. Peak-hold (V04) is strong but reads as level meter, which has more
            consumer-audio history (vs studio-rack VU). Spectrum (V03), sine (V07), and square pulse (V08) all work but trade
            specificity: spectrum reads &ldquo;audio app,&rdquo; sine reads &ldquo;test signal,&rdquo; square reads &ldquo;digital event.&rdquo;
          </p>
          <p style={{ margin: 0 }}>
            <strong style={{ color: C.studioCream }}>Sibling or merge?</strong> Lean <strong style={{ color: C.studioCream }}>
            sibling for now, mergeable later.</strong> The chrome vocabulary (chamfered corners, register-corner ticks, hairline
            graticule) is intentionally compatible with the D1 stencil — same chamfer angle, same construction-vocab decoration
            slot. If the survivor is V01/V02/V06 and Round 2 D1 lands at P01/P06, the templates could collapse into a single
            <code>talkie-d1-instrument</code> with a <code>viewer: 'none' | 'crossbar' | 'below'</code> knob, gated by a
            <code>decoration === 'none'</code> requirement when the viewer is present. Not now — keep the surfaces independent
            until the D1 round and this round each pick a winner.
          </p>
        </div>

        {/* Round-specific tensions */}
        <div
          style={{
            maxWidth: 820,
            fontFamily: MONO_FONT,
            fontSize: 12.5,
            color: C.graphite,
            lineHeight: 1.65,
          }}
        >
          <SectionLabel>instrument viewer · tensions</SectionLabel>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li style={{ marginBottom: 8 }}>
              <strong style={{ color: C.studioCream }}>16px legibility.</strong> The graticule, wave detail, and register marks
              all disappear at 16px — what remains is a T with a darker rectangular cell somewhere. V01, V02, V06 still read as
              &ldquo;T with screen&rdquo; at favicon size; V03, V04, V07 collapse to ambiguous shapes. Currently the template doesn&rsquo;t
              auto-simplify at small sizes; could add a <code>compactMode</code> auto-detection on viewBox if the format ladder
              becomes a real constraint.
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong style={{ color: C.studioCream }}>Stem geometry adapts per placement.</strong> When
              <code> viewerPlacement === 'below-strip' </code>the stem shortens from 5.8u to 4.4u so the strip fits within the
              canvas margin. This is an internal accommodation, not a foundational change — but it means the T isn&rsquo;t the same
              T across placements. Could lift this into an explicit <code>stemHeight</code> knob.
            </li>
            <li>
              <strong style={{ color: C.studioCream }}>No app icon / wordmark lockup yet.</strong> Round 1 directions each
              shipped app icon + wordmark lockup. This sweep is just the mark grid, since the round is still picking placement
              and wave shape. Once a permutation is chosen, the app icon + wordmark go on top.
            </li>
          </ul>
        </div>
      </section>

      {/* ─── Footer · Round 1 tensions (resolved) ─── */}
      <section
        style={{
          marginTop: 56,
          padding: "32px 0 0",
          borderTop: `1px solid ${C.borderHairline}`,
          fontFamily: MONO_FONT,
          fontSize: 12.5,
          color: C.graphite,
          lineHeight: 1.65,
          maxWidth: 760,
        }}
      >
        <SectionLabel>round 1 tensions · resolved by Round 2 outcome</SectionLabel>
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          <li style={{ marginBottom: 8 }}>
            All three directions use the same Talkie Medium wordmark verbatim — no new wordmark drawn. If a direction feels like it&rsquo;s
            asking for its own lockup (likely D3, possibly D1 stencil-styled), happy to draw one against the locked metrics.
          </li>
          <li style={{ marginBottom: 8 }}>
            D2&rsquo;s Hot Mic accent dot at the peak is optional and only visible at large sizes — wanted to avoid forcing color into
            monochrome use. Could remove entirely; could promote to a permanent feature; could shift to Cassette Orange for the
            &ldquo;in-flight&rdquo; reading.
          </li>
          <li style={{ marginBottom: 8 }}>
            D3 abandons the letter, which contradicts the existing canonical t-mark catalog. Suggest reading D3 as a parallel mark
            (the &ldquo;sound stamp&rdquo;) for use in motion/contextual surfaces rather than a wholesale identity replacement — unless the round
            is genuinely open to the brand letting go of the letter.
          </li>
          <li>
            App icon variant is a flat squircle on canonical canvas for all three. The brief allows depth (gradient, inner shadow,
            drop shadow). Held off until direction is picked — easier to add atmosphere to a chosen mark than to subtract it from three.
          </li>
        </ul>
      </section>
    </main>
  );
}

'use client';
import type { LogoParams } from './LogoProvider';

interface Props {
  params: LogoParams;
  size: number;
}

function NegativeSpaceLogo({ params, size }: Props) {
  const { bgColor, paneColor, dimPaneColor, borderRadius, paneRadius, gapWidth, splitX, splitY, padding } = params;
  const vb = 512;
  const content = vb - padding * 2;
  const vGap = padding + content * splitX;
  const hGap = padding + content * splitY;

  const leftW = vGap - padding;
  const rightX = vGap + gapWidth;
  const rightW = vb - padding - rightX;
  const topH = hGap - padding;
  const bottomY = hGap + gapWidth;
  const bottomH = vb - padding - bottomY;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${vb} ${vb}`} width={size} height={size}>
      <rect width={vb} height={vb} rx={borderRadius} fill={bgColor} />
      {/* Left pane (full height — L vertical arm) */}
      <rect x={padding} y={padding} width={leftW} height={content} rx={paneRadius} fill={paneColor} />
      {/* Top-right pane (dimmer) */}
      <rect x={rightX} y={padding} width={rightW} height={topH} rx={paneRadius} fill={dimPaneColor} />
      {/* Bottom pane (full width — L horizontal arm) */}
      <rect x={padding} y={bottomY} width={content} height={bottomH} rx={paneRadius} fill={paneColor} />
    </svg>
  );
}

function GreenChannelLogo({ params, size }: Props) {
  const { bgColor, paneColor, channelColor, borderRadius, paneRadius, gapWidth, splitX, splitY, padding } = params;
  const vb = 512;
  const content = vb - padding * 2;
  const vGap = padding + content * splitX;
  const hGap = padding + content * splitY;
  const rightX = vGap + gapWidth;
  const rightW = vb - padding - rightX;
  const topH = hGap - padding;
  const bottomY = hGap + gapWidth;
  const bottomH = vb - padding - bottomY;
  const leftW = vGap - padding;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${vb} ${vb}`} width={size} height={size}>
      <rect width={vb} height={vb} rx={borderRadius} fill={bgColor} />
      <rect x={padding} y={padding} width={leftW} height={content} rx={paneRadius} fill={paneColor} />
      <rect x={rightX} y={padding} width={rightW} height={topH} rx={paneRadius} fill={paneColor} />
      <rect x={padding} y={bottomY} width={content} height={bottomH} rx={paneRadius} fill={paneColor} />
      {/* L channel */}
      <rect x={vGap} y={padding} width={gapWidth} height={topH} rx={2} fill={channelColor} />
      <rect x={vGap} y={hGap} width={gapWidth} height={gapWidth} rx={2} fill={channelColor} />
      <rect x={rightX} y={hGap} width={rightW} height={gapWidth} rx={2} fill={channelColor} />
    </svg>
  );
}

function GridColorLogo({ params, size }: Props) {
  const { bgColor, paneColor, dimPaneColor, borderRadius, paneRadius, gapWidth, padding } = params;
  const vb = 512;
  const content = vb - padding * 2;
  const cell = (content - gapWidth) / 2;
  const x2 = padding + cell + gapWidth;
  const y2 = padding + cell + gapWidth;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${vb} ${vb}`} width={size} height={size}>
      <rect width={vb} height={vb} rx={borderRadius} fill={bgColor} />
      <rect x={padding} y={padding} width={cell} height={cell} rx={paneRadius} fill={paneColor} />
      <rect x={x2} y={padding} width={cell} height={cell} rx={paneRadius} fill={dimPaneColor} />
      <rect x={padding} y={y2} width={cell} height={cell} rx={paneRadius} fill={paneColor} />
      <rect x={x2} y={y2} width={cell} height={cell} rx={paneRadius} fill={paneColor} />
    </svg>
  );
}

function InterlockingLogo({ params, size }: Props) {
  const { bgColor, paneColor, dimPaneColor, borderRadius, gapWidth, padding } = params;
  const vb = 512;
  const content = vb - padding * 2;
  const cell = (content - gapWidth) / 2;
  const notch = cell * 0.5;
  const arm = cell - notch;
  const x1 = padding;
  const x2 = padding + cell + gapWidth;
  const y1 = padding;
  const y2 = padding + cell + gapWidth;
  const nx = x1 + arm;
  const ny = y1 + arm;
  const nx2 = x2 + notch;
  const ny2 = y2 + notch;

  // Small window in bottom-center
  const winW = cell * 0.55;
  const winH = cell * 0.35;
  const winX = vb / 2 - winW / 2;
  const winY = y2 + cell - winH - 12;
  const winTb = 10;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${vb} ${vb}`} width={size} height={size}>
      <rect width={vb} height={vb} rx={borderRadius} fill={bgColor} />
      {/* TL: notch bottom-right */}
      <path d={`M${x1},${y1} H${x1 + cell} V${ny} H${nx} V${y1 + cell} H${x1} Z`} fill={paneColor} />
      {/* TR: notch bottom-left — filled, subtle step-down */}
      <path d={`M${x2},${y1} H${x2 + cell} V${y1 + cell} H${nx2} V${ny} H${x2} Z`}
        fill={paneColor} opacity={0.55} />
      {/* BL: notch top-right */}
      <path d={`M${x1},${y2} H${nx} V${ny2} H${x1 + cell} V${y2 + cell} H${x1} Z`} fill={paneColor} />
      {/* BR: notch top-left */}
      <path d={`M${nx2},${y2} H${x2 + cell} V${y2 + cell} H${x2} V${ny2} H${nx2} Z`} fill={paneColor} />

      {/* Small floating window — bottom center */}
      <g opacity={0.3}>
        <rect x={winX} y={winY} width={winW} height={winH} rx={6} fill={paneColor} />
        <rect x={winX} y={winY} width={winW} height={winTb} rx={6} fill="rgba(255,255,255,0.06)" />
        <rect x={winX} y={winY + winTb - 1} width={winW} height={1} fill="rgba(255,255,255,0.04)" />
        <circle cx={winX + 6} cy={winY + winTb / 2} r={1.2} fill="rgba(255,255,255,0.4)" />
        <circle cx={winX + 11} cy={winY + winTb / 2} r={1.2} fill="rgba(255,255,255,0.3)" />
        <circle cx={winX + 16} cy={winY + winTb / 2} r={1.2} fill="rgba(255,255,255,0.3)" />
        {/* content hints */}
        <rect x={winX + 6} y={winY + winTb + 6} width={winW * 0.6} height={1.5} rx={1} fill="rgba(255,255,255,0.1)" />
        <rect x={winX + 6} y={winY + winTb + 11} width={winW * 0.4} height={1.5} rx={1} fill="rgba(255,255,255,0.07)" />
      </g>
    </svg>
  );
}

function LatticeGridLogo({ params, size }: Props) {
  const { bgColor, paneColor, dimPaneColor, borderRadius, paneRadius, gapWidth, padding } = params;
  const vb = 512;
  const content = vb - padding * 2;
  const cols = 3;
  const cellSize = (content - gapWidth * (cols - 1)) / cols;

  // L-shape: left column (col===0) + bottom row (row===2)
  const isL = (col: number, row: number) => col === 0 || row === 2;

  const cells: { x: number; y: number; fill: string; o: number }[] = [];
  for (let row = 0; row < cols; row++) {
    for (let col = 0; col < cols; col++) {
      cells.push({
        x: padding + col * (cellSize + gapWidth),
        y: padding + row * (cellSize + gapWidth),
        fill: isL(col, row) ? paneColor : dimPaneColor,
        o: isL(col, row) ? 1 : 1,
      });
    }
  }

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${vb} ${vb}`} width={size} height={size}>
      <rect width={vb} height={vb} rx={borderRadius} fill={bgColor} />
      {cells.map((c, i) => (
        <rect key={i} x={c.x} y={c.y} width={cellSize} height={cellSize} rx={paneRadius} fill={c.fill} opacity={c.o} />
      ))}
    </svg>
  );
}

function AppWindowsLogo({ params, size }: Props) {
  const { bgColor, borderRadius, paneRadius, gapWidth, padding } = params;
  const vb = 512;
  const content = vb - padding * 2;
  const cell = (content - gapWidth) / 2;
  const x1 = padding;
  const y1 = padding;
  const x2 = padding + cell + gapWidth;
  const y2 = padding + cell + gapWidth;

  const tb = 14;
  const dr = 1.8;
  const dg = 5.5;
  const d0 = 8;

  // L-layer: warm neutral — lifted off bg
  const lBg = '#2c2c2e';
  const lTitle = 'rgba(255,255,255,0.10)';
  // Xcode layer: cool blue-tinted
  const xBg = '#242440';
  const xTitle = 'rgba(88,86,214,0.20)';

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${vb} ${vb}`} width={size} height={size}>
      <defs>
        <clipPath id={`aw-tl-${size}`}><rect x={x1} y={y1} width={cell} height={cell} rx={paneRadius} /></clipPath>
        <clipPath id={`aw-tr-${size}`}><rect x={x2} y={y1} width={cell} height={cell} rx={paneRadius} /></clipPath>
        <clipPath id={`aw-bl-${size}`}><rect x={x1} y={y2} width={cell} height={cell} rx={paneRadius} /></clipPath>
        <clipPath id={`aw-br-${size}`}><rect x={x2} y={y2} width={cell} height={cell} rx={paneRadius} /></clipPath>
      </defs>
      <rect width={vb} height={vb} rx={borderRadius} fill={bgColor} />

      {/* ── L LAYER ── */}

      {/* iTerm — top-left */}
      <g>
        <rect x={x1} y={y1} width={cell} height={cell} rx={paneRadius} fill={lBg} />
        <g clipPath={`url(#aw-tl-${size})`}>
          <rect x={x1} y={y1} width={cell} height={tb} fill={lTitle} />
          <line x1={x1} y1={y1 + tb} x2={x1 + cell} y2={y1 + tb} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
        </g>
        <circle cx={x1 + d0} cy={y1 + tb / 2} r={dr} fill="#ff5f57" opacity={0.8} />
        <circle cx={x1 + d0 + dg} cy={y1 + tb / 2} r={dr} fill="#ffbd2e" opacity={0.8} />
        <circle cx={x1 + d0 + dg * 2} cy={y1 + tb / 2} r={dr} fill="#28ca42" opacity={0.8} />
        {/* terminal lines */}
        <rect x={x1 + 8} y={y1 + tb + 10} width={cell * 0.55} height={3} rx={1} fill="rgba(51,199,115,0.65)" />
        <rect x={x1 + 8} y={y1 + tb + 19} width={cell * 0.35} height={3} rx={1} fill="rgba(51,199,115,0.45)" />
        <rect x={x1 + 8} y={y1 + tb + 28} width={cell * 0.65} height={3} rx={1} fill="rgba(51,199,115,0.35)" />
        <rect x={x1 + 8} y={y1 + tb + 37} width={cell * 0.45} height={3} rx={1} fill="rgba(51,199,115,0.5)" />
        <rect x={x1 + 8} y={y1 + tb + 46} width={cell * 0.5} height={3} rx={1} fill="rgba(51,199,115,0.4)" />
      </g>

      {/* Preview — bottom-left */}
      <g>
        <rect x={x1} y={y2} width={cell} height={cell} rx={paneRadius} fill={lBg} />
        <g clipPath={`url(#aw-bl-${size})`}>
          <rect x={x1} y={y2} width={cell} height={tb} fill={lTitle} />
          <line x1={x1} y1={y2 + tb} x2={x1 + cell} y2={y2 + tb} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
        </g>
        <circle cx={x1 + d0} cy={y2 + tb / 2} r={dr} fill="#ff5f57" opacity={0.8} />
        <circle cx={x1 + d0 + dg} cy={y2 + tb / 2} r={dr} fill="#ffbd2e" opacity={0.8} />
        <circle cx={x1 + d0 + dg * 2} cy={y2 + tb / 2} r={dr} fill="#28ca42" opacity={0.8} />
        {/* image placeholder */}
        <rect x={x1 + cell * 0.15} y={y2 + tb + cell * 0.1} width={cell * 0.7} height={cell * 0.55} rx={4} fill="rgba(255,255,255,0.08)" />
        <rect x={x1 + cell * 0.3} y={y2 + tb + cell * 0.25} width={cell * 0.4} height={cell * 0.2} rx={3} fill="rgba(255,255,255,0.12)" />
      </g>

      {/* Chrome — bottom-right */}
      <g>
        <rect x={x2} y={y2} width={cell} height={cell} rx={paneRadius} fill={lBg} />
        <g clipPath={`url(#aw-br-${size})`}>
          <rect x={x2} y={y2} width={cell} height={tb} fill={lTitle} />
          <line x1={x2} y1={y2 + tb} x2={x2 + cell} y2={y2 + tb} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
        </g>
        <circle cx={x2 + d0} cy={y2 + tb / 2} r={dr} fill="#ff5f57" opacity={0.8} />
        <circle cx={x2 + d0 + dg} cy={y2 + tb / 2} r={dr} fill="#ffbd2e" opacity={0.8} />
        <circle cx={x2 + d0 + dg * 2} cy={y2 + tb / 2} r={dr} fill="#28ca42" opacity={0.8} />
        {/* address bar */}
        <rect x={x2 + 8} y={y2 + tb + 8} width={cell - 16} height={9} rx={4.5} fill="rgba(255,255,255,0.10)" />
        {/* page content lines */}
        <rect x={x2 + 8} y={y2 + tb + 26} width={cell * 0.7} height={3} rx={1} fill="rgba(255,255,255,0.15)" />
        <rect x={x2 + 8} y={y2 + tb + 35} width={cell * 0.5} height={3} rx={1} fill="rgba(255,255,255,0.12)" />
        <rect x={x2 + 8} y={y2 + tb + 44} width={cell * 0.6} height={3} rx={1} fill="rgba(255,255,255,0.10)" />
        <rect x={x2 + 8} y={y2 + tb + 53} width={cell * 0.45} height={3} rx={1} fill="rgba(255,255,255,0.08)" />
      </g>

      {/* ── XCODE LAYER (different color) ── */}

      {/* Xcode — top-right */}
      <g>
        <rect x={x2} y={y1} width={cell} height={cell} rx={paneRadius} fill={xBg} />
        <g clipPath={`url(#aw-tr-${size})`}>
          <rect x={x2} y={y1} width={cell} height={tb} fill={xTitle} />
          <line x1={x2} y1={y1 + tb} x2={x2 + cell} y2={y1 + tb} stroke="rgba(88,86,214,0.08)" strokeWidth={0.5} />
        </g>
        <circle cx={x2 + d0} cy={y1 + tb / 2} r={dr} fill="#ff5f57" opacity={0.8} />
        <circle cx={x2 + d0 + dg} cy={y1 + tb / 2} r={dr} fill="#ffbd2e" opacity={0.8} />
        <circle cx={x2 + d0 + dg * 2} cy={y1 + tb / 2} r={dr} fill="#28ca42" opacity={0.8} />
        {/* code lines — indented structure */}
        <rect x={x2 + 8} y={y1 + tb + 10} width={cell * 0.4} height={3} rx={1} fill="rgba(120,118,240,0.55)" />
        <rect x={x2 + 16} y={y1 + tb + 19} width={cell * 0.55} height={3} rx={1} fill="rgba(120,118,240,0.35)" />
        <rect x={x2 + 16} y={y1 + tb + 28} width={cell * 0.35} height={3} rx={1} fill="rgba(120,118,240,0.40)" />
        <rect x={x2 + 24} y={y1 + tb + 37} width={cell * 0.4} height={3} rx={1} fill="rgba(120,118,240,0.30)" />
        <rect x={x2 + 16} y={y1 + tb + 46} width={cell * 0.5} height={3} rx={1} fill="rgba(120,118,240,0.35)" />
        <rect x={x2 + 8} y={y1 + tb + 55} width={cell * 0.3} height={3} rx={1} fill="rgba(120,118,240,0.50)" />
      </g>
    </svg>
  );
}

export function LogoSvg({ params, size }: Props) {
  switch (params.variant) {
    case 'negative-space': return <NegativeSpaceLogo params={params} size={size} />;
    case 'green-channel': return <GreenChannelLogo params={params} size={size} />;
    case 'grid-color': return <GridColorLogo params={params} size={size} />;
    case 'interlocking': return <InterlockingLogo params={params} size={size} />;
    case 'lattice-grid': return <LatticeGridLogo params={params} size={size} />;
    case 'app-windows': return <AppWindowsLogo params={params} size={size} />;
  }
}

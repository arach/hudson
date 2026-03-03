/**
 * Built-in template definitions.
 * Each entry has a renderBody (JS function body), name, and description.
 * Used to seed the template store on first load.
 */

export interface BuiltinDef {
  name: string;
  description: string;
  renderBody: string;
}

const negativeSpace: BuiltinDef = {
  name: 'Negative Space',
  description: 'White panes on dark bg. L-shape formed by the gap.',
  renderBody: `\
const { bgColor, paneColor, dimPaneColor, borderRadius, paneRadius, gapWidth, splitX, splitY, padding } = p;
const content = vb - padding * 2;
const vGap = padding + content * splitX;
const hGap = padding + content * splitY;
const leftW = vGap - padding;
const rightX = vGap + gapWidth;
const rightW = vb - padding - rightX;
const topH = hGap - padding;
const bottomY = hGap + gapWidth;
const bottomH = vb - padding - bottomY;

return \`<rect width="\${vb}" height="\${vb}" rx="\${borderRadius}" fill="\${bgColor}"/>
<rect x="\${padding}" y="\${padding}" width="\${leftW}" height="\${content}" rx="\${paneRadius}" fill="\${paneColor}"/>
<rect x="\${rightX}" y="\${padding}" width="\${rightW}" height="\${topH}" rx="\${paneRadius}" fill="\${dimPaneColor}"/>
<rect x="\${padding}" y="\${bottomY}" width="\${content}" height="\${bottomH}" rx="\${paneRadius}" fill="\${paneColor}"/>\`;`,
};

const greenChannel: BuiltinDef = {
  name: 'Green Channel',
  description: 'Dark panes with translucent green channel forming the L.',
  renderBody: `\
const { bgColor, paneColor, channelColor, borderRadius, paneRadius, gapWidth, splitX, splitY, padding } = p;
const content = vb - padding * 2;
const vGap = padding + content * splitX;
const hGap = padding + content * splitY;
const rightX = vGap + gapWidth;
const rightW = vb - padding - rightX;
const topH = hGap - padding;
const bottomY = hGap + gapWidth;
const bottomH = vb - padding - bottomY;
const leftW = vGap - padding;

return \`<rect width="\${vb}" height="\${vb}" rx="\${borderRadius}" fill="\${bgColor}"/>
<rect x="\${padding}" y="\${padding}" width="\${leftW}" height="\${content}" rx="\${paneRadius}" fill="\${paneColor}"/>
<rect x="\${rightX}" y="\${padding}" width="\${rightW}" height="\${topH}" rx="\${paneRadius}" fill="\${paneColor}"/>
<rect x="\${padding}" y="\${bottomY}" width="\${content}" height="\${bottomH}" rx="\${paneRadius}" fill="\${paneColor}"/>
<rect x="\${vGap}" y="\${padding}" width="\${gapWidth}" height="\${topH}" rx="2" fill="\${channelColor}"/>
<rect x="\${vGap}" y="\${hGap}" width="\${gapWidth}" height="\${gapWidth}" rx="2" fill="\${channelColor}"/>
<rect x="\${rightX}" y="\${hGap}" width="\${rightW}" height="\${gapWidth}" rx="2" fill="\${channelColor}"/>\`;`,
};

const gridColor: BuiltinDef = {
  name: 'Grid Color',
  description: '2x2 colored grid with dimmed quadrants.',
  renderBody: `\
const { bgColor, paneColor, dimPaneColor, borderRadius, paneRadius, gapWidth, padding } = p;
const content = vb - padding * 2;
const cell = (content - gapWidth) / 2;
const x2 = padding + cell + gapWidth;
const y2 = padding + cell + gapWidth;

return \`<rect width="\${vb}" height="\${vb}" rx="\${borderRadius}" fill="\${bgColor}"/>
<rect x="\${padding}" y="\${padding}" width="\${cell}" height="\${cell}" rx="\${paneRadius}" fill="\${paneColor}"/>
<rect x="\${x2}" y="\${padding}" width="\${cell}" height="\${cell}" rx="\${paneRadius}" fill="\${dimPaneColor}"/>
<rect x="\${padding}" y="\${y2}" width="\${cell}" height="\${cell}" rx="\${paneRadius}" fill="\${paneColor}"/>
<rect x="\${x2}" y="\${y2}" width="\${cell}" height="\${cell}" rx="\${paneRadius}" fill="\${paneColor}"/>\`;`,
};

const interlocking: BuiltinDef = {
  name: 'Interlocking',
  description: 'Two interlocking L-shaped pieces.',
  renderBody: `\
const { bgColor, paneColor, borderRadius, gapWidth, padding } = p;
const content = vb - padding * 2;
const cell = (content - gapWidth) / 2;
const notch = cell * 0.5;
const arm = cell - notch;
const x1 = padding, x2 = padding + cell + gapWidth;
const y1 = padding, y2 = padding + cell + gapWidth;
const nx = x1 + arm, ny = y1 + arm;
const nx2 = x2 + notch, ny2 = y2 + notch;

return \`<rect width="\${vb}" height="\${vb}" rx="\${borderRadius}" fill="\${bgColor}"/>
<path d="M\${x1},\${y1} H\${x1+cell} V\${ny} H\${nx} V\${y1+cell} H\${x1} Z" fill="\${paneColor}"/>
<path d="M\${x2},\${y1} H\${x2+cell} V\${y1+cell} H\${nx2} V\${ny} H\${x2} Z" fill="\${paneColor}" opacity="0.55"/>
<path d="M\${x1},\${y2} H\${nx} V\${ny2} H\${x1+cell} V\${y2+cell} H\${x1} Z" fill="\${paneColor}"/>
<path d="M\${nx2},\${y2} H\${x2+cell} V\${y2+cell} H\${x2} V\${ny2} H\${nx2} Z" fill="\${paneColor}"/>\`;`,
};

const latticeGrid: BuiltinDef = {
  name: 'Lattice Grid',
  description: '3x3 grid. L highlighted by color. Most versatile.',
  renderBody: `\
const { bgColor, paneColor, dimPaneColor, borderRadius, paneRadius, gapWidth, padding } = p;
const content = vb - padding * 2;
const cols = 3;
const cellSize = (content - gapWidth * (cols - 1)) / cols;
const isL = (col, row) => col === 0 || row === 2;

let svg = \`<rect width="\${vb}" height="\${vb}" rx="\${borderRadius}" fill="\${bgColor}"/>\`;
for (let row = 0; row < cols; row++) {
  for (let col = 0; col < cols; col++) {
    const x = padding + col * (cellSize + gapWidth);
    const y = padding + row * (cellSize + gapWidth);
    const fill = isL(col, row) ? paneColor : dimPaneColor;
    svg += \`<rect x="\${x}" y="\${y}" width="\${cellSize}" height="\${cellSize}" rx="\${paneRadius}" fill="\${fill}"/>\`;
  }
}
return svg;`,
};

const appWindows: BuiltinDef = {
  name: 'App Windows',
  description: 'Four panes styled as macOS app windows forming L.',
  renderBody: `\
const { bgColor, borderRadius, paneRadius, gapWidth, padding } = p;
const content = vb - padding * 2;
const cell = (content - gapWidth) / 2;
const x1 = padding, y1 = padding;
const x2 = padding + cell + gapWidth, y2 = padding + cell + gapWidth;
const tb = 14, dr = 1.8, dg = 5.5, d0 = 8;
const lBg = '#2c2c2e', lTitle = 'rgba(255,255,255,0.10)';
const xBg = '#242440', xTitle = 'rgba(88,86,214,0.20)';
const uid = Math.random().toString(36).slice(2, 6);

function dots(cx, cy) {
  return \`<circle cx="\${cx+d0}" cy="\${cy}" r="\${dr}" fill="#ff5f57" opacity="0.8"/>
<circle cx="\${cx+d0+dg}" cy="\${cy}" r="\${dr}" fill="#ffbd2e" opacity="0.8"/>
<circle cx="\${cx+d0+dg*2}" cy="\${cy}" r="\${dr}" fill="#28ca42" opacity="0.8"/>\`;
}

function win(wx, wy, bg, titleFill, clipId, contentSvg) {
  return \`<g>
<rect x="\${wx}" y="\${wy}" width="\${cell}" height="\${cell}" rx="\${paneRadius}" fill="\${bg}"/>
<defs><clipPath id="\${clipId}"><rect x="\${wx}" y="\${wy}" width="\${cell}" height="\${cell}" rx="\${paneRadius}"/></clipPath></defs>
<g clip-path="url(#\${clipId})">
  <rect x="\${wx}" y="\${wy}" width="\${cell}" height="\${tb}" fill="\${titleFill}"/>
  <line x1="\${wx}" y1="\${wy+tb}" x2="\${wx+cell}" y2="\${wy+tb}" stroke="rgba(255,255,255,0.04)" stroke-width="0.5"/>
</g>
\${dots(wx, wy+tb/2)}
\${contentSvg}
</g>\`;
}

const iterm = Array.from({length:5}, (_,i) => {
  const widths = [0.55,0.35,0.65,0.45,0.5];
  const ops = [0.65,0.45,0.35,0.5,0.4];
  return \`<rect x="\${x1+8}" y="\${y1+tb+10+i*9}" width="\${cell*widths[i]}" height="3" rx="1" fill="rgba(51,199,115,\${ops[i]})"/>\`;
}).join('');

const preview = \`<rect x="\${x1+cell*0.15}" y="\${y2+tb+cell*0.1}" width="\${cell*0.7}" height="\${cell*0.55}" rx="4" fill="rgba(255,255,255,0.08)"/>
<rect x="\${x1+cell*0.3}" y="\${y2+tb+cell*0.25}" width="\${cell*0.4}" height="\${cell*0.2}" rx="3" fill="rgba(255,255,255,0.12)"/>\`;

const chrome = \`<rect x="\${x2+8}" y="\${y2+tb+8}" width="\${cell-16}" height="9" rx="4.5" fill="rgba(255,255,255,0.10)"/>
\${[0.7,0.5,0.6,0.45].map((w,i) => \`<rect x="\${x2+8}" y="\${y2+tb+26+i*9}" width="\${cell*w}" height="3" rx="1" fill="rgba(255,255,255,\${0.15-i*0.02})"/>\`).join('')}\`;

const xcode = [0.4,0.55,0.35,0.4,0.5,0.3].map((w,i) => {
  const indent = [8,16,16,24,16,8][i];
  const ops = [0.55,0.35,0.40,0.30,0.35,0.50][i];
  return \`<rect x="\${x2+indent}" y="\${y1+tb+10+i*9}" width="\${cell*w}" height="3" rx="1" fill="rgba(120,118,240,\${ops})"/>\`;
}).join('');

return \`<rect width="\${vb}" height="\${vb}" rx="\${borderRadius}" fill="\${bgColor}"/>
\${win(x1,y1,lBg,lTitle,'aw-tl-'+uid,iterm)}
\${win(x1,y2,lBg,lTitle,'aw-bl-'+uid,preview)}
\${win(x2,y2,lBg,lTitle,'aw-br-'+uid,chrome)}
\${win(x2,y1,xBg,xTitle,'aw-tr-'+uid,xcode)}\`;`,
};

const dotMatrix: BuiltinDef = {
  name: 'Dot Matrix',
  description: 'Dense stippled dot grid. L-shape emerges from brightness with scattered color accents.',
  renderBody: `\
const { bgColor, paneColor, dimPaneColor, borderRadius, splitX, splitY, padding } = p;
const content = vb - padding * 2;
const step = 12;
const base = 2.2;
const cols = Math.floor(content / step) + 1;
const rows = Math.floor(content / step) + 1;
const ox = padding + (content - (cols - 1) * step) / 2;
const oy = padding + (content - (rows - 1) * step) / 2;
const sC = Math.round(cols * splitX);
const sR = Math.round(rows * splitY);

function hash(a, b) {
  let n = ((a * 2654435761) ^ (b * 2246822519)) >>> 0;
  n = ((n >> 16) ^ n) >>> 0;
  return n % 1000;
}

let svg = \`<rect width="\${vb}" height="\${vb}" rx="\${borderRadius}" fill="\${bgColor}"/>\`;

for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    const cx = (ox + c * step).toFixed(1);
    const cy = (oy + r * step).toFixed(1);
    const inL = c < sC || r >= sR;
    const v = hash(c, r);
    const sv = 0.85 + (v % 30) / 100;
    let fill, op, dr;
    if (inL) {
      if (v < 25) { fill = '#ef4444'; op = 0.9; dr = base * 1.5; }
      else if (v < 45) { fill = '#22d3ee'; op = 0.85; dr = base * 1.3; }
      else { fill = paneColor; op = 0.7 + (v % 25) / 80; dr = base * sv; }
    } else {
      if (v < 12) { fill = '#ef4444'; op = 0.6; dr = base * 1.2; }
      else if (v < 22) { fill = '#22d3ee'; op = 0.5; dr = base; }
      else { fill = dimPaneColor; op = 1; dr = base * 0.6 * sv; }
    }
    svg += \`<circle cx="\${cx}" cy="\${cy}" r="\${dr.toFixed(2)}" fill="\${fill}" opacity="\${op}"/>\`;
  }
}
return svg;`,
};

export const builtinRenderBodies: Record<string, BuiltinDef> = {
  'negative-space': negativeSpace,
  'green-channel': greenChannel,
  'grid-color': gridColor,
  'interlocking': interlocking,
  'lattice-grid': latticeGrid,
  'app-windows': appWindows,
  'dot-matrix': dotMatrix,
};

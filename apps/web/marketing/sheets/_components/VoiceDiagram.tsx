const STAGES: Array<{ x: number; y: number; label: string; sub: string; accent?: boolean }> = [
  { x: 80, y: 230, label: 'CAPTURE', sub: 'useVoiceInput' },
  { x: 270, y: 130, label: 'TRANSCRIBE', sub: 'voxProbe' },
  { x: 270, y: 330, label: 'MATCH', sub: 'IntentIndex' },
  { x: 480, y: 230, label: 'DISPATCH', sub: 'command.run', accent: true },
  { x: 700, y: 130, label: 'APP', sub: 'Talkie' },
  { x: 700, y: 330, label: 'REPLY', sub: 'voiceReply' },
];

const WIRES = [
  'M 145 230 C 200 230, 200 130, 205 130',
  'M 145 230 C 200 230, 200 330, 205 330',
  'M 335 130 C 400 130, 400 230, 415 230',
  'M 335 330 C 400 330, 400 230, 415 230',
  'M 545 230 C 620 230, 620 130, 635 130',
  'M 545 230 C 620 230, 620 330, 635 330',
];

const WAVE_HEIGHTS = [4, 8, 14, 6, 18, 10, 16, 7, 5];

export function VoiceDiagram() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'oklch(0.145 0 0)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1.4px)',
          backgroundSize: '20px 20px',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600,
          height: 300,
          background:
            'radial-gradient(ellipse, var(--accent-soft), transparent 65%)',
          filter: 'blur(40px)',
        }}
      />

      <svg width="100%" height="100%" viewBox="0 0 900 460" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <marker
            id="vArr"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" />
          </marker>
        </defs>

        {STAGES.map((s) => (
          <g key={s.label} transform={`translate(${s.x}, ${s.y})`}>
            <rect
              x="-65"
              y="-32"
              width="130"
              height="64"
              rx="3"
              fill={s.accent ? 'var(--accent)' : 'oklch(0.18 0 0)'}
              stroke={s.accent ? 'var(--accent)' : 'oklch(0.4 0 0)'}
              strokeWidth="1.5"
            />
            <text
              x="0"
              y="-8"
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontSize="11"
              fill={s.accent ? 'oklch(0.145 0 0)' : 'oklch(0.95 0 0)'}
              letterSpacing="2"
              fontWeight="700"
            >
              {s.label}
            </text>
            <text
              x="0"
              y="14"
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontSize="10"
              fill={s.accent ? 'oklch(0.145 0 0 / 0.7)' : 'oklch(0.64 0 0)'}
            >
              {s.sub}
            </text>
          </g>
        ))}

        {WIRES.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.4"
            strokeDasharray="4 4"
            markerEnd="url(#vArr)"
            opacity="0.85"
          />
        ))}

        <g transform="translate(80, 200)">
          {WAVE_HEIGHTS.map((h, i) => (
            <rect
              key={i}
              x={-30 + i * 7}
              y={-h / 2}
              width="3"
              height={h}
              fill="var(--accent)"
            />
          ))}
        </g>

        <g transform="translate(270, 80)">
          <rect x="-110" y="-22" width="220" height="36" fill="oklch(0.18 0 0)" stroke="oklch(0.4 0 0)" />
          <text
            x="-100"
            y="2"
            fontFamily="var(--font-mono)"
            fontSize="11"
            fill="oklch(0.95 0 0)"
          >
            &quot;transcribe this clip&quot;
          </text>
        </g>

        <g transform="translate(450, 410)">
          <rect x="-55" y="-12" width="110" height="22" fill="var(--accent)" />
          <text
            x="0"
            y="3"
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize="11"
            fill="oklch(0.145 0 0)"
            fontWeight="700"
            letterSpacing="2"
          >
            ⏱ 78 ms TOTAL
          </text>
        </g>
      </svg>
    </div>
  );
}

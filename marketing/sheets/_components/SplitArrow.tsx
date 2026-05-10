export function SplitArrow() {
  return (
    <div className="reflow-split-arrow" style={{ width: 60, height: 200, position: 'relative' }}>
      <svg width="60" height="200" viewBox="0 0 60 200" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <marker
            id="sArr"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="var(--ink)" />
          </marker>
        </defs>
        <line x1="0" y1="100" x2="20" y2="100" stroke="var(--ink)" strokeWidth="1.5" />
        <line x1="20" y1="40" x2="20" y2="160" stroke="var(--ink)" strokeWidth="1.5" />
        <line
          x1="20"
          y1="40"
          x2="55"
          y2="40"
          stroke="var(--ink)"
          strokeWidth="1.5"
          markerEnd="url(#sArr)"
        />
        <line
          x1="20"
          y1="100"
          x2="55"
          y2="100"
          stroke="var(--ink)"
          strokeWidth="1.5"
          markerEnd="url(#sArr)"
        />
        <line
          x1="20"
          y1="160"
          x2="55"
          y2="160"
          stroke="var(--ink)"
          strokeWidth="1.5"
          markerEnd="url(#sArr)"
        />
      </svg>
    </div>
  );
}

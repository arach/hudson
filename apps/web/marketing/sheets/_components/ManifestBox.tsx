export function ManifestBox() {
  return (
    <div
      className="hud-card"
      style={{
        border: 'var(--stroke-w) solid var(--ink)',
        background: 'var(--ink)',
        color: 'var(--paper)',
        padding: 18,
        fontFamily: 'var(--font-mono)',
        fontSize: 11.5,
        lineHeight: 1.55,
        width: 280,
      }}
    >
      <div
        style={{
          fontSize: 9,
          letterSpacing: '0.2em',
          color: 'var(--accent)',
          marginBottom: 12,
          textTransform: 'uppercase',
        }}
      >
        SOURCE · manifest.ts
      </div>
      <span className="kw">const </span>
      <span style={{ color: 'var(--paper)' }}>app</span>:{' '}
      <span className="kw">HudsonApp</span> = {'{'}
      <br />
      {'  '}id: <span style={{ color: 'var(--accent)' }}>&quot;talkie&quot;</span>,
      <br />
      {'  '}mode: <span style={{ color: 'var(--accent)' }}>&quot;canvas&quot;</span>,
      <br />
      {'  '}intents: [<span className="num">12</span>],
      <br />
      {'  '}surfaces: [
      <br />
      {'    '}<span style={{ color: 'var(--accent)' }}>&quot;ios&quot;</span>,
      <br />
      {'    '}<span style={{ color: 'var(--accent)' }}>&quot;macos&quot;</span>,
      <br />
      {'    '}<span style={{ color: 'var(--accent)' }}>&quot;web&quot;</span>,
      <br />
      {'  '}],
      <br />
      {'};'}
    </div>
  );
}

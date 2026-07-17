export function WorkspaceSpecBox() {
  return (
    <div
      className="code hud-card"
      style={{
        padding: 18,
        fontSize: 11.5,
        lineHeight: 1.55,
        width: 280,
      }}
    >
      <div
        style={{
          fontSize: 9,
          letterSpacing: '0.2em',
          marginBottom: 12,
          textTransform: 'uppercase',
        }}
        className="at"
      >
        PRODUCT SPEC · WORKSPACE NEEDS
      </div>
      <span className="kw">const </span>
      workspace = {'{'}
      <br />
      {'  '}chrome: [<span className="str">&quot;nav&quot;</span>, <span className="str">&quot;rails&quot;</span>,
      <br />
      {'    '}<span className="str">&quot;status&quot;</span>],
      <br />
      {'  '}actions: [<span className="str">&quot;commands&quot;</span>,
      <br />
      {'    '}<span className="str">&quot;intents&quot;</span>],
      <br />
      {'  '}canvas: <span className="kw">true</span>,
      <br />
      {'};'}
    </div>
  );
}

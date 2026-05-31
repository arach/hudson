const TOKEN_GROUPS: { title: string; vars: string[] }[] = [
  {
    title: "Surface",
    vars: ["--hud-bg", "--hud-bg-2", "--hud-bg-3", "--hud-surface"],
  },
  {
    title: "Ink",
    vars: [
      "--hud-ink",
      "--hud-ink-1",
      "--hud-ink-2",
      "--hud-ink-3",
      "--hud-muted",
      "--hud-dim",
    ],
  },
  {
    title: "Structure",
    vars: [
      "--hud-border",
      "--hud-chrome-border",
      "--hud-line",
      "--hud-line-strong",
    ],
  },
  {
    title: "Accent",
    vars: ["--hud-accent", "--hud-accent-soft", "--hud-accent-line"],
  },
  {
    title: "Status",
    vars: [
      "--hud-status-ok",
      "--hud-status-warn",
      "--hud-status-error",
      "--hud-status-info",
    ],
  },
  {
    title: "Studio aliases",
    vars: [
      "--studio-canvas",
      "--studio-surface",
      "--studio-ink",
      "--studio-ink-faint",
      "--studio-edge",
      "--scout-accent",
    ],
  },
];

export function ThemeTokensExhibit() {
  return (
    <div className="space-y-10">
      {TOKEN_GROUPS.map((group) => (
        <section key={group.title}>
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-studio-ink-faint">
            · {group.title}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {group.vars.map((v) => (
              <div
                key={v}
                className="rounded-md border border-studio-edge p-3"
              >
                <div
                  className="h-12 w-full rounded border border-studio-edge"
                  style={{ background: `var(${v})` }}
                />
                <div className="mt-2 font-mono text-[10px] text-studio-ink">
                  {v}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

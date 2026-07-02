export function AppShellExhibit() {
  return (
    <div className="space-y-6 text-[13px] leading-relaxed text-studio-ink-faint">
      <p>
        You&apos;re inside one. Hudson Studio itself is mounted in{" "}
        <code className="rounded bg-studio-chip-bg px-1 py-0.5 font-mono text-[11px]">AppShell</code>
        {" "}— the navigation bar above, the left panel hosting the catalog,
        the content area you&apos;re reading, and the status bar at the bottom.
      </p>

      <div className="rounded-md border border-studio-edge p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-studio-ink-faint">
          · what AppShell renders
        </div>
        <ul className="mt-3 space-y-1.5 text-[12.5px] text-studio-ink">
          <li>
            <strong>NavigationBar</strong> — app name + commands + nav-center +
            nav-actions slots.
          </li>
          <li>
            <strong>SidePanel × 2</strong> — left (manifest / catalog), right
            (inspector). Right disabled in this studio.
          </li>
          <li>
            <strong>Content slot</strong> — your app&apos;s main surface.
          </li>
          <li>
            <strong>StatusBar</strong> — status pill + status-left/right slots.
          </li>
          <li>
            <strong>CommandPalette</strong> — Cmd+K. Disabled here.
          </li>
          <li>
            <strong>TerminalDrawer</strong> — bottom-anchored drawer with
            assistant + terminal tabs. Disabled here.
          </li>
          <li>
            <strong>Takeover slot</strong> — full-viewport overlay that
            replaces chrome (onboarding, modal flows).
          </li>
        </ul>
      </div>

      <div className="rounded-md border border-studio-edge p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-studio-ink-faint">
          · contract
        </div>
        <pre className="mt-3 overflow-x-auto rounded bg-studio-canvas-alt p-3 font-mono text-[11px] text-studio-ink">
{`<AppShell
  app={hudsonApp}            // implements HudsonApp interface
  assistant={false}          // disable the Assistant tab
  managedTheme={false}       // parent owns the ThemeProvider
  chrome={{                  // per-feature opt-outs
    palette: false,
    terminal: false,
    rightPanel: false,
  }}
/>`}
        </pre>
        <p className="mt-3 text-[12px]">
          See{" "}
          <code className="font-mono text-[11px]">
            docs/building-apps.md
          </code>{" "}
          for the full <code className="font-mono text-[11px]">HudsonApp</code>{" "}
          contract — Provider, slots, hooks.
        </p>
      </div>
    </div>
  );
}

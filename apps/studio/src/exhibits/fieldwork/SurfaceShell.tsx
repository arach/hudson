/**
 * Lightweight shell for Fieldwork journey sketches.
 * Not a design system — just shared look-and-feel so three lanes rhyme.
 */

import type { CSSProperties, ReactNode } from "react";

const BASE = `
.fw-surface {
  --room: #ece9e2;
  --raised: #f8f6f1;
  --sunken: #e5e1d8;
  --ink: #211f1c;
  --soft: #5b5952;
  --faint: #8c897f;
  --hairline: rgba(33, 31, 28, 0.10);
  --edge: rgba(33, 31, 28, 0.16);
  --capture: #5a7d86;
  --voice: #b0512f;
  --pause: #c08a2e;
  --proof-pass: #3f8f6b;
  --instr: #1b1c20;
  --instr-ink: #e7e6e2;
  --instr-faint: #8d8b86;
  --serif: "Newsreader", "Iowan Old Style", Georgia, serif;
  --sans: "Inter", system-ui, -apple-system, sans-serif;
  --mono: "JetBrains Mono", ui-monospace, Menlo, monospace;
  position: absolute;
  inset: 0;
  overflow: auto;
  background: var(--room);
  color: var(--ink);
  font-family: var(--sans);
  -webkit-font-smoothing: antialiased;
}
.fw-surface[data-variant="dark"] {
  background: var(--instr);
  color: var(--instr-ink);
}
.fw-column {
  max-width: 720px;
  margin: 0 auto;
  padding: 64px 28px 96px;
}
.fw-wide {
  max-width: 1100px;
  margin: 0 auto;
  padding: 40px 24px 80px;
}
.fw-eyebrow {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--faint);
}
.fw-surface[data-variant="dark"] .fw-eyebrow { color: var(--instr-faint); }
.fw-title {
  font-family: var(--serif);
  font-size: 40px;
  line-height: 1.05;
  font-weight: 500;
  letter-spacing: -0.02em;
  margin: 16px 0 0;
}
.fw-lede {
  font-size: 16px;
  line-height: 1.55;
  color: var(--soft);
  margin: 16px 0 0;
  max-width: 56ch;
}
.fw-surface[data-variant="dark"] .fw-lede { color: var(--instr-faint); }
.fw-section { margin-top: 40px; }
.fw-label {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--faint);
  padding-bottom: 10px;
  border-bottom: 1px solid var(--hairline);
  margin-bottom: 16px;
}
.fw-card {
  background: var(--raised);
  border: 1px solid var(--hairline);
  border-radius: 10px;
  padding: 16px 18px;
}
.fw-surface[data-variant="dark"] .fw-card {
  background: color-mix(in srgb, var(--instr) 70%, white 8%);
  border-color: rgba(255,255,255,0.08);
}
.fw-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
.fw-list li {
  display: grid;
  grid-template-columns: 8px 1fr;
  gap: 12px;
  align-items: start;
  font-size: 14px;
  line-height: 1.45;
  color: var(--soft);
}
.fw-list li::before {
  content: "";
  width: 6px; height: 6px; margin-top: 7px;
  border-radius: 50%;
  background: var(--faint);
}
.fw-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid var(--hairline);
  color: var(--soft);
}
.fw-btn {
  appearance: none;
  border: none;
  font-family: var(--sans);
  font-size: 14px;
  font-weight: 600;
  padding: 12px 20px;
  border-radius: 8px;
  background: var(--ink);
  color: var(--raised);
  cursor: default;
}
.fw-btn[data-tone="quiet"] {
  background: transparent;
  color: var(--ink);
  border: 1px solid var(--edge);
}
.fw-mono {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--faint);
}
[data-paper-region][data-paper-selected="true"] {
  outline: 2px solid color-mix(in srgb, #5a7d86 75%, transparent);
  outline-offset: 3px;
  border-radius: 4px;
}
`;

export function SurfaceShell({
  children,
  variant = "light",
  wide = false,
  style,
}: {
  children: ReactNode;
  variant?: "light" | "dark";
  wide?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div className="fw-surface" data-variant={variant} style={style}>
      <style>{BASE}</style>
      <div className={wide ? "fw-wide" : "fw-column"}>{children}</div>
    </div>
  );
}

export function regionProps(
  id: string,
  label: string,
  role?: string,
  note?: string,
) {
  return {
    "data-paper-region": id,
    "data-paper-label": label,
    ...(role ? { "data-paper-role": role } : {}),
    ...(note ? { "data-paper-note": note } : {}),
  } as const;
}

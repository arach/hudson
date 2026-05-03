# Hudson Theming

Hudson ships with runtime-switchable themes and curated templates for any app that mounts `AppShell`.

## Quick Start

```tsx
import 'hudsonkit/styles';
import { HudsonThemeScript, ThemeProvider } from 'hudsonkit';
import { AppShell } from 'hudsonkit/app-shell';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-hudson-template="hudson" data-hudson-theme="dark">
      <head>
        <HudsonThemeScript />
      </head>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

export function MyPage() {
  return <AppShell app={myApp} defaultTheme="system" defaultTemplate="hudson" />;
}
```

`HudsonThemeScript` applies the saved preference before hydration, and `ThemeProvider` exposes the runtime controls through `useTheme()`.

## Runtime API

```tsx
import { useTheme } from 'hudsonkit';

function ThemeSwitcher() {
  const { theme, resolvedTheme, template, setTheme, setTemplate } = useTheme();

  return (
    <>
      <button onClick={() => setTheme('light')}>Light</button>
      <button onClick={() => setTheme('dark')}>Dark</button>
      <button onClick={() => setTheme('system')}>System</button>
      <button onClick={() => setTemplate('hudson')}>Hudson</button>
      <button onClick={() => setTemplate('editorial')}>Editorial</button>
      <span>{resolvedTheme}</span>
      <span>{template}</span>
    </>
  );
}
```

## Tokens

Hudson follows a shadcn-style semantic token surface. Chrome components consume tokens like `--background`, `--foreground`, `--card`, `--accent`, `--border`, and `--ring`, while legacy `--hud-*` tokens are re-pointed to the active template so existing app content continues to work.

The SDK publishes these Tailwind color names:

- `background`
- `foreground`
- `card`
- `card-foreground`
- `popover`
- `popover-foreground`
- `primary`
- `primary-foreground`
- `secondary`
- `secondary-foreground`
- `muted`
- `muted-foreground`
- `accent`
- `accent-foreground`
- `destructive`
- `destructive-foreground`
- `warning`
- `success`
- `info`
- `border`
- `input`
- `ring`

## Customizing a Single App

If you want an app-specific aesthetic, override the semantic tokens on a wrapper element inside your app while keeping the shell on the shared template:

```tsx
export function NotesContent() {
  return (
    <div
      style={{
        '--background': '0.97 0.004 230',
        '--foreground': '0.2 0.02 250',
        '--accent': '0.62 0.16 200',
      } as React.CSSProperties}
      className="bg-background text-foreground"
    >
      ...
    </div>
  );
}
```

## Adding a New Template

1. Add a new `[data-hudson-template="your-template"]` block in `packages/web/hudsonkit/src/styles/tokens.css`.
2. Define light and dark token values for the semantic surface.
3. Re-point the `--hud-*` aliases in the template scope if your app content relies on them.
4. Extend the `HudsonTemplate` union in `packages/web/hudsonkit/src/theme/ThemeProvider.tsx`.
5. Add any switcher UI or command-palette entries that should expose the new template.

## Notes

- `editorial` expects consumers to load `Source Serif 4` themselves if they want the serif body treatment.
- `WorkspaceShell` remains intentionally dark-focused for now; the current theming work targets `AppShell` and shared SDK chrome.

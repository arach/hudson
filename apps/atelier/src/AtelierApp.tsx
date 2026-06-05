import { Component, lazy, Suspense, type ReactNode } from "react";
import { ThemeProvider } from "hudsonkit/theme";

// Transitional full host shell mount. It receives Atelier-owned workspaces,
// not Hudson's app/workspaces registry.
const HostView = lazy(() => import("./HostView"));

// Contain a host-mount failure so the Vite page can report it cleanly.
class ViewErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="h-full overflow-auto p-6 font-mono text-[12px]">
          <div className="mb-2 text-foreground/70">Host shell failed to mount under Vite:</div>
          <pre className="whitespace-pre-wrap text-red-300/90">{String(this.state.error.message)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AtelierApp() {
  return (
    <ThemeProvider defaultTheme="dark">
      <div className="h-screen w-screen overflow-hidden bg-background text-foreground">
        <ViewErrorBoundary>
          <Suspense
            fallback={
              <div className="p-6 font-mono text-[12px] text-foreground/50">Loading Atelier workspace...</div>
            }
          >
            <HostView />
          </Suspense>
        </ViewErrorBoundary>
      </div>
    </ThemeProvider>
  );
}

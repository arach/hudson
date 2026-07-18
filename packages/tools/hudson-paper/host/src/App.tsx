/**
 * Paper host — ThemeProvider + Frame-owned canvas (HUD chrome).
 */

import { ThemeProvider } from "hudsonkit/theme";
import { PaperStateProvider } from "./PaperState";
import { PaperHost } from "./PaperHost";

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" defaultTemplate="hudson">
      <div className="relative h-screen w-screen overflow-hidden bg-background text-foreground">
        <PaperStateProvider>
          <PaperHost />
        </PaperStateProvider>
      </div>
    </ThemeProvider>
  );
}

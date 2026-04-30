import type { Metadata } from "next";
import { JetBrains_Mono, Jura } from "next/font/google";
import Script from "next/script";
import { HudsonThemeClient } from "./HudsonThemeClient";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

// Brand typeface for wordmark + display headings.
// Jura is the chosen brand font; IBM Plex Mono is a strong fallback candidate.
const jura = Jura({
  variable: "--font-jura",
  subsets: ["latin"],
  display: "swap",
});

function getHudsonThemeScript(storageKey = "hudson.settings") {
  return `!function(k){try{var d=document.documentElement,q=new URLSearchParams(location.search),s=JSON.parse(localStorage.getItem(k)||'{}'),x=q.get('theme')||s.theme||'system',y=q.get('template')||s.template||'hudson',m='system'===x&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'system'===x?'light':x;d.dataset.hudsonTheme=m,d.dataset.hudsonTemplate=y}catch(e){var d=document.documentElement;d.dataset.hudsonTheme='dark';d.dataset.hudsonTemplate='hudson'}}('${storageKey.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}');`;
}

export const metadata: Metadata = {
  metadataBase: new URL("https://app.hudsonkit.com"),
  title: "HudsonKit",
  description: "SDK and chrome primitives for canvas and panel-based applications",
  openGraph: {
    title: "HudsonKit — Multi-app canvas workspace for React",
    description:
      "Build apps with Provider + Slots + Hooks. Compose them into spatial workspaces with pan, zoom, and windowing.",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HudsonKit — Multi-app canvas workspace for React",
    description:
      "Build apps with Provider + Slots + Hooks. Compose them into spatial workspaces with pan, zoom, and windowing.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${jetbrainsMono.variable} ${jura.variable}`}
      data-hudson-template="hudson"
      data-hudson-theme="dark"
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: getHudsonThemeScript() }} />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-GSHDZPFRZG"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-GSHDZPFRZG');`}
        </Script>
      </head>
      <body className="antialiased">
        <HudsonThemeClient>
          {children}
        </HudsonThemeClient>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist_Mono, Jura } from "next/font/google";
import { HudsonThemeScript, ThemeProvider } from "@hudson/sdk";
import Script from "next/script";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Brand typeface for wordmark + display headings.
// Jura is the chosen brand font; IBM Plex Mono is a strong fallback candidate.
const jura = Jura({
  variable: "--font-jura",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://hudsonkit.com"),
  title: "HudsonKit",
  description: "Shell and app primitives for building polished Hudson apps.",
  openGraph: {
    title: "HudsonKit — Multi-app canvas workspaces for React",
    description:
      "Build apps with Provider + Slots + Hooks. Compose them into spatial workspaces with pan, zoom, and windowing.",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HudsonKit — Multi-app canvas workspaces for React",
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
      className={`${geistMono.variable} ${jura.variable}`}
      data-hudson-template="hudson"
      data-hudson-theme="dark"
    >
      <head>
        <HudsonThemeScript storageKey="hudson.settings" />
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
        <ThemeProvider storageKey="hudson.settings">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

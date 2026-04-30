import type { Metadata } from "next";
import { JetBrains_Mono, Jura } from "next/font/google";
import Script from "next/script";
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
      className={`${jetbrainsMono.variable} ${jura.variable}`}
    >
      <head>
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
        {children}
      </body>
    </html>
  );
}

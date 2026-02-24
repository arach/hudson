import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const astroMono = localFont({
  src: [
    { path: "../public/fonts/AstroMono-Regular.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/AstroMono-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-astro-mono",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://hudsonos.com"),
  title: "Hudson",
  description: "HUD-style chrome components for canvas and panel-based applications",
  openGraph: {
    title: "Hudson — Multi-app canvas workspace for React",
    description:
      "Build apps with Provider + Slots + Hooks. Compose them into spatial workspaces with pan, zoom, and windowing.",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hudson — Multi-app canvas workspace for React",
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
    <html lang="en">
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
      <body className={`${astroMono.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}

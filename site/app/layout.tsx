import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://hudsonkit.com"),
  title: "HudsonKit",
  description: "SDK and app shell primitives for building polished Hudson apps.",
  openGraph: {
    title: "HudsonKit",
    description: "SDK and app shell primitives for building polished Hudson apps.",
    url: "https://hudsonkit.com",
    siteName: "HudsonKit",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "HudsonKit",
    description: "SDK and app shell primitives for building polished Hudson apps."
  }
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

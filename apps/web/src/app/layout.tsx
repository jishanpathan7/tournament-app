import type { Metadata } from "next";
import { Fraunces, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

import { Providers } from "@/components/providers";
import { env } from "@/lib/env";
import { SITE } from "@/lib/site";

import "./globals.css";

const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Fraunces({ subsets: ["latin"], variable: "--font-serif", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: {
    default: SITE.name,
    template: SITE.titleTemplate,
  },
  description: SITE.description,
  icons: {
    icon: "/logo-mark.png",
    apple: "/apple-icon.png",
    shortcut: "/logo-mark.png",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: SITE.name,
    description: SITE.tagline,
    siteName: SITE.name,
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: SITE.tagline }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.name,
    description: SITE.tagline,
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${serif.variable} ${mono.variable}`}
    >
      <body className="bg-background text-foreground min-h-screen font-sans antialiased">
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}

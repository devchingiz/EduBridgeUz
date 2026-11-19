import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { siteConfig } from "@/lib/site";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "EduBridge — Your Bridge to Global Education",
    template: "%s — EduBridge",
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [
    "international universities",
    "scholarships",
    "study abroad",
    "university applications",
    "scholarship search",
    "Uzbekistan",
    "Central Asia",
    "AI university advisor",
  ],
  authors: [{ name: "EduBridge" }],
  creator: "EduBridge",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: "EduBridge — Your Bridge to Global Education",
    description: siteConfig.description,
  },
  twitter: {
    card: "summary_large_image",
    title: "EduBridge — Your Bridge to Global Education",
    description: siteConfig.description,
  },
  robots: {
    index: true,
    follow: true,
  },
  category: "education",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfd" },
    { media: "(prefers-color-scheme: dark)", color: "#08090e" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

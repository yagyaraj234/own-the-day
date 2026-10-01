import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description = "A monthly habit tracker with a daily score graph, saved in your browser.";

export const metadata: Metadata = {
  metadataBase: new URL("https://owntheday.xyz"),
  title: "Own The Day",
  description,
  // The image itself comes from app/opengraph-image.tsx.
  openGraph: { title: "Own The Day", description, siteName: "Own The Day", type: "website" },
  twitter: { card: "summary_large_image", title: "Own The Day", description },
  appleWebApp: { capable: true, title: "Own The Day", statusBarStyle: "default" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // The inline script sets data-theme before React hydrates.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-white dark:bg-zinc-950 font-sans">{children}</body>
    </html>
  );
}

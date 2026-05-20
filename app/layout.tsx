import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { Providers } from "./providers";
import { getServerLang } from "@/lib/server-lang";
import "./globals.css";

/**
 * Inter is the design-system font (per Zulu_1 components/typography Figma spec).
 * Tailwind config maps `font-sans` → `var(--font-inter)`. Without this loader
 * the variable was undefined and the entire app fell back to browser-default
 * serif (Times New Roman on Windows).
 */
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Zulu Admin (Next shadow)",
  description: "Bearer-only admin shadow against Laravel /api",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const htmlLang = getServerLang();
  return (
    <html lang={htmlLang} suppressHydrationWarning>
      <body
        className={`${inter.variable} ${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        {/* WCAG 2.1 — 2.4.1 Bypass blocks. Hidden until focused; lets
            keyboard users jump past the sidebar/header chrome on every
            admin page. Pairs with id="main-content" on AdminShell's
            <main> wrapper. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded focus:bg-bg-base focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-fg-base focus:ring-2 focus:ring-primary focus:outline-none"
        >
          Skip to content
        </a>
        <Providers initialLang={htmlLang}>{children}</Providers>
      </body>
    </html>
  );
}

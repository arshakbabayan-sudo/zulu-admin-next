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
    <html lang={htmlLang} translate="no" suppressHydrationWarning>
      <head>
        {/* Stop Chrome's auto-translate from re-translating on every render.
            The admin is an internal staff tool with its own EN/HY/RU switcher,
            so browser translation is redundant — and when it's on (e.g. a
            Russian-locale Chrome viewing the Armenian UI) it re-scans the DOM on
            every field change and visibly flickers the page, worst on text-heavy
            pages like RBAC (105 permission labels). `translate=no` + this meta
            disable it. (Customer site keeps translation — tourists need it.) */}
        <meta name="google" content="notranslate" />
        {/* Tabler Icons webfont — used by admin v3 surface (Management redesign
            2026-06-03+). `<i class="ti ti-*"/>` markup in v3 components and HTML
            specs (docs/admin_designe/) renders the icon glyph. Loaded via CDN
            stylesheet (no JS, no bundle weight). */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.24.0/dist/tabler-icons.min.css"
        />
      </head>
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

import type { Metadata } from "next";
import localFont from "next/font/local";
import { Providers } from "./providers";
import { getServerLang } from "@/lib/server-lang";
import "./globals.css";

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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers initialLang={htmlLang}>{children}</Providers>
      </body>
    </html>
  );
}

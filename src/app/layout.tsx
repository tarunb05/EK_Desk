import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Body/data stays Inter throughout — dense tables need its tabular-nums and
// legibility at small sizes. This serif is scoped to page titles and the
// wordmark only (via --font-serif), for the "bank statement" character
// CLAUDE.md's design system calls for without touching numeral-heavy UI.
const sourceSerif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "EuroKids Fee Tracker",
  description: "Internal fee management for EuroKids transport and daycare.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Reading this header (set by middleware) is what makes Next.js switch
  // this render to dynamic and stamp the same nonce onto its own
  // framework-injected inline hydration scripts — required for the
  // script-src 'nonce-...' CSP in src/lib/supabase/middleware.ts to allow
  // them through instead of silently breaking hydration.
  await headers();

  return (
    <html lang="en">
      <body className={`${inter.variable} ${sourceSerif.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}

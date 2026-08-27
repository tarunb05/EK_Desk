import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Every page's own `metadata.title` fills in "%s" here — a page that sets
  // none (or doesn't set metadata at all) falls back to `default`. See
  // CLAUDE.md's Design system section for the one-font (Inter) rule this
  // pairs with.
  title: {
    default: "EK Desk",
    template: "%s — EK Desk",
  },
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
      <body className={`${inter.variable} antialiased`}>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${sourceSerif.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}

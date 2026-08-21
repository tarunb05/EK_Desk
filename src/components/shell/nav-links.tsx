"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/transport", label: "Transport" },
  { href: "/daycare", label: "Daycare" },
  { href: "/students", label: "Students" },
  { href: "/settings", label: "Settings" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {LINKS.map((link) => {
        const isActive = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-md px-3 py-2 text-sm transition-colors duration-150 ${
              isActive
                ? "bg-surface-accent text-ink"
                : "text-ink-secondary hover:bg-surface-accent hover:text-ink"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

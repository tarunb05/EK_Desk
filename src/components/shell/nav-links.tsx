"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DaycareIcon,
  SettingsIcon,
  StudentsIcon,
  TransportIcon,
} from "./nav-icons";
import { useSidebarContext } from "./sidebar-context";

const LINKS = [
  { href: "/transport", label: "Transport", Icon: TransportIcon },
  { href: "/daycare", label: "Daycare", Icon: DaycareIcon },
  { href: "/students", label: "Students", Icon: StudentsIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
];

// `collapsed` only ever narrows the desktop (md:) rail to icons-only — the
// mobile drawer always shows full labels regardless of the desktop
// collapse preference, so every collapse-driven class is md:-prefixed
// rather than conditionally rendered, keeping that true with no JS
// viewport check.
export function NavLinks({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const { setMobileOpen } = useSidebarContext();

  return (
    <nav className="flex flex-col gap-1">
      {LINKS.map(({ href, label, Icon }) => {
        const isActive = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            title={label}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent ${
              collapsed ? "md:justify-center" : ""
            } ${
              isActive
                ? "bg-surface-accent text-ink"
                : "text-ink-secondary hover:bg-surface-accent hover:text-ink"
            }`}
          >
            <Icon />
            <span className={collapsed ? "md:hidden" : ""}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

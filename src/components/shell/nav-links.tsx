"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ApprovalsIcon,
  DaycareIcon,
  SettingsIcon,
  StudentsIcon,
  TransportIcon,
} from "./nav-icons";
import { useSidebarContext } from "./sidebar-context";
import { ROUTE_ACCESS, type Role } from "@/lib/auth/routes";

// Exported so a unit test can assert "teacher's nav equals exactly the
// teacher-allowed routes" against ROUTE_ACCESS without rendering the
// component (this codebase's tests are pure-function based throughout;
// NavLinks needs a router/context mock to render at all).
export const NAV_LINKS = [
  { href: "/transport", label: "Transport", Icon: TransportIcon },
  { href: "/daycare", label: "Daycare", Icon: DaycareIcon },
  { href: "/students", label: "Students", Icon: StudentsIcon },
  { href: "/approvals", label: "Approvals", Icon: ApprovalsIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
];

// `collapsed` only ever narrows the desktop (md:) rail to icons-only — the
// mobile drawer always shows full labels regardless of the desktop
// collapse preference, so every collapse-driven class is md:-prefixed
// rather than conditionally rendered, keeping that true with no JS
// viewport check. `role` filters LINKS through the same ROUTE_ACCESS map
// middleware enforces — hiding a link here is cosmetic, never the actual
// access control, but the two must never be allowed to drift apart.
export function NavLinks({
  collapsed = false,
  role,
  pendingApprovalsCount = 0,
}: {
  collapsed?: boolean;
  role: Role;
  pendingApprovalsCount?: number;
}) {
  const pathname = usePathname();
  const { setMobileOpen } = useSidebarContext();
  const links = NAV_LINKS.filter((link) =>
    ROUTE_ACCESS[link.href]?.includes(role),
  );

  return (
    <nav className="flex flex-col gap-1">
      {links.map(({ href, label, Icon }) => {
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
            {href === "/approvals" && pendingApprovalsCount > 0 ? (
              <span
                className={`ml-auto rounded-md bg-attention px-1.5 py-0.5 text-2xs font-medium text-surface ${collapsed ? "md:hidden" : ""}`}
              >
                {pendingApprovalsCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

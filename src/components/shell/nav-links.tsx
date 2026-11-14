"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  Blocks,
  Bus,
  ClipboardCheck,
  History,
  LifeBuoy,
  ReceiptIndianRupee,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useSidebarContext } from "./sidebar-context";
import { ROUTE_ACCESS, type Role } from "@/lib/auth/routes";

// Exported so a unit test can assert "teacher's nav equals exactly the
// teacher-allowed routes" against ROUTE_ACCESS without rendering the
// component (this codebase's tests are pure-function based throughout;
// NavLinks needs a router/context mock to render at all).
// Sidebar icons come from lucide (already a dependency, via the date
// picker) rather than the hand-drawn set in nav-icons.tsx: at 18px in a
// 40px rail the hand-drawn ones were too thin and too alike to tell apart
// at a glance -- a house for Daycare, a bare tick for Payment verification.
// Each of these is a distinct silhouette that says what the screen is: a
// bus, toy blocks, people, a rupee receipt, a checked clipboard, a
// verified badge, a lifebuoy, a history clock, a cog.
//
// `group` splits the list into three runs -- the money screens, the
// queues waiting on someone, and the admin-only reading/config screens --
// with a hairline between runs, so nine links read as three short lists.
export const NAV_LINKS: {
  href: string;
  label: string;
  Icon: LucideIcon;
  group: "money" | "queues" | "admin";
}[] = [
  { href: "/transport", label: "Transport", Icon: Bus, group: "money" },
  { href: "/daycare", label: "Daycare", Icon: Blocks, group: "money" },
  { href: "/students", label: "Students", Icon: Users, group: "money" },
  {
    href: "/expenses",
    label: "Expenses",
    Icon: ReceiptIndianRupee,
    group: "money",
  },
  {
    href: "/approvals",
    label: "Approvals",
    Icon: ClipboardCheck,
    group: "queues",
  },
  // Admin-only (see ROUTE_ACCESS) -- a teacher never sees this link, same
  // stricter standard as the payment_request/payment_claim tables it reads.
  {
    href: "/verify",
    label: "Payment verification",
    Icon: BadgeCheck,
    group: "queues",
  },
  { href: "/support", label: "Support", Icon: LifeBuoy, group: "queues" },
  // Admin-only (see ROUTE_ACCESS) -- sits right before Settings, after
  // every screen with work to action, since this one has nothing to
  // action, only to read.
  { href: "/logs", label: "Activity log", Icon: History, group: "admin" },
  { href: "/settings", label: "Settings", Icon: Settings, group: "admin" },
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
  openSupportCount = 0,
  pendingClaimsCount = 0,
}: {
  collapsed?: boolean;
  role: Role;
  pendingApprovalsCount?: number;
  openSupportCount?: number;
  pendingClaimsCount?: number;
}) {
  const pathname = usePathname();
  const { setMobileOpen } = useSidebarContext();
  const links = NAV_LINKS.filter((link) =>
    ROUTE_ACCESS[link.href]?.includes(role),
  );

  return (
    <nav className="flex flex-col gap-1">
      {links.map(({ href, label, Icon, group }, index) => {
        const startsGroup = index > 0 && links[index - 1]?.group !== group;
        // Same route and nav slot for both roles -- only the wording
        // differs, since a teacher only ever sees their own requests here,
        // never a review queue to act on.
        const displayLabel =
          href === "/approvals" && role === "teacher" ? "My requests" : label;
        const isActive = pathname.startsWith(href);
        const badgeCount =
          href === "/approvals"
            ? pendingApprovalsCount
            : href === "/support"
              ? openSupportCount
              : href === "/verify"
                ? pendingClaimsCount
                : 0;
        return (
          <Fragment key={href}>
            {startsGroup ? (
              <span
                aria-hidden="true"
                className="mx-3 my-2 border-t border-hairline"
              />
            ) : null}
            <Link
              href={href}
              aria-label={displayLabel}
              title={displayLabel}
              onClick={() => setMobileOpen(false)}
              aria-current={isActive ? "page" : undefined}
              className={`flex h-9 items-center gap-2.5 rounded-full px-3 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                collapsed
                  ? "md:mx-auto md:w-9 md:justify-center md:gap-0 md:px-0"
                  : ""
              } ${
                isActive
                  ? "bg-accent font-medium text-canvas"
                  : "text-ink-secondary hover:bg-sand hover:text-ink"
              }`}
            >
              <span className="relative flex shrink-0">
                <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                {/* On the collapsed rail the count chip has no room, so a
                  dot on the icon says "something is waiting here". */}
                {badgeCount > 0 && collapsed ? (
                  <span className="absolute -right-1 -top-1 hidden h-2 w-2 rounded-full bg-attention ring-2 ring-canvas md:block" />
                ) : null}
              </span>
              <span
                className={`overflow-hidden whitespace-nowrap transition-[opacity,max-width] duration-200 ${
                  collapsed
                    ? "md:max-w-0 md:opacity-0"
                    : "md:max-w-[160px] md:opacity-100"
                }`}
              >
                {displayLabel}
              </span>
              {badgeCount > 0 ? (
                <span
                  className={`ml-auto shrink-0 overflow-hidden whitespace-nowrap rounded-full bg-attention px-1.5 py-0.5 text-2xs font-medium tabular-nums text-surface transition-[opacity,max-width] duration-200 ${
                    collapsed
                      ? "md:max-w-0 md:px-0 md:opacity-0"
                      : "md:max-w-6 md:opacity-100"
                  }`}
                >
                  {badgeCount}
                </span>
              ) : null}
            </Link>
          </Fragment>
        );
      })}
    </nav>
  );
}

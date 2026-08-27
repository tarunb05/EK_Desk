"use client";

import { useEffect, useState } from "react";
import { NavLinks } from "./nav-links";
import { CloseIcon, CollapseIcon } from "./nav-icons";
import { useSidebarContext } from "./sidebar-context";
import type { Role } from "@/lib/auth/routes";

const COLLAPSED_STORAGE_KEY = "sidebar-collapsed";

export function Sidebar({
  role,
  pendingApprovalsCount = 0,
}: {
  role: Role;
  pendingApprovalsCount?: number;
}) {
  const { mobileOpen, setMobileOpen } = useSidebarContext();
  const [collapsed, setCollapsed] = useState(false);

  // Read the persisted preference after mount only, so the server-rendered
  // and first-client-render markup match (avoids a hydration mismatch) —
  // the sidebar briefly renders expanded, then snaps to the stored state.
  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === "true");
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
      return next;
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close menu"
        tabIndex={mobileOpen ? 0 : -1}
        onClick={() => setMobileOpen(false)}
        className={`fixed inset-0 z-40 bg-ink/30 transition-opacity duration-150 md:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-hairline bg-surface px-3 py-6 transition-transform duration-150 md:relative md:z-0 md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "md:w-16" : "md:w-56"}`}
      >
        <div className="mb-6 flex items-center justify-between px-3">
          <span
            className={`text-sm font-medium text-ink ${collapsed ? "md:hidden" : ""}`}
          >
            EK Desk
          </span>

          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink focus-visible:outline-2 focus-visible:outline-accent md:flex"
          >
            <CollapseIcon direction={collapsed ? "right" : "left"} />
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink focus-visible:outline-2 focus-visible:outline-accent md:hidden"
          >
            <CloseIcon />
          </button>
        </div>

        <NavLinks
          collapsed={collapsed}
          role={role}
          pendingApprovalsCount={pendingApprovalsCount}
        />
      </aside>
    </>
  );
}

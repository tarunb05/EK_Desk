"use client";

import { signOut } from "@/lib/auth/sign-out";
import { MenuIcon } from "./nav-icons";
import { useSidebarContext } from "./sidebar-context";

interface TopBarProps {
  username: string | null;
}

// Year/branch selectors used to live here, but that put them out of
// context on every screen and left this bar cluttered on mobile. Each
// page now shows them itself, next to its own title, via ScopeSelectors —
// this bar is just the mobile menu toggle, branding, and sign-out.
export function TopBar({ username }: TopBarProps) {
  const { setMobileOpen } = useSidebarContext();

  return (
    <header className="flex h-14 items-center justify-between border-b border-hairline bg-surface px-4 md:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink focus-visible:outline-2 focus-visible:outline-accent md:hidden"
        >
          <MenuIcon />
        </button>
        <span className="text-sm font-medium text-ink">
          EuroKids Fee Tracker
        </span>
      </div>

      <div className="flex items-center gap-3">
        {username ? (
          <span className="text-sm text-ink-secondary">{username}</span>
        ) : null}
        <form action={signOut}>
          <button
            type="submit"
            className="h-8 rounded-md border border-border px-3 text-sm text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}

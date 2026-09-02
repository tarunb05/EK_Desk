"use client";

import { signOut } from "@/lib/auth/sign-out";
import { MenuIcon, SignOutIcon, UserIcon } from "./nav-icons";
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
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink focus-visible:outline-2 focus-visible:outline-accent md:hidden"
        >
          <MenuIcon />
        </button>
        <span className="text-sm font-medium text-ink">EK Desk</span>
      </div>

      <div className="flex items-center gap-3">
        {username ? (
          <span className="flex items-center gap-1.5 rounded-md bg-surface-accent px-2.5 py-1 text-sm text-ink-secondary">
            <UserIcon size={14} />
            {username}
          </span>
        ) : null}
        <form action={signOut}>
          <button
            type="submit"
            className="flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
          >
            <SignOutIcon size={14} />
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}

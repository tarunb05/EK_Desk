"use client";

import { signOut } from "@/lib/auth/sign-out";
import { MenuIcon, SignOutIcon, UserIcon } from "./nav-icons";
import { useSidebarContext } from "./sidebar-context";
import { Wordmark } from "./brand";
import { SupportRequestButton } from "@/components/support/support-request-button";
import type { Role } from "@/lib/auth/routes";

interface TopBarProps {
  username: string | null;
  role: Role;
}

// Year/branch selectors used to live here, but that put them out of
// context on every screen and left this bar cluttered on mobile. Each
// page now shows them itself, next to its own title, via ScopeSelectors —
// this bar is just the mobile menu toggle, branding, sign-out, and (for a
// teacher) the one-click way to reach an admin from wherever she is.
export function TopBar({ username, role }: TopBarProps) {
  const { setMobileOpen } = useSidebarContext();

  return (
    <header className="flex h-14 items-center justify-between border-b border-hairline bg-canvas px-4 md:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-secondary transition-colors duration-150 hover:bg-sand hover:text-ink focus-visible:outline-2 focus-visible:outline-accent md:hidden"
        >
          <MenuIcon />
        </button>
        {/* Phones only -- from md up the sidebar already carries the
            wordmark a few pixels to the left of where this would sit. */}
        <Wordmark className="md:hidden" />
      </div>

      {/* On phones Support and Sign out go icon-only (labels kept for screen
          readers) so the bar fits on one line instead of wrapping. */}
      <div className="flex min-w-0 items-center gap-3 max-sm:gap-2">
        {role === "teacher" ? <SupportRequestButton /> : null}
        {username ? (
          <span className="flex min-w-0 items-center gap-1.5 rounded-full bg-sand px-3 py-1 text-sm text-ink">
            <UserIcon size={14} className="shrink-0" />
            <span className="truncate">{username}</span>
          </span>
        ) : null}
        <form action={signOut}>
          <button
            type="submit"
            className="flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-sm text-ink-secondary transition-colors duration-150 hover:bg-sand hover:text-ink max-sm:h-10 max-sm:w-10 max-sm:justify-center max-sm:px-0"
          >
            <SignOutIcon size={14} />
            <span className="max-sm:sr-only">Log out</span>
          </button>
        </form>
      </div>
    </header>
  );
}

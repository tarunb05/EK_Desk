"use client";

import { useEffect, useState } from "react";
import { CloseIcon } from "./nav-icons";

const COOKIE_NAME = "route_restricted_notice";

function readAndClearCookie(): boolean {
  const found = document.cookie
    .split("; ")
    .some((entry) => entry.startsWith(`${COOKIE_NAME}=`));

  if (found) {
    document.cookie = `${COOKIE_NAME}=; Max-Age=0; path=/`;
  }

  return found;
}

// A one-shot flash message for a role-restricted redirect (see
// lib/supabase/middleware.ts) — not the persistent toast system phase 8.4
// adds for approvals, just a plain dismissible sentence so a denied route
// reads as a readable message instead of a silent redirect.
export function RouteRestrictedBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(readAndClearCookie());
  }, []);

  if (!visible) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-hairline bg-surface-accent px-4 py-2 text-sm text-ink md:px-6">
      <span>That page isn&apos;t available for your account.</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setVisible(false)}
        className="text-ink-secondary hover:text-ink"
      >
        <CloseIcon size={14} />
      </button>
    </div>
  );
}

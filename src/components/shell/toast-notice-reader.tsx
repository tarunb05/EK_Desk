"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useToast } from "./toast-context";

const COOKIE_NAME = "toast_notice";

function readAndClearCookie(): string | null {
  const entry = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${COOKIE_NAME}=`));

  if (!entry) return null;

  document.cookie = `${COOKIE_NAME}=; Max-Age=0; path=/`;
  return decodeURIComponent(entry.slice(COOKIE_NAME.length + 1));
}

// Same one-shot-cookie shape as RouteRestrictedBanner, for the same reason:
// a Server Action that redirect()s on success has no client-side state left
// to trigger a toast from directly (redirect() throws before anything after
// it runs) -- see lib/shell/toast-cookie.ts. Mounted once in the app shell,
// which persists across client-side navigations within the (app) route
// group (redirect() from a Server Action doesn't remount the layout) --
// unlike RouteRestrictedBanner's mount-only effect, this re-checks on every
// pathname change too, since that's exactly when a fresh redirect-set
// cookie could be waiting and a plain mount-once effect would miss it.
export function ToastNoticeReader() {
  const { showToast } = useToast();
  const pathname = usePathname();

  useEffect(() => {
    const message = readAndClearCookie();
    if (message) showToast(message);
  }, [pathname, showToast]);

  return null;
}

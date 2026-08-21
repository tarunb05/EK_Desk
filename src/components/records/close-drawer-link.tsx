"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

// Closing must go through router.back() rather than a plain href: Next.js
// only restores a parallel route slot's default.tsx on a back/forward
// navigation (or a full reload), not on a forward push to a new URL — so a
// plain <Link href={closeHref}> changes the URL but leaves the drawer
// mounted. back() also has the side effect of restoring whatever
// filters/sort/page were active before the drawer was opened, since
// closeHref is a fixed path with no query string.
export function CloseDrawerLink({
  href,
  className,
  ariaLabel,
  children,
}: {
  href: string;
  className: string;
  ariaLabel?: string;
  children?: ReactNode;
}) {
  const router = useRouter();

  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        router.back();
      }}
    >
      {children}
    </Link>
  );
}

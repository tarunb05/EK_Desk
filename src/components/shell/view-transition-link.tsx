"use client";

import Link, { type LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import type { AnchorHTMLAttributes, ReactNode } from "react";

// A next/link that navigates inside document.startViewTransition() when the
// browser supports it (Chrome/Edge/Safari as of writing; see
// modern-web-guidance's cross-document-transitions and same-document
// transitions guides) and prefers-reduced-motion allows it -- everywhere
// else this is a plain <Link>, since an unsupported browser or a reduced-
// motion preference should just get the instant navigation Next already
// gives it, not a broken or unwanted animation. The actual cross-fade is
// globals.css's ::view-transition-old/new(root) rules; this component's
// only job is deciding whether to open the transition at all.
export function ViewTransitionLink({
  href,
  children,
  className,
  ...rest
}: LinkProps &
  Pick<AnchorHTMLAttributes<HTMLAnchorElement>, "className"> & {
    children: ReactNode;
  }) {
  const router = useRouter();

  return (
    <Link
      href={href}
      className={className}
      onClick={(event) => {
        const supportsViewTransitions =
          typeof document.startViewTransition === "function";
        const reducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        if (!supportsViewTransitions || reducedMotion) return;

        event.preventDefault();
        document.startViewTransition(async () => {
          router.push(href.toString());
          // router.push() doesn't return a promise (Next's router has no
          // "navigation complete" signal to await), so without this the
          // transition's "after" screenshot can be taken before React
          // has committed the new route -- capturing the old page as
          // both halves of the cross-fade. Two animation frames is the
          // common workaround: one for the DOM mutation from the route
          // change, one for the browser to actually paint it. Next's
          // default prefetch-on-viewport for a <Link> like this one
          // means the RSC payload is normally already cached by the
          // time this fires, so the commit itself is fast enough for
          // this to reliably catch it.
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          );
        });
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}

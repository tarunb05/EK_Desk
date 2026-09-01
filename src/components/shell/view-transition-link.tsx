"use client";

import Link, { type LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import type { AnchorHTMLAttributes, ReactNode } from "react";

// A next/link that navigates inside document.startViewTransition() when the
// browser supports it (Chrome/Edge/Safari as of writing; see
// modern-web-guidance's cross-document-transitions and same-document
// transitions guides) and prefers-reduced-motion allows it -- everywhere
// else this is a plain <Link>, since an unsupported browser or a reduced-
// motion preference should just get the instant navigation Next already
// gives it, not a broken or unwanted animation. The actual iris reveal is
// globals.css's ::view-transition-old/new(root) rules, keyed off the
// --iris-x/--iris-y custom properties set below; this component's own job
// is just deciding whether to open the transition and where it originates.
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
  // document.startViewTransition() throws InvalidStateError if called
  // again while a previous transition (from an earlier click on this
  // same link) hasn't finished yet -- a double-click, or a second click
  // landing in the brief window before navigation actually completes,
  // both real ways for that to happen. This ref makes a second click
  // during that window a no-op: it must still preventDefault (not just
  // return early) or the browser's/Next's own default Link navigation
  // fires instead, which races the first transition's still-pending DOM
  // update and gets IT aborted too -- the actual bug here originally
  // ("Transition was aborted because of invalid state" on the *first*
  // transition, not an error from the second click at all).
  const transitionInFlight = useRef(false);

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

        if (transitionInFlight.current) {
          // Ignore the repeat click outright rather than letting it fall
          // through to a real navigation -- see the ref's own comment.
          event.preventDefault();
          return;
        }

        event.preventDefault();
        transitionInFlight.current = true;
        // Where the iris opens from. event.detail is 0 for a
        // keyboard-activated click (Enter/Space on a focused link) --
        // clientX/clientY are meaningless (usually 0,0) in that case, so
        // this falls back to the viewport centre instead of always
        // opening from the top-left corner for keyboard users.
        const isRealPointerClick = event.detail > 0;
        const originX = isRealPointerClick ? event.clientX : window.innerWidth / 2;
        const originY = isRealPointerClick ? event.clientY : window.innerHeight / 2;
        document.documentElement.style.setProperty("--iris-x", `${originX}px`);
        document.documentElement.style.setProperty("--iris-y", `${originY}px`);
        // Backstop, independent of whatever startViewTransition's own
        // promises do below: a tab that loses visibility (backgrounded,
        // minimized) right as this fires can starve requestAnimationFrame
        // indefinitely, which would otherwise wedge this ref at true
        // forever and silently break every future click on this link for
        // the rest of the session. Comfortably longer than the wait below
        // ever needs when rAF is firing normally.
        const forceReset = setTimeout(() => {
          transitionInFlight.current = false;
        }, 1000);
        try {
          const transition = document.startViewTransition(async () => {
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
            // this to reliably catch it. Raced against a timeout so a
            // starved rAF (see forceReset above) can't hang the view
            // transition's own update callback either.
            await Promise.race([
              new Promise<void>((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
              ),
              new Promise<void>((resolve) => setTimeout(resolve, 500)),
            ]);
          });
          // startViewTransition() returns three independent promises
          // (ready, updateCallbackDone, finished) that all reject the
          // same way whenever the transition gets skipped -- a second
          // click racing this one, a resize, the tab losing visibility,
          // or (in dev) the destination route still compiling on first
          // visit taking longer than the wait above. That's expected and
          // already harmless (the navigation itself still went through
          // via router.push above regardless), but a promise nobody
          // attaches a rejection handler to still surfaces as "Uncaught
          // (in promise)" -- this was the actual remaining source of
          // that error: only .finished had a .catch, so .ready and
          // .updateCallbackDone rejecting on the exact same skip kept
          // surfacing unhandled even after .finished was covered.
          transition.ready.catch(() => {});
          transition.updateCallbackDone.catch(() => {});
          transition.finished
            .catch(() => {})
            .finally(() => {
              clearTimeout(forceReset);
              transitionInFlight.current = false;
            });
        } catch {
          // Any other InvalidStateError this browser might throw here
          // (a transition already running that the ref somehow missed,
          // the document mid-unload, etc.) -- fall back to a normal
          // navigation rather than eating the click.
          clearTimeout(forceReset);
          transitionInFlight.current = false;
          router.push(href.toString());
        }
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}

"use client";

import Link, { type LinkProps } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { AnchorHTMLAttributes, CSSProperties, ReactNode } from "react";

// A next/link that plays a solid --accent iris/curtain -- expanding from
// wherever the link was actually clicked to cover the screen, then
// contracting away once the destination has rendered underneath -- instead
// of Next's instant client-side swap. Not built on the View Transitions
// API: that API's "old"/"new" pseudo-elements are literally a rendering of
// the real page content, which can't be tinted a solid color without
// replacing what they show, so a colored curtain needs its own DOM overlay
// regardless. Doing it this way also sidesteps that whole API's promise-
// rejection/InvalidStateError edge cases entirely (see this file's git
// history) rather than layering a color effect on top of them.
//
// Two phases, each a plain CSS transition on the overlay's clip-path
// (var(--ease-flowy), matching every other animation in this app):
//   closing: mount the overlay at clip-path: circle(0% at the click point)
//            via @starting-style (modern-web-guidance's
//            animate-element-entry-exit -- no rAF needed for this half,
//            the browser animates from @starting-style automatically the
//            moment the element is first inserted) and transition to
//            circle(150%), i.e. full coverage.
//   opening: once the destination route has actually rendered underneath
//            (tracked via usePathname(), not a blind timeout) transition
//            the same, already-mounted element's clip-path back to 0% at
//            the same point, then unmount it.
//
// Every phase change is driven by a named "complete*" function, callable
// from either the real transitionend event OR a backstop timer -- a
// backgrounded/hidden tab can pause CSS transitions entirely (verified:
// this is what a "click, then check back later" test actually hit during
// development, not just a defensive worry), which would otherwise leave
// the curtain, and the navigation it gates, stuck on screen forever with
// nothing left to fire transitionend. Whichever of the two (real event or
// backstop) happens first wins; the phase check inside each function
// makes the other one a no-op.
const CLOSE_MS = 380;
const OPEN_MS = 380;
const BACKSTOP_BUFFER_MS = 200;
// Backstop if the destination never matches pathname (e.g. it redirects
// elsewhere, such as an already-authenticated visit to /login bouncing to
// /transport) -- opens the curtain anyway rather than leaving the screen
// solid blue forever.
const MAX_COVERED_WAIT_MS = 1200;

type Phase = "idle" | "closing" | "covered" | "opening";

export function IrisCurtainLink({
  href,
  children,
  className,
  ...rest
}: LinkProps &
  Pick<AnchorHTMLAttributes<HTMLAnchorElement>, "className"> & {
    children: ReactNode;
  }) {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");
  const [origin, setOrigin] = useState({ x: "50%", y: "50%" });
  const phaseRef = useRef<Phase>("idle");
  const targetPathRef = useRef<string | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  function completeClosing() {
    if (phaseRef.current !== "closing" || !targetPathRef.current) return;
    router.push(targetPathRef.current);
    setPhase("covered");
  }

  function completeOpening() {
    if (phaseRef.current !== "opening") return;
    setPhase("idle");
  }

  // Backstop timers for each phase -- see the file-level comment above.
  useEffect(() => {
    if (phase === "closing") {
      const timer = setTimeout(completeClosing, CLOSE_MS + BACKSTOP_BUFFER_MS);
      return () => clearTimeout(timer);
    }
    if (phase === "covered") {
      const timer = setTimeout(() => {
        if (phaseRef.current === "covered") setPhase("opening");
      }, MAX_COVERED_WAIT_MS);
      return () => clearTimeout(timer);
    }
    if (phase === "opening") {
      const timer = setTimeout(completeOpening, OPEN_MS + BACKSTOP_BUFFER_MS);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- completeClosing/completeOpening close over targetPathRef/phaseRef, not phase itself; re-running this effect for their identity churn every render would just restart the same timer pointlessly.
  }, [phase]);

  // Opens as soon as the destination has actually rendered (pathname
  // matches what was clicked) rather than waiting out the covered-phase
  // backstop above -- the common case is much faster than that backstop.
  useEffect(() => {
    if (phase === "covered" && pathname === targetPathRef.current) {
      setPhase("opening");
    }
  }, [pathname, phase]);

  return (
    <>
      <Link
        href={href}
        className={className}
        onClick={(event) => {
          const reducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
          ).matches;
          // A repeat click mid-animation is a no-op rather than restarting
          // the curtain from a new point or racing the pathname effect
          // above with a second target.
          if (reducedMotion || phase !== "idle") return;

          event.preventDefault();
          // event.detail is 0 for a keyboard-activated click (Enter/Space
          // on a focused link) -- clientX/clientY are meaningless (usually
          // 0,0) in that case, so this falls back to the viewport centre
          // instead of always opening from the top-left corner for
          // keyboard users.
          const isRealPointerClick = event.detail > 0;
          setOrigin({
            x: isRealPointerClick ? `${event.clientX}px` : "50%",
            y: isRealPointerClick ? `${event.clientY}px` : "50%",
          });
          targetPathRef.current = href.toString();
          setPhase("closing");
        }}
        {...rest}
      >
        {children}
      </Link>

      {phase !== "idle" ? (
        <div
          aria-hidden="true"
          data-phase={phase === "opening" ? "opening" : undefined}
          onTransitionEnd={() => {
            if (phase === "closing") completeClosing();
            else if (phase === "opening") completeOpening();
          }}
          className="iris-curtain"
          style={
            {
              "--curtain-x": origin.x,
              "--curtain-y": origin.y,
              "--curtain-duration": `${phase === "opening" ? OPEN_MS : CLOSE_MS}ms`,
            } as CSSProperties
          }
        />
      ) : null}
    </>
  );
}

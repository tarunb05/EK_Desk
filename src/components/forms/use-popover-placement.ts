import {
  useLayoutEffect,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";

const EDGE = 8;
const GAP = 4;

// Where a dropdown, calendar or menu should sit relative to its trigger so
// it stays inside the window. Every popover in the app is an absolutely
// positioned child of a `relative` wrapper around its trigger (`anchorRef`),
// and used to be pinned below-left unconditionally -- so a calendar opened
// from the right-hand field of a From/To pair, or from a field near the
// bottom of the page, ran off the edge of the screen.
//
// Measured when it opens (and again on resize), this returns an inline
// style that:
//   - opens downward, or upward when there is not enough room below and
//     more room above;
//   - when `width` is given, sets that width (shrunk to fit a narrow
//     window) and slides the popover left or right so both edges stay on
//     screen. Without `width` the popover keeps whatever width its own
//     classes give it and only the up/down flip applies.
//
// Still `position: absolute`, not `fixed`, on purpose: several of these
// popovers live inside a <dialog>, whose own transform would make `fixed`
// position against the dialog rather than the window.
//
// Until the first measurement the popover is rendered hidden, so it never
// flashes in the wrong place for a frame.
export function usePopoverPlacement(
  anchorRef: RefObject<HTMLElement | null>,
  open: boolean,
  { width, height }: { width?: number; height: number },
): CSSProperties {
  const [style, setStyle] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }

    function measure() {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight;

      const spaceBelow = viewportHeight - rect.bottom - EDGE;
      const spaceAbove = rect.top - EDGE;
      const openUpward = spaceBelow < height + GAP && spaceAbove > spaceBelow;

      const next: CSSProperties = openUpward
        ? { bottom: `calc(100% + ${GAP}px)` }
        : { top: `calc(100% + ${GAP}px)` };

      if (width !== undefined) {
        const fitted = Math.min(width, viewportWidth - EDGE * 2);
        const wantedLeft = Math.min(
          Math.max(rect.left, EDGE),
          viewportWidth - fitted - EDGE,
        );
        next.width = fitted;
        next.left = wantedLeft - rect.left;
      }

      setStyle(next);
    }

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [anchorRef, open, width, height]);

  return style ?? { visibility: "hidden", top: "100%" };
}

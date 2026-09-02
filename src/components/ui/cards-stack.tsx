"use client";

import * as React from "react";
import { type HTMLMotionProps, motion } from "motion/react";

import { cn } from "@/lib/utils";

// Copied from an external reference near-verbatim -- unlike the coverflow
// carousel, this primitive pair carries no colors, radius, or shadow of its
// own (ContainerScroll is just a perspective wrapper; CardSticky is just
// position: sticky with a computed top/z offset). Every CLAUDE.md conflict
// in the reference -- backdrop-blur-md, text-indigo-500, rounded-2xl,
// Unsplash images -- lived in that reference's own demo usage, not in these
// two components, so there's nothing to re-theme at this layer. The actual
// on-page usage (how-it-works.tsx, colocated with the landing route) is
// where every color/radius/shadow class is chosen from this app's own
// tokens.
//
// The "stacking" effect itself is native position: sticky driven by the
// user's own scroll -- there's no scroll-linked JS easing here to gate
// behind prefers-reduced-motion (contrast the coverflow carousel's settle()
// loop, which needed exactly that guard).

interface CardStickyProps extends HTMLMotionProps<"div"> {
  index: number;
  incrementY?: number;
  incrementZ?: number;
}

const ContainerScroll = React.forwardRef<
  HTMLDivElement,
  React.HTMLProps<HTMLDivElement>
>(({ children, className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("relative w-full", className)}
      style={{ perspective: "1000px", ...props.style }}
      {...props}
    >
      {children}
    </div>
  );
});
ContainerScroll.displayName = "ContainerScroll";

const CardSticky = React.forwardRef<HTMLDivElement, CardStickyProps>(
  (
    { index, incrementY = 10, incrementZ = 10, children, className, style, ...props },
    ref,
  ) => {
    const y = index * incrementY;
    const z = index * incrementZ;

    return (
      <motion.div
        ref={ref}
        layout="position"
        style={{
          top: y,
          z,
          backfaceVisibility: "hidden",
          ...style,
        }}
        className={cn("sticky", className)}
        {...props}
      >
        {children}
      </motion.div>
    );
  },
);
CardSticky.displayName = "CardSticky";

export { ContainerScroll, CardSticky };

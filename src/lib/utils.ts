import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Standard shadcn cn() helper -- required by every component adapted from
// their docs (Select, Calendar). tailwind-merge specifically matters here,
// not just clsx: without it, a call site passing an overriding className
// (e.g. cn("h-9 px-3", className) where className also sets px-4) puts BOTH
// classes in the output with no defined winner -- exactly the kind of
// silent conflict this codebase already hit once with a bare
// primaryButtonClassName usage. twMerge resolves same-property Tailwind
// classes deterministically (last one wins) instead of leaving it to
// build-order luck.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

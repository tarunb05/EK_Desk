// The one place the "EK Desk" wordmark and its mark are drawn -- sidebar,
// mobile top bar, landing and login all render this instead of each
// hand-setting a <span> at its own size and weight. The mark is two flat
// shapes from the palette (a slate tile with a periwinkle quarter-disc cut
// into its corner), the same block-and-arc vocabulary the landing page's
// mosaic uses; aria-hidden since the text beside it already names the app.
export function BrandMark({ size = 20 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      aria-hidden="true"
      className="shrink-0"
    >
      <rect width="20" height="20" rx="5" className="fill-accent" />
      {/* The quarter-disc follows the tile's own rounded corner, so nothing
          pokes out past it. Same two shapes as public/brand/ek-desk-mark.svg
          and the favicon (app/icon.svg): change one, change all three. */}
      <path
        d="M20 15V8A12 12 0 0 0 8 20h7a5 5 0 0 0 5-5Z"
        className="fill-accent-fill"
      />
    </svg>
  );
}

export function Wordmark({
  size = "sm",
  className = "",
}: {
  size?: "sm" | "lg";
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap font-bold tracking-[-0.02em] text-ink ${
        size === "lg" ? "gap-2.5 text-xl" : "gap-2 text-base"
      } ${className}`}
    >
      <BrandMark size={size === "lg" ? 26 : 20} />
      EK Desk
    </span>
  );
}

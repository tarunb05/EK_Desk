"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchIcon } from "./nav-icons";

interface SearchFieldProps {
  ariaLabel: string;
  placeholder: string;
  className?: string;
}

// Search sits outside the FilterMenu popover, immediately to its left --
// unlike the rest of a page's filters, search is the one control someone
// reaches for on nearly every visit, so it stays one click closer than
// something reached for occasionally (branch, status, class...).
export function SearchField({
  ariaLabel,
  placeholder,
  className = "w-64",
}: SearchFieldProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateQuery(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("q", value);
    } else {
      params.delete("q");
    }
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className={`relative ${className}`}>
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted">
        <SearchIcon size={14} />
      </span>
      <input
        type="search"
        aria-label={ariaLabel}
        placeholder={placeholder}
        defaultValue={searchParams.get("q") ?? ""}
        onChange={(event) => updateQuery(event.target.value)}
        className="h-9 w-full rounded-md border border-border bg-surface pl-8 pr-3 text-sm text-ink outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent"
      />
    </div>
  );
}

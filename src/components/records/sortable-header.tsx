import Link from "next/link";

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  currentSort: string;
  currentDir: "asc" | "desc";
  searchParams: Record<string, string | undefined>;
  align?: "left" | "right";
}

export function SortableHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  searchParams,
  align = "left",
}: SortableHeaderProps) {
  const isActive = currentSort === sortKey;
  const nextDir = isActive && currentDir === "asc" ? "desc" : "asc";

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined) params.set(key, value);
  }
  params.set("sort", sortKey);
  params.set("dir", nextDir);

  return (
    <Link
      href={`?${params.toString()}`}
      className={`text-2xs font-medium uppercase tracking-wide text-ink-muted hover:text-ink ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {label}
      {isActive ? (currentDir === "asc" ? " ▲" : " ▼") : ""}
    </Link>
  );
}

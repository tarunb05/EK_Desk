"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signOut } from "@/lib/auth/sign-out";
import type {
  AcademicYearOption,
  BranchOption,
} from "@/lib/shell/resolve-year-branch";
import { MenuIcon } from "./nav-icons";
import { useSidebarContext } from "./sidebar-context";

interface TopBarProps {
  years: AcademicYearOption[];
  branches: BranchOption[];
}

export function TopBar({ years, branches }: TopBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setMobileOpen } = useSidebarContext();

  const currentYearLabel =
    searchParams.get("year") ??
    years.find((year) => year.isCurrent)?.label ??
    years[0]?.label ??
    "";
  const currentBranch = searchParams.get("branch") ?? "all";

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline bg-surface px-4 py-3 md:h-14 md:flex-nowrap md:px-6 md:py-0">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink focus-visible:outline-2 focus-visible:outline-accent md:hidden"
        >
          <MenuIcon />
        </button>

        <label className="flex items-center gap-2 text-sm text-ink-secondary">
          Year
          <select
            value={currentYearLabel}
            onChange={(event) => updateParam("year", event.target.value)}
            className="h-8 rounded-md border border-border bg-surface px-2 text-sm text-ink"
          >
            {years.map((year) => (
              <option key={year.id} value={year.label}>
                {year.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-ink-secondary">
          Branch
          <select
            value={currentBranch}
            onChange={(event) => updateParam("branch", event.target.value)}
            className="h-8 rounded-md border border-border bg-surface px-2 text-sm text-ink"
          >
            <option value="all">All branches</option>
            {branches.map((branch) => (
              <option key={branch.code} value={branch.code}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <form action={signOut}>
        <button
          type="submit"
          className="h-8 rounded-md border border-border px-3 text-sm text-ink-secondary transition-colors duration-150 hover:bg-surface-accent hover:text-ink"
        >
          Sign out
        </button>
      </form>
    </header>
  );
}

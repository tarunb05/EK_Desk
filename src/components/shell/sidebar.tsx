import { NavLinks } from "./nav-links";

export function Sidebar() {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-hairline bg-surface px-3 py-6">
      <div className="mb-6 px-3 text-sm font-medium text-ink">
        EuroKids Fee Tracker
      </div>
      <NavLinks />
    </aside>
  );
}

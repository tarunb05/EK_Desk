export type Role = "admin" | "teacher";

// Single source of truth for which role may reach which path prefix.
// middleware.ts and the sidebar nav both read this one map -- never
// duplicate the list of allowed routes anywhere else, or the nav and the
// actual access control can silently drift apart.
export const ROUTE_ACCESS: Record<string, readonly Role[]> = {
  "/transport": ["admin"],
  "/daycare": ["admin"],
  "/students": ["admin", "teacher"],
  // More specific than /settings below, and must stay declared first --
  // isRouteAllowed matches the first prefix that fits, so a narrower path
  // needs to come before a broader one it would otherwise be shadowed by.
  "/settings/expense-categories": ["admin"],
  "/settings": ["admin"],
  "/expenses": ["admin", "teacher"],
  // The activity log carries both branches' names, every expense amount
  // and every receivable change -- Phase 8's blackout stands here the way
  // it does for /transport and /daycare, not the Phase 10 exception that
  // opened /expenses to a teacher's own branch.
  "/logs": ["admin"],
  // Admin sees the full review queue (approve/reject everyone's pending
  // submissions); a teacher sees a read-only list of their own -- same
  // route, branched by role in the page itself, since RLS already scopes
  // a teacher's own submission reads to just theirs.
  "/approvals": ["admin", "teacher"],
  // The three Excel exports (Route Handlers, not pages) -- same role split
  // as the dashboard/expenses/log page each one's data comes from.
  "/api/export/fee-accounts": ["admin"],
  "/api/export/expenses": ["admin", "teacher"],
  "/api/export/logs": ["admin"],
};

export function isRouteAllowed(pathname: string, role: Role): boolean {
  const entry = Object.entries(ROUTE_ACCESS).find(
    ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  return entry ? entry[1].includes(role) : false;
}

// Where to send a role when the route they hit isn't one of theirs --
// the first (and for now, only) route each role is guaranteed to reach.
export function defaultRouteFor(role: Role): string {
  return role === "teacher" ? "/students" : "/transport";
}

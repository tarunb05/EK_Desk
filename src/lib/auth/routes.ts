export type Role = "admin" | "teacher";

// Single source of truth for which role may reach which path prefix.
// middleware.ts and the sidebar nav both read this one map -- never
// duplicate the list of allowed routes anywhere else, or the nav and the
// actual access control can silently drift apart.
export const ROUTE_ACCESS: Record<string, readonly Role[]> = {
  "/transport": ["admin"],
  "/daycare": ["admin"],
  "/students": ["admin", "teacher"],
  "/settings": ["admin"],
  // Admin sees the full review queue (approve/reject everyone's pending
  // submissions); a teacher sees a read-only list of their own -- same
  // route, branched by role in the page itself, since RLS already scopes
  // a teacher's own submission reads to just theirs.
  "/approvals": ["admin", "teacher"],
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

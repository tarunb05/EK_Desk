import { describe, expect, it } from "vitest";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { defaultRouteFor, isRouteAllowed, ROUTE_ACCESS } from "./routes";
import { NAV_LINKS } from "@/components/shell/nav-links";

const APP_DIR = path.join(process.cwd(), "src/app/(app)");

// Parallel-route slots (@drawer) have no URL of their own -- skip them
// entirely rather than trying to map them. Route groups ((app)) don't
// appear in the URL either.
function findPageRoutes(dir: string, urlPrefix = ""): string[] {
  const routes: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith("@")) continue;

    const fullPath = path.join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      const isGroup = entry.startsWith("(") && entry.endsWith(")");
      const segment = isGroup ? "" : `/${entry}`;
      routes.push(...findPageRoutes(fullPath, `${urlPrefix}${segment}`));
    } else if (entry === "page.tsx") {
      routes.push(urlPrefix || "/");
    }
  }
  return routes;
}

describe("ROUTE_ACCESS", () => {
  it("covers every page route under src/app/(app)", () => {
    const routes = findPageRoutes(APP_DIR);
    expect(routes.length).toBeGreaterThan(0);

    const unmapped = routes.filter(
      (route) =>
        !Object.keys(ROUTE_ACCESS).some(
          (prefix) => route === prefix || route.startsWith(`${prefix}/`),
        ),
    );
    expect(unmapped).toEqual([]);
  });

  it("restricts admin-only routes and allows shared ones", () => {
    expect(isRouteAllowed("/transport", "admin")).toBe(true);
    expect(isRouteAllowed("/transport", "teacher")).toBe(false);
    expect(isRouteAllowed("/transport/new", "teacher")).toBe(false);
    expect(isRouteAllowed("/daycare", "teacher")).toBe(false);
    expect(isRouteAllowed("/settings", "teacher")).toBe(false);
    expect(isRouteAllowed("/students", "teacher")).toBe(true);
    expect(isRouteAllowed("/students", "admin")).toBe(true);
    expect(isRouteAllowed("/approvals", "teacher")).toBe(true);
    expect(isRouteAllowed("/approvals", "admin")).toBe(true);
    expect(isRouteAllowed("/expenses", "teacher")).toBe(true);
    expect(isRouteAllowed("/expenses", "admin")).toBe(true);
    expect(isRouteAllowed("/settings/expense-categories", "teacher")).toBe(
      false,
    );
    expect(isRouteAllowed("/settings/expense-categories", "admin")).toBe(
      true,
    );
  });

  it("has no opinion on an unmapped path", () => {
    expect(isRouteAllowed("/nonexistent", "admin")).toBe(false);
  });

  it("sends each role to a route they can actually reach", () => {
    expect(isRouteAllowed(defaultRouteFor("admin"), "admin")).toBe(true);
    expect(isRouteAllowed(defaultRouteFor("teacher"), "teacher")).toBe(true);
  });
});

describe("teacher nav", () => {
  it("shows exactly the teacher-allowed NAV_LINKS entries", () => {
    const teacherHrefs = NAV_LINKS.filter((link) =>
      ROUTE_ACCESS[link.href]?.includes("teacher"),
    ).map((link) => link.href);
    expect(teacherHrefs).toEqual(["/students", "/expenses", "/approvals"]);
  });

  it("shows every NAV_LINKS entry for admin", () => {
    const adminHrefs = NAV_LINKS.filter((link) =>
      ROUTE_ACCESS[link.href]?.includes("admin"),
    ).map((link) => link.href);
    expect(adminHrefs).toEqual(NAV_LINKS.map((link) => link.href));
  });
});

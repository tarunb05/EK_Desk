import { describe, expect, it } from "vitest";
import {
  activityLogActiveFilterCount,
  activityLogSearchParamsSchema,
} from "./activity-log-search-params";

describe("activityLogSearchParamsSchema", () => {
  it("falls back to defaults for unknown action/entity rather than throwing", () => {
    const parsed = activityLogSearchParamsSchema.parse({
      action: "not-a-real-action",
      entity: "not-a-real-entity",
    });
    expect(parsed.action).toBe("all");
    expect(parsed.entity).toBe("all");
  });

  it("falls back to undefined for a malformed dateFrom or dateTo", () => {
    const parsed = activityLogSearchParamsSchema.parse({
      dateFrom: "August 2026",
      dateTo: "14 August 2026",
    });
    expect(parsed.dateFrom).toBeUndefined();
    expect(parsed.dateTo).toBeUndefined();
  });

  it("accepts well-formed dateFrom and dateTo", () => {
    const parsed = activityLogSearchParamsSchema.parse({
      dateFrom: "2026-08-01",
      dateTo: "2026-08-14",
    });
    expect(parsed.dateFrom).toBe("2026-08-01");
    expect(parsed.dateTo).toBe("2026-08-14");
  });
});

describe("activityLogActiveFilterCount", () => {
  const base = {
    action: "all" as const,
    entity: "all" as const,
  };

  it("counts zero when nothing is set", () => {
    expect(activityLogActiveFilterCount(base)).toBe(0);
  });

  it("does not count branch/actor/action/entity when they're 'all'", () => {
    expect(
      activityLogActiveFilterCount({ ...base, branch: "all", actor: "all" }),
    ).toBe(0);
  });

  it("counts dateFrom, dateTo, branch, actor, action and entity independently", () => {
    expect(
      activityLogActiveFilterCount({
        dateFrom: "2026-08-01",
        dateTo: "2026-08-14",
        branch: "BR-A",
        actor: "some-uuid",
        action: "delete",
        entity: "expense",
      }),
    ).toBe(6);
  });

  it("does not count q -- search sits outside the filter panel", () => {
    expect(activityLogActiveFilterCount({ ...base, q: "sharma" })).toBe(0);
  });
});

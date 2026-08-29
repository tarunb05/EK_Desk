import { describe, expect, it } from "vitest";
import {
  activityLogActiveFilterCount,
  activityLogSearchParamsSchema,
  clampDayToMonth,
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

  it("falls back to undefined for a malformed month or day", () => {
    const parsed = activityLogSearchParamsSchema.parse({
      month: "August",
      day: "14 August 2026",
    });
    expect(parsed.month).toBeUndefined();
    expect(parsed.day).toBeUndefined();
  });

  it("accepts well-formed month and day", () => {
    const parsed = activityLogSearchParamsSchema.parse({
      month: "2026-08",
      day: "2026-08-14",
    });
    expect(parsed.month).toBe("2026-08");
    expect(parsed.day).toBe("2026-08-14");
  });
});

describe("clampDayToMonth", () => {
  it("keeps a day that falls inside the selected month", () => {
    expect(clampDayToMonth("2026-08-14", "2026-08")).toBe("2026-08-14");
  });

  it("keeps the first and last day of the month", () => {
    expect(clampDayToMonth("2026-08-01", "2026-08")).toBe("2026-08-01");
    expect(clampDayToMonth("2026-08-31", "2026-08")).toBe("2026-08-31");
  });

  it("drops a day outside the selected month", () => {
    expect(clampDayToMonth("2026-09-01", "2026-08")).toBeUndefined();
  });

  it("passes the day through unchanged when no month is selected", () => {
    expect(clampDayToMonth("2026-08-14", undefined)).toBe("2026-08-14");
  });

  it("returns undefined when there's no day at all", () => {
    expect(clampDayToMonth(undefined, "2026-08")).toBeUndefined();
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

  it("counts month, day, branch, actor, action and entity independently", () => {
    expect(
      activityLogActiveFilterCount({
        month: "2026-08",
        day: "2026-08-14",
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

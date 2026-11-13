import { describe, expect, it } from "vitest";
import {
  buildSchedule,
  inclusiveDays,
  scheduleState,
  summarizeDaycare,
  type DaycareAccountFacts,
} from "./daycare-history";

function account(
  overrides: Partial<DaycareAccountFacts> = {},
): DaycareAccountFacts {
  return {
    feeAccountId: "fa-1",
    startsOn: "2026-11-01",
    endsOn: "2026-11-30",
    slot: "Morning",
    status: "active",
    totalReceivablePaise: 400_000n,
    payments: [],
    ...overrides,
  };
}

describe("inclusiveDays", () => {
  it("counts both end days", () => {
    expect(inclusiveDays("2026-11-11", "2026-11-17")).toBe(7);
    expect(inclusiveDays("2026-11-11", "2026-11-11")).toBe(1);
    expect(inclusiveDays("2026-11-01", "2026-11-30")).toBe(30);
  });

  it("crosses month and year boundaries", () => {
    expect(inclusiveDays("2026-12-30", "2027-01-02")).toBe(4);
  });

  it("is zero when the end is before the start", () => {
    expect(inclusiveDays("2026-11-10", "2026-11-01")).toBe(0);
  });
});

describe("scheduleState", () => {
  const stint = {
    startsOn: "2026-11-10",
    endsOn: "2026-11-20",
    status: "active",
  };

  it("is upcoming before the first day", () => {
    expect(scheduleState(stint, "2026-11-09")).toBe("upcoming");
  });

  it("is current on the first and last day and between", () => {
    expect(scheduleState(stint, "2026-11-10")).toBe("current");
    expect(scheduleState(stint, "2026-11-15")).toBe("current");
    expect(scheduleState(stint, "2026-11-20")).toBe("current");
  });

  it("is past after the last day", () => {
    expect(scheduleState(stint, "2026-11-21")).toBe("past");
  });

  it("is discontinued whatever the dates say", () => {
    expect(
      scheduleState({ ...stint, status: "discontinued" }, "2026-11-15"),
    ).toBe("discontinued");
  });
});

describe("summarizeDaycare", () => {
  it("is all zeros for a student with no daycare enrollments", () => {
    expect(summarizeDaycare([])).toEqual({
      sessions: 0,
      daysBooked: 0,
      paymentCount: 0,
      totalPaidPaise: 0n,
    });
  });

  it("adds up sessions, days, payments and money across enrollments", () => {
    const summary = summarizeDaycare([
      account({
        feeAccountId: "a",
        startsOn: "2026-11-01",
        endsOn: "2026-11-07",
        payments: [{ amountPaise: 100_000n, voidedAt: null }],
      }),
      account({
        feeAccountId: "b",
        startsOn: "2026-12-01",
        endsOn: "2026-12-30",
        payments: [
          { amountPaise: 150_000n, voidedAt: null },
          { amountPaise: 50_000n, voidedAt: null },
        ],
      }),
    ]);

    expect(summary).toEqual({
      sessions: 2,
      daysBooked: 7 + 30,
      paymentCount: 3,
      totalPaidPaise: 300_000n,
    });
  });

  it("leaves voided payments out of the count and the total", () => {
    const summary = summarizeDaycare([
      account({
        payments: [
          { amountPaise: 100_000n, voidedAt: null },
          { amountPaise: 999_000n, voidedAt: "2026-11-05T00:00:00Z" },
        ],
      }),
    ]);

    expect(summary.paymentCount).toBe(1);
    expect(summary.totalPaidPaise).toBe(100_000n);
  });

  it("doesn't count a discontinued enrollment as a session or as days, but keeps its payments", () => {
    const summary = summarizeDaycare([
      account({
        feeAccountId: "kept",
        startsOn: "2026-11-01",
        endsOn: "2026-11-10",
      }),
      account({
        feeAccountId: "cancelled",
        status: "discontinued",
        startsOn: "2026-12-01",
        endsOn: "2026-12-31",
        payments: [{ amountPaise: 200_000n, voidedAt: null }],
      }),
    ]);

    expect(summary.sessions).toBe(1);
    expect(summary.daysBooked).toBe(10);
    expect(summary.paymentCount).toBe(1);
    expect(summary.totalPaidPaise).toBe(200_000n);
  });
});

describe("buildSchedule", () => {
  it("lists the newest stint first with its state, days and amount paid", () => {
    const schedule = buildSchedule(
      [
        account({
          feeAccountId: "past",
          startsOn: "2026-09-01",
          endsOn: "2026-09-30",
          payments: [{ amountPaise: 400_000n, voidedAt: null }],
        }),
        account({
          feeAccountId: "upcoming",
          startsOn: "2026-12-01",
          endsOn: "2026-12-07",
          slot: null,
        }),
        account({
          feeAccountId: "current",
          startsOn: "2026-11-10",
          endsOn: "2026-11-20",
          payments: [
            { amountPaise: 100_000n, voidedAt: null },
            { amountPaise: 300_000n, voidedAt: "2026-11-11T00:00:00Z" },
          ],
        }),
      ],
      "2026-11-13",
    );

    expect(schedule.map((entry) => entry.feeAccountId)).toEqual([
      "upcoming",
      "current",
      "past",
    ]);
    expect(schedule.map((entry) => entry.state)).toEqual([
      "upcoming",
      "current",
      "past",
    ]);
    expect(schedule.map((entry) => entry.days)).toEqual([7, 11, 30]);
    expect(schedule[1]?.paidPaise).toBe(100_000n);
    expect(schedule[0]?.slot).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { toISTDateString } from "./datetime";

describe("toISTDateString", () => {
  it("returns the same calendar day when well within it in IST", () => {
    // 10:00 UTC = 15:30 IST, same day.
    expect(toISTDateString("2026-09-16T10:00:00.000Z")).toBe("2026-09-16");
  });

  it("rolls over to the next day for a late-UTC-evening instant", () => {
    // 23:50 UTC = 05:20 IST the next calendar day.
    expect(toISTDateString("2026-09-16T23:50:00.000Z")).toBe("2026-09-17");
  });

  it("rolls over across a month boundary", () => {
    // 23:50 UTC on the 30th = 05:20 IST on the 1st of the next month.
    expect(toISTDateString("2026-09-30T23:50:00.000Z")).toBe("2026-10-01");
  });

  it("does not roll over for an instant just before the IST boundary", () => {
    // 18:29 UTC = 23:59 IST, still the same day.
    expect(toISTDateString("2026-09-16T18:29:00.000Z")).toBe("2026-09-16");
  });
});

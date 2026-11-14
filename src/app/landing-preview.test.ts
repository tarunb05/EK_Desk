import { describe, expect, it } from "vitest";
import { DAYCARE_SAMPLE, TRANSPORT_SAMPLE } from "./landing-preview";

const sum = (values: bigint[]) => values.reduce((a, b) => a + b, 0n);

// The landing preview's sample figures are invented, but they have to agree
// with each other the way real dashboard figures would.
describe.each([
  ["transport", TRANSPORT_SAMPLE],
  ["daycare", DAYCARE_SAMPLE],
])("%s landing sample", (_, sample) => {
  const pending = sample.receivable - sample.collected;

  it("monthly columns sum to collected", () => {
    expect(sum(sample.months.map(([, paise]) => paise))).toBe(sample.collected);
  });

  it("ageing buckets sum to pending, and the late ones to overdue", () => {
    expect(sum(sample.ageing.map((b) => b.pendingPaise))).toBe(pending);
    expect(
      sum(
        sample.ageing
          .filter((b) => b.bucket !== "not_yet_due")
          .map((b) => b.pendingPaise),
      ),
    ).toBe(sample.overdue);
  });

  it.each(["byClass", "byGroup"] as const)(
    "%s rows sum to the totals and the student count",
    (key) => {
      const rows = sample[key];
      expect(sum(rows.map((r) => r.receivablePaise))).toBe(sample.receivable);
      expect(sum(rows.map((r) => r.collectedPaise))).toBe(sample.collected);
      expect(sum(rows.map((r) => r.pendingPaise))).toBe(pending);
      expect(rows.reduce((n, r) => n + r.studentCount, 0)).toBe(
        sample.studentCount,
      );
    },
  );
});
